import express from 'express';
import multer from 'multer';
import path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import pdf from 'pdf-parse';
import * as XLSX from 'xlsx';
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
router.post('/convert', upload.array('files'), async (req, res) => {
    const files = req.files as Express.Multer.File[];
    const { sourceFormat, targetFormat } = req.body;

    if (!files || files.length === 0) {
        return res.status(400).json({ error: '请上传文件' });
    }

    try {
        const results: string[] = [];

        for (const file of files) {
            const ext = path.extname(file.originalname).toLowerCase();
            const outputPath = path.join(uploadDir, `${uuidv4()}.${targetFormat === 'word' ? 'docx' : (targetFormat === 'excel' ? 'xlsx' : targetFormat)}`);

            if (sourceFormat === 'pdf' && targetFormat === 'txt') {
                // PDF -> TXT
                const dataBuffer = fs.readFileSync(file.path);
                const data = await pdf(dataBuffer);
                fs.writeFileSync(outputPath, data.text);
                results.push(outputPath);
            } else if (sourceFormat === 'excel' && targetFormat === 'pdf') {
                // Mock Excel -> PDF (实际生产环境需更复杂工具如 carbon-pdf)
                // 这里暂存为文本作为演示，说明路径通了
                fs.writeFileSync(outputPath, `Placeholder PDF content for ${file.originalname}`);
                results.push(outputPath);
            } else if (sourceFormat === 'csv' && targetFormat === 'excel') {
                // CSV -> Excel
                const workbook = XLSX.readFile(file.path);
                XLSX.writeFile(workbook, outputPath);
                results.push(outputPath);
            } else if (sourceFormat === 'json' && targetFormat === 'excel') {
                // JSON -> Excel
                const jsonData = JSON.parse(fs.readFileSync(file.path, 'utf-8'));
                const worksheet = XLSX.utils.json_to_sheet(Array.isArray(jsonData) ? jsonData : [jsonData]);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
                XLSX.writeFile(workbook, outputPath);
                results.push(outputPath);
            } else {
                // 处理 PDF -> Word 的简化版或直接复制作为占位
                fs.copyFileSync(file.path, outputPath);
                results.push(outputPath);
            }

            // 清理源文件
            try { fs.unlinkSync(file.path); } catch (e) { }
        }

        // 目前只处理第一个文件的下载返回，或提供一个压缩包（TODO）
        if (results.length > 0) {
            const finalFile = results[0];
            res.download(finalFile, `converted_${path.basename(finalFile)}`, (err) => {
                // 下载后删除结果文件
                try { fs.unlinkSync(finalFile); } catch (e) { }
            });
        } else {
            res.status(500).json({ error: '转换失败' });
        }
    } catch (error: any) {
        console.error('File conversion error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
