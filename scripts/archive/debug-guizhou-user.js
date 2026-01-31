
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const url = 'https://dsj.guizhou.gov.cn/zwgk/zcwj/bmwj/';

async function debugGuizhou() {
    console.log(`Debugging Guizhou (User URL): ${url}`);
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        await page.screenshot({ path: path.join(__dirname, 'debug_guizhou_user.png') });
        const html = await page.content();
        fs.writeFileSync(path.join(__dirname, 'debug_guizhou_user.html'), html);
        console.log('Saved debug artifacts for Guizhou User URL');

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

debugGuizhou();
