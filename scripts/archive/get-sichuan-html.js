
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto('https://www.scdsjzx.cn/scdsjzx/shengshiwenjian/2601shuzifagui.shtml', { waitUntil: 'networkidle0' });
    const html = await page.content();
    fs.writeFileSync(path.join(__dirname, 'sichuan_policy.html'), html);
    await browser.close();
})();
