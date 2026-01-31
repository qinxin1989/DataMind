
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function debugSichuan() {
    const url = 'http://www.scdsjzx.cn/';
    console.log(`Crawling ${url}...`);

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors', '--disable-web-security']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

        const html = await page.content();
        fs.writeFileSync(path.join(__dirname, `sichuan_dsj_debug.html`), html);

        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a')).map(a => ({
                text: a.innerText.trim(),
                href: a.href
            }));
        });

        console.log('--- Potential Policy Links ---');
        links.forEach(l => {
            if (l.text.includes('政策') || l.text.includes('法规') || l.text.includes('文件') || l.text.includes('公开')) {
                console.log(`${l.text} -> ${l.href}`);
            }
        });

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

debugSichuan();
