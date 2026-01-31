
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import https from 'https';
import axios from 'axios';

const SITES = [
    { name: 'xinjiang', url: 'https://sfj.xinjiang.gov.cn/xjszfzj/zcwjfb/zfxxgk_cwxx.shtml' },
    { name: 'hubei', url: 'https://www.hubei.gov.cn/zwgk/zfgb/n2024/' },
    { name: 'sichuan', url: 'https://www.sc.gov.cn/10462/10464/index.shtml' },
    { name: 'guizhou', url: 'https://www.guizhou.gov.cn/zwgk/zfgz/zfgbt/' }
];

const SHANDONG_URL = 'https://www.shandong.gov.cn/col/col99805/index.html';

async function captureHtml(site: { name: string, url: string }) {
    console.log(`\n--- Debugging ${site.name} ---`);
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log(`Navigating to ${site.url}...`);
        await page.goto(site.url, { waitUntil: 'networkidle0', timeout: 45000 });

        // Wait a bit for potential JS rendering
        await new Promise(r => setTimeout(r, 5000));

        const content = await page.content();
        const filePath = path.join(process.cwd(), 'scripts', `debug_${site.name}.html`);
        fs.writeFileSync(filePath, content);
        console.log(`Saved HTML to ${filePath}`);

        // Take a screenshot to verify visual state
        const screenPath = path.join(process.cwd(), 'scripts', `debug_${site.name}.png`);
        await page.screenshot({ path: screenPath, fullPage: true });
        console.log(`Saved screenshot to ${screenPath}`);

    } catch (e: any) {
        console.error(`Error processing ${site.name}:`, e.message);
    } finally {
        await browser.close();
    }
}

async function debugShandong() {
    console.log(`\n--- Debugging Shandong (Network Layer) ---`);
    // Try axios with custom agent for TLS downgrade
    try {
        const agent = new https.Agent({
            rejectUnauthorized: false,
            // Try enabling legacy versions if needed, though exact setting depends on Node version support
            minVersion: 'TLSv1'
        });

        console.log('Attempting Axios request with loose TLS settings...');
        const resp = await axios.get(SHANDONG_URL, {
            httpsAgent: agent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        console.log(`Shandong Response Status: ${resp.status}`);
        const filePath = path.join(process.cwd(), 'scripts', `debug_shandong.html`);
        fs.writeFileSync(filePath, resp.data);
        console.log(`Saved Shandong HTML to ${filePath}`);
    } catch (e: any) {
        console.error(`Shandong Axios Error: ${e.message}`);
        if (e.code) console.error(`Error Code: ${e.code}`);
    }
}

async function run() {
    for (const site of SITES) {
        await captureHtml(site);
    }
    await debugShandong();
}

run();
