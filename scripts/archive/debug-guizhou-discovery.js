
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const targets = [
    { name: 'guizhou_home', url: 'http://dsj.guizhou.gov.cn/' },
    { name: 'hubei_home', url: 'https://jxt.hubei.gov.cn/' } // Try Dept of Economy and IT (often handles big data) or verify Data Bureau
];
// Note: Hubei Data Bureau might be under a different domain or integrated. Searching for "湖北省数据局" might be needed.
// Let's also try searching for Hubei Data Bureau URL via puppeteer google search if needed, but for now let's probe known potential bases.
// Actually, let's just probe Guizhou home for now and retry Hubei search.

async function discoverUrls() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors', '--disable-web-security']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Guizhou Discovery
        console.log('Discovering Guizhou...');
        try {
            await page.goto('http://dsj.guizhou.gov.cn/', { waitUntil: 'networkidle0', timeout: 30000 });
            const gzHtml = await page.content();
            fs.writeFileSync(path.join(__dirname, 'guizhou_home.html'), gzHtml);

            const gzLinks = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('a'))
                    .map(a => ({ text: a.innerText.trim(), href: a.href }))
                    .filter(l => l.text.includes('政策') || l.text.includes('法规') || l.text.includes('文件'));
            });
            console.log('Guizhou Candidates:', gzLinks);
            fs.writeFileSync(path.join(__dirname, 'guizhou_discovery.json'), JSON.stringify(gzLinks, null, 2));

        } catch (e) {
            console.error('Guizhou discovery failed:', e.message);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

discoverUrls();
