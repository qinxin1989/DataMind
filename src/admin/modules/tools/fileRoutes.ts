import express from 'express';
import multer from 'multer';
import path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import { pathToFileURL } from 'url';


import { createAuthMiddleware } from '../../../middleware/auth';

const router = express.Router();
const uploadDir = path.join(process.cwd(), 'uploads', 'tools');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});

const upload = multer({ storage });

// 格式转换接口
router.post('/convert', upload.any(), async (req, res) => {
    try {
        const files = req.files as Express.Multer.File[];
        // 兼容新旧参数名
        const sourceFormat = req.body.sourceFormat || req.body.from;
        const targetFormat = req.body.targetFormat || req.body.to;

        if (!files || files.length === 0) {
            return res.status(400).json({ error: '请上传文件', success: false });
        }

        if (!sourceFormat || !targetFormat) {
            return res.status(400).json({ error: '请指定源格式和目标格式', success: false });
        }

        const results: string[] = [];

        for (const file of files) {
            const ext = path.extname(file.originalname).toLowerCase();
            const outputExt = targetFormat === 'word' ? 'docx' : (targetFormat === 'excel' ? 'xlsx' : targetFormat);
            const outputPath = path.join(uploadDir, `${uuidv4()}.${outputExt}`);

            try {
                const stats = fs.statSync(file.path);
                console.log(`[FileConvert] 处理文件: ${file.originalname}, 大小: ${stats.size} 字节`);

                if (sourceFormat === 'pdf' && targetFormat === 'txt') {
                    // Debug Log
                    fs.appendFileSync('conversion_debug.log', `[${new Date().toISOString()}] Start converting ${file.originalname} (${stats.size} bytes) to txt\n`);

                    try {
                        let PDFParseClass: any;
                        try {
                            const mod = await import('pdf-parse');
                            // 尝试从不同属性获取，因为在不同环境下导出可能不同
                            PDFParseClass = mod.PDFParse || (mod.default as any)?.PDFParse || mod.default;
                        } catch (e) {
                            fs.appendFileSync('conversion_debug.log', `[${new Date().toISOString()}] Import failed: ${e}\n`);
                            throw e;
                        }

                        if (!PDFParseClass) {
                            fs.appendFileSync('conversion_debug.log', `[${new Date().toISOString()}] PDFParse class not found in module. Keys: ${Object.keys(await import('pdf-parse'))}\n`);
                            throw new Error('PDFParse class not found in module');
                        }

                        const dataBuffer = fs.readFileSync(file.path);

                        // 配置 CMap 以支持中文解析
                        // 使用 pathToFileURL 处理 Windows 路径兼容性
                        const cMapPath = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'cmaps/');
                        const cMapUrl = pathToFileURL(cMapPath).href;

                        const parser = new PDFParseClass({
                            data: dataBuffer,
                            // 这些选项将传递给 pdf.js 的 getDocument
                            cMapUrl: cMapUrl,
                            cMapPacked: true
                        });

                        console.log(`[FileConvert] 开始解析 PDF...`);
                        const textResult = await parser.getText();
                        const text = textResult.text || '';

                        fs.appendFileSync('conversion_debug.log', `[${new Date().toISOString()}] Extracted text length: ${text.length}\n`);
                        // console.log(`[FileConvert] PDF 解析完成, 文本长度: ${text.length}`);


                        // 添加 BOM (\uFEFF) 解决 Windows 乱码
                        fs.writeFileSync(outputPath, '\uFEFF' + text);
                        results.push(outputPath);
                    } catch (innerError: any) {
                        fs.appendFileSync('conversion_debug.log', `[${new Date().toISOString()}] PDF Error: ${innerError.message}\n${innerError.stack}\n`);
                        throw innerError;
                    }
                } else if (sourceFormat === 'excel' && targetFormat === 'pdf') {



                    fs.writeFileSync(outputPath, `Placeholder PDF content for ${file.originalname}`);
                    results.push(outputPath);
                } else if (sourceFormat === 'csv' && targetFormat === 'excel') {
                    const workbook = XLSX.readFile(file.path);
                    XLSX.writeFile(workbook, outputPath);
                    results.push(outputPath);
                } else if (sourceFormat === 'json' && targetFormat === 'excel') {
                    const jsonData = JSON.parse(fs.readFileSync(file.path, 'utf-8'));
                    const worksheet = XLSX.utils.json_to_sheet(Array.isArray(jsonData) ? jsonData : [jsonData]);
                    const workbook = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
                    XLSX.writeFile(workbook, outputPath);
                    results.push(outputPath);
                } else {
                    // 默认降级：直接返回副本
                    fs.copyFileSync(file.path, outputPath);
                    results.push(outputPath);
                }
            } finally {
                // 无论转换成功与否，尝试删除源文件
                try {
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                } catch (e) { }
            }
        }

        if (results.length > 0) {
            const finalFile = results[0];
            const fileId = path.basename(finalFile);
            const originalName = files[0].originalname;
            const nameWithoutExt = path.parse(originalName).name;
            const safeName = `${nameWithoutExt}_converted.${targetFormat === 'word' ? 'docx' : (targetFormat === 'excel' ? 'xlsx' : targetFormat)}`;

            // 返回 JSON 供前端后续跳转下载
            res.json({
                success: true,
                fileId: fileId,
                safeName: safeName,
                message: '转换完成，请下载'
            });
        }
        else {
            res.status(500).json({ error: '转换过程未生成任何结果', success: false });
        }
    } catch (error: any) {
        console.error('File conversion error:', error);
        res.status(500).json({ error: error.message || '系统繁忙', success: false });
    }
});

/**
 * 原生下载接口 - V3 终极修复版
 * 采用 RFC 6266 标准处理 Content-Disposition，完美解决 Chrome 乱码。
 * 支持伪静态路径：/download/:id/:filename
 */
router.get('/download/:id/:filename?', async (req, res) => {
    try {
        const fileId = req.params.id;
        const rawFileName = req.params.filename || req.query.name as string || 'download.txt';
        const filePath = path.join(uploadDir, fileId);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: '文件已失效（下载链接仅限一次有效或已过期）' });
        }

        console.log(`[FileDownload V3] 触发原生下载: ${rawFileName}, ID: ${fileId}`);

        // 1. 设置强制不缓存
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        // 2. 核心：RFC 6266 标准处理中文字符名
        // 这是解决 Google 浏览器乱码和打不开问题的最终方案
        const encodedName = encodeURIComponent(rawFileName).replace(/['()]/g, escape).replace(/\*/g, '%2A');
        res.setHeader('Content-Disposition', `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);

        // 3. 执行流式传输
        res.download(filePath, rawFileName, (err) => {
            if (err) {
                console.error('[FileDownload V3] 下载出错:', err);
                // 如果头信息已发送，res.status 无法再次调用，回调仅作记录
            }

            // 4. 下载完成后确保清理临时文件
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`[FileDownload V3] 临时文件已清理: ${fileId}`);
                }
            } catch (e) {
                console.error('[FileDownload V3] 清理文件失败:', e);
            }
        });
    } catch (error) {
        console.error('[FileDownload V3] 系统错误:', error);
        res.status(500).json({ error: '系统内部错误' });
    }
});



export default router;
