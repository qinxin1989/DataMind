
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function debugHubei() {
    const url = 'https://sjj.hubei.gov.cn/zwgk/zc/qtzdgkwj/'; // Trying the user path again but with better headers, or maybe root
    // Actually user gave: https://sjj.hubei.gov.cn/zfxxgk/zc/qtzdgkwj/
    // Let's try root and the user path.

    // Updated Attempt URL based on standard Hubei structure if possible, but let's stick to what we know + root.
    const targetUrl = 'https://sjj.hubei.gov.cn/zfxxgk/zc/qtzdgkwj/';

    console.log(`Debugging Hubei Retry: ${targetUrl}`);
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-features=site-per-process']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Referer': 'https://sjj.hubei.gov.cn/'
        });

        // Try root first to set cookies?
        try {
            await page.goto('https://sjj.hubei.gov.cn/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        } catch (e) { console.log('Root load issue', e.message); }

        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait a bit
        await new Promise(r => setTimeout(r, 5000));

        await page.screenshot({ path: path.join(__dirname, 'debug_hubei_retry.png') });
        const html = await page.content();
        fs.writeFileSync(path.join(__dirname, 'debug_hubei_retry.html'), html);
        console.log('Saved debug artifacts for Hubei Retry');

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

debugHubei();
