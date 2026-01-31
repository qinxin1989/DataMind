/**
 * 测试 Python 爬虫引擎调用
 */

const { spawn } = require('child_process');
const path = require('path');

const pythonPath = path.join(process.cwd(), '.venv', 'Scripts', 'python.exe');
const enginePath = path.join(process.cwd(), 'src', 'agent', 'skills', 'crawler', 'engine.py');

const testUrl = 'https://www.nda.gov.cn/sjj/zwgk/zcfb/list/index_pc_1.html';
const selectors = {
    container: 'ul.u-list > li',
    fields: {
        '标题': 'a',
        '链接': 'a::attr(href)',
        '发布日期': 'span'
    }
};

console.log('测试 Python 爬虫引擎调用...\n');
console.log('Python 路径:', pythonPath);
console.log('引擎路径:', enginePath);
console.log('测试 URL:', testUrl);
console.log('\n开始执行...\n');

const args = [
    enginePath,
    testUrl,
    JSON.stringify(selectors),
    ''
];

const pythonProcess = spawn(pythonPath, args, {
    cwd: process.cwd(),
    windowsHide: true
});

let stdout = '';
let stderr = '';

pythonProcess.stdout.on('data', (data) => {
    stdout += data.toString();
});

pythonProcess.stderr.on('data', (data) => {
    stderr += data.toString();
    console.error('Python stderr:', data.toString());
});

pythonProcess.on('close', (code) => {
    console.log(`\nPython 进程退出，代码: ${code}\n`);
    
    if (code !== 0) {
        console.error('执行失败！');
        console.error('错误输出:', stderr);
        process.exit(1);
    }

    try {
        const result = JSON.parse(stdout);
        console.log('执行成功！');
        console.log('结果:', JSON.stringify(result, null, 2));
        
        if (result.success) {
            console.log(`\n✓ 成功抓取 ${result.count} 条数据`);
        } else {
            console.log('\n✗ 抓取失败:', result.error);
        }
    } catch (e) {
        console.error('解析输出失败:', e.message);
        console.error('原始输出:', stdout);
        process.exit(1);
    }
});

pythonProcess.on('error', (error) => {
    console.error('启动 Python 失败:', error.message);
    process.exit(1);
});
