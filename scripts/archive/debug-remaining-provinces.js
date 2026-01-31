
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const sites = [
    { name: 'hubei', url: 'https://sjj.hubei.gov.cn/zfxxgk/zc/qtzdgkwj/' },
    { name: 'guizhou', url: 'https://www.guizhou.gov.cn/zwgk/zfgz/zfgz/' },
    { name: 'nmg', url: 'https://zsj.nmg.gov.cn/zwgk/zfxxgk/fdzdgknr/zfwj/' }
];

async function debugProvinces() {
    console.log('Starting debug for remaining provinces...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors', '--disable-web-security']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        for (const site of sites) {
            console.log(`Debugging ${site.name}: ${site.url}`);
            try {
                await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                // wait a bit for dynamic content
                await new Promise(r => setTimeout(r, 5000));

                // Screenshot
                await page.screenshot({ path: path.join(__dirname, `debug_${site.name}.png`) });

                // HTML
                const html = await page.content();
                fs.writeFileSync(path.join(__dirname, `debug_${site.name}.html`), html);

                console.log(`Saved debug artifacts for ${site.name}`);
            } catch (e) {
                console.error(`Failed to debug ${site.name}:`, e.message);
            }
        }

    } catch (e) {
        console.error('Browser error:', e);
    } finally {
        await browser.close();
        console.log('Debug complete.');
    }
}

debugProvinces();
