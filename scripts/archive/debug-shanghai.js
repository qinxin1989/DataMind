
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

async function debugShanghai() {
    const url = 'https://sdb.sh.gov.cn/';
    console.log(`Crawling ${url}...`);

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

        const html = await page.content();
        fs.writeFileSync(path.join(__dirname, `shanghai_sdb_debug.html`), html);

        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a')).map(a => ({ txt: a.innerText, href: a.href }));
        });

        console.log('--- Links ---');
        links.forEach(l => {
            if (l.txt.includes('政策') || l.txt.includes('公报') || l.txt.includes('文件')) {
                console.log(l.txt, l.href);
            }
        });

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

debugShanghai();
