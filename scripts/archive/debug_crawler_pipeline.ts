
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { DynamicEngine } from './src/agent/skills/crawler/dynamic_engine';

async function testPipeline() {
    const url = 'https://www.nda.gov.cn/sjj/zwgk/zcfb/list/index_pc_1.html';
    // 模拟前端传递的选择器
    const selectors = {
        container: "ul.u-list > li",
        fields: {
            "标题": "a",
            "链接": "a::attr(href)",
            "发布日期": "span"
        }
    };

    console.log('[Debug] 1. Starting DynamicEngine fetch...');
    try {
        // 模拟 service.ts 中的等待逻辑
        const fetchOptions = { waitSelector: selectors.container };
        const htmlContent = await DynamicEngine.fetchHtml(url, fetchOptions);

        const tempFilePath = path.join(os.tmpdir(), `debug_preview_${Date.now()}.html`);
        fs.writeFileSync(tempFilePath, htmlContent);
        console.log(`[Debug] 2. HTML saved to: ${tempFilePath} (Size: ${htmlContent.length})`);

        // 检查文件内容是否包含目标元素
        if (htmlContent.includes('u-list')) {
            console.log('[Debug] 2.1 File contains "u-list" class.');
        } else {
            console.error('[Debug] 2.1 File DOES NOT contain "u-list" class!');
        }

        console.log('[Debug] 3. Spawning Python engine...');
        const enginePath = path.join(process.cwd(), 'src/agent/skills/crawler/engine.py');
        const pythonPath = process.env.PYTHON_PATH || path.join(process.cwd(), '.venv', 'Scripts', 'python');

        console.log(`[Debug] Python Path: ${pythonPath}`);
        console.log(`[Debug] Engine Path: ${enginePath}`);

        // 构造参数
        const args = [
            enginePath,
            tempFilePath,
            JSON.stringify(selectors),
            url,
            JSON.stringify({ enabled: false, max_pages: 1 })
        ];

        const pythonProcess = spawn(pythonPath, args, {
            cwd: process.cwd(),
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' } // 强制 UTF-8
        });

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            const str = data.toString();
            stderr += str;
            console.log(`[Python Stderr]: ${str}`); // 实时打印 Python 调试信息
        });

        pythonProcess.on('close', (code) => {
            console.log(`[Debug] Python process exited with code ${code}`);
            try {
                const result = JSON.parse(stdout);
                console.log('[Debug] Result:', JSON.stringify(result, null, 2));
            } catch (e) {
                console.error('[Debug] Failed to parse stdout:', stdout);
            }

            // 清理
            try { fs.unlinkSync(tempFilePath); } catch (e) { }
            process.exit(0);
        });

    } catch (err: any) {
        console.error('[Debug] Error:', err);
        process.exit(1);
    }
}

testPipeline();
