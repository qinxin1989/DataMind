
const { DynamicEngine } = require('../src/agent/skills/crawler/dynamic_engine');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

// 封装一个简单的 Python 引擎执行逻辑（模拟 index.ts）
const { spawn } = require('child_process');

async function crawlToExcel(url, selectors, fileName) {
    console.log(`Starting crawl for: ${url}`);

    try {
        // 1. 获取动态 HTML
        const html = await DynamicEngine.fetchHtml(url);
        const tempPath = path.join(process.cwd(), 'temp_crawl.html');
        fs.writeFileSync(tempPath, html);

        // 2. 调用 Python 引擎解析
        const pythonPath = "f:\\Project\\ai-data-platform\\.venv\\Scripts\\python.exe";
        const enginePath = path.join(process.cwd(), 'src/agent/skills/crawler/engine.py');
        const selectorsStr = JSON.stringify(selectors);

        return new Promise((resolve, reject) => {
            const args = [enginePath, tempPath, selectorsStr, url];
            console.log('Running engine:', pythonPath, args.join(' '));

            const child = spawn(pythonPath, args);
            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => stdout += data.toString());
            child.stderr.on('data', (data) => stderr += data.toString());

            child.on('close', (code) => {
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

                if (code !== 0) {
                    console.error('Python Error (stderr):', stderr);
                    return reject(new Error(`Python process exited with code ${code}`));
                }

                try {
                    const result = JSON.parse(stdout);
                    if (result.success) {
                        const data = result.data || [];
                        console.log(`Extracted ${data.length} rows.`);

                        if (data.length === 0) {
                            console.warn('!!! WARNING: No data extracted. Excel will be empty.');
                            console.log('Engine Output:', JSON.stringify(result, null, 2));
                            return resolve([]);
                        }

                        // 3. 导出到 Excel
                        const workbook = XLSX.utils.book_new();
                        const worksheet = XLSX.utils.json_to_sheet(data);
                        XLSX.utils.book_append_sheet(workbook, worksheet, "Crawl Results");

                        const exportPath = path.join(process.cwd(), fileName);
                        XLSX.writeFile(workbook, exportPath);
                        console.log(`Data exported to: ${exportPath}`);
                        resolve(data);
                    } else {
                        console.error('Engine Logic Error:', result.error);
                        if (result.trace) console.error(result.trace);
                        reject(new Error(result.error));
                    }
                } catch (e) {
                    console.error('Failed to parse stdout:', stdout);
                    reject(new Error('Parse engine output failed'));
                }
            });

            child.on('error', (err) => {
                reject(err);
            });
        });

    } catch (e) {
        console.error('Crawl failed:', e);
    }
}

// 执行测试
const selectors = {
    container: "#table1 tbody tr",
    fields: {
        "标题": "td:nth-child(2) a",
        "链接": "td:nth-child(2) a::attr(href)",
        "发布日期": "td:nth-child(6)" // HTML 中发布日期是第6列 (1:序号, 2:标题, 3:mobile, 4:字号, 5:成文, 6:发布)
    }
};

crawlToExcel(
    'https://zsj.nmg.gov.cn/zwgk/zfxxgk/fdzdgknr/zfwj/',
    selectors,
    'nmg_policy_data.xlsx'
);
