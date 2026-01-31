
import { DynamicEngine } from '../src/agent/skills/crawler/dynamic_engine';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import * as XLSX from 'xlsx';

async function crawlSite(url: string, selectors: any, fileName: string) {
    console.log(`\n--- Testing Site: ${url} ---`);
    try {
        const html = await (DynamicEngine as any).fetchHtml(url);
        const tempPath = path.join(process.cwd(), `temp_${path.basename(fileName, '.xlsx')}.html`);
        fs.writeFileSync(tempPath, html);

        const pythonPath = "f:\\Project\\ai-data-platform\\.venv\\Scripts\\python.exe";
        const enginePath = path.join(process.cwd(), 'src/agent/skills/crawler/engine.py');
        const selectorsStr = JSON.stringify(selectors);

        return new Promise((resolve) => {
            const args = [enginePath, tempPath, selectorsStr, url];
            const child = spawn(pythonPath, args);
            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => stdout += data.toString());
            child.stderr.on('data', (data) => stderr += data.toString());

            child.on('close', (code) => {
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                if (code !== 0) {
                    console.error('Python Error:', stderr);
                    return resolve(null);
                }

                try {
                    const result = JSON.parse(stdout);
                    if (result.success && result.data && result.data.length > 0) {
                        const data = result.data;
                        console.log(`Successfully extracted ${data.length} rows.`);
                        const workbook = XLSX.utils.book_new();
                        const worksheet = XLSX.utils.json_to_sheet(data);
                        XLSX.utils.book_append_sheet(workbook, worksheet, "Results");
                        XLSX.writeFile(workbook, path.join(process.cwd(), fileName));
                        console.log(`Saved to ${fileName}`);
                        resolve(data);
                    } else {
                        console.warn('No data extracted or logic error:', result.error || 'Empty data');
                        console.log('Engine Result:', JSON.stringify(result, null, 2));
                        resolve(null);
                    }
                } catch (e: any) {
                    console.error('Parse Error:', e.message);
                    resolve(null);
                }
            });
        });
    } catch (e: any) {
        console.error('Fetch Failed:', e.message);
        return null;
    }
}

async function runBatch() {
    // 9. 安徽 (sjzyj.ah.gov.cn)
    await crawlSite(
        'https://sjzyj.ah.gov.cn/xwdt/sjdt/index.html',
        {
            container: "ul.doc_list li:not(.lm_line)",
            fields: {
                "标题": "a",
                "链接": "a::attr(href)",
                "发布日期": "span.right.date"
            }
        },
        'batch_9_anhui.xlsx'
    );

    // 10. 福建 (fgw.fujian.gov.cn)
    await crawlSite(
        'https://fgw.fujian.gov.cn/ztzl/szfjzt/zcwj/',
        {
            container: ".list_base li",
            fields: {
                "标题": "a",
                "链接": "a::attr(href)",
                "发布日期": "span"
            }
        },
        'batch_10_fujian.xlsx'
    );

    // 11. 湖南 (hunan.gov.cn)
    await crawlSite(
        'https://www.hunan.gov.cn/topic/hnsz/szzcwj/szsjzc/index.html',
        {
            container: ".fg_cont_box li",
            fields: {
                "标题": "a",
                "链接": "a::attr(href)",
                "发布日期": ".date span"
            }
        },
        'batch_11_hunan.xlsx'
    );

    // 12. 重庆 (cq.gov.cn)
    await crawlSite(
        'https://dsjj.cq.gov.cn/zwgk_533/zcwj/zcqtwj/',
        {
            container: ".tab-item li",
            fields: {
                "标题": "a",
                "链接": "a::attr(href)",
                "发布日期": "span"
            }
        },
        'batch_12_chongqing.xlsx'
    );
}

runBatch();
