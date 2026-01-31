
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const XLSX = require('xlsx');

async function testLocal() {
    const htmlPath = path.join(__dirname, 'nmg_full.html');
    const url = 'https://zsj.nmg.gov.cn/zwgk/zfxxgk/fdzdgknr/zfwj/';
    const pythonPath = "f:\\Project\\ai-data-platform\\.venv\\Scripts\\python.exe";
    const enginePath = path.join(process.cwd(), 'src/agent/skills/crawler/engine.py');

    const selectors = {
        container: "#table1 tbody tr",
        fields: {
            "标题": "td:nth-child(2) a",
            "链接": "td:nth-child(2) a::attr(href)",
            "发布日期": "td:nth-child(6)"
        }
    };

    const selectorsStr = JSON.stringify(selectors);
    const args = [enginePath, htmlPath, selectorsStr, url];

    console.log('Running engine on local HTML...');
    const child = spawn(pythonPath, args);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => stdout += data.toString());
    child.stderr.on('data', (data) => stderr += data.toString());

    child.on('close', (code) => {
        if (code !== 0) {
            console.error('Python Error:', stderr);
            return;
        }

        try {
            const result = JSON.parse(stdout);
            if (result.success) {
                const data = result.data || [];
                console.log(`Extracted ${data.length} rows.`);
                console.log('First row sample:', data[0]);

                if (data.length > 0) {
                    const workbook = XLSX.utils.book_new();
                    const worksheet = XLSX.utils.json_to_sheet(data);
                    XLSX.utils.book_append_sheet(workbook, worksheet, "Results");
                    const exportPath = path.join(process.cwd(), 'nmg_test_fixed.xlsx');
                    XLSX.writeFile(workbook, exportPath);
                    console.log('Success! Saved to nmg_test_fixed.xlsx');
                }
            } else {
                console.error('Logic Error:', result.error);
            }
        } catch (e) {
            console.error('Parse Error:', e.message);
            console.log('Raw output:', stdout);
        }
    });
}

testLocal();
