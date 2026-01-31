
import puppeteer from 'puppeteer';
const cheerio = require('cheerio');
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import * as util from 'util';

const execPromise = util.promisify(exec);

async function crawlSite(url: string, selectors: any, name: string, headers: any = {}) {
    console.log(`\n--- Crawling ${name} ---`);
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
    });

    try {
        const page = await browser.newPage();

        // Anti-detect
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        if (Object.keys(headers).length > 0) {
            await page.setExtraHTTPHeaders(headers);
        }

        console.log(`Navigating to ${url}...`);
        try {
            await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
        } catch (e) {
            console.warn(`Navigation timeout or error, trying to verify content...`);
        }

        // Wait for specific selectors if provided
        // Hubei needs some time?
        await new Promise(r => setTimeout(r, 5000));

        const html = await page.content();
        fs.writeFileSync(path.join(__dirname, `${name}_debug.html`), html);

        const $ = cheerio.load(html);
        const data: any[] = [];

        if (selectors.container) {
            $(selectors.container).each((i, el) => {
                const item: any = {};
                // Handle different selector types
                for (const [key, sel] of Object.entries(selectors.fields)) {
                    // Try to find element
                    let $el = $(el).find(sel as string);
                    if ($el.length === 0 && (sel as string).includes(':')) {
                        // Handle pseudo-selectors simply if possible or ignore
                    }

                    if (key.includes('链接')) {
                        item[key] = $el.attr('href') || '';
                        // Resolve relative URLs
                        if (item[key] && !item[key].startsWith('http')) {
                            item[key] = new URL(item[key], url).href;
                        }
                    } else {
                        item[key] = $el.text().trim();
                    }
                }
                // Filter empty items
                if (item['标题']) data.push(item);
            });
        }

        console.log(`Success ${name}: found ${data.length} items`);
        const result = { success: true, data, count: data.length };
        fs.writeFileSync(path.join(__dirname, `${name}.json`), JSON.stringify(result, null, 2));

    } catch (e: any) {
        console.error(`Error ${name}:`, e.message);
        fs.writeFileSync(path.join(__dirname, `${name}.json`), JSON.stringify({ success: false, error: e.message }, null, 2));
    } finally {
        await browser.close();
    }
}

async function tryCurlShandong() {
    console.log('\n--- Curl Shandong ---');
    try {
        // cmd /c to ensure we use system curl
        const { stdout, stderr } = await execPromise('cmd /c curl -k -v -A "Mozilla/5.0" "https://www.shandong.gov.cn/col/col99805/index.html"');
        console.log('Curl success (length):', stdout.length);
        fs.writeFileSync(path.join(__dirname, `shandong_curl.html`), stdout);
    } catch (e: any) {
        console.error('Curl failed:', e.message);
        if (e.stderr) console.error('Stderr:', e.stderr); // curl -v writes to stderr
    }
}

async function run() {
    // 1. Xinjiang (Fixed Selector: #wzlm dd)
    await crawlSite(
        'https://sfj.xinjiang.gov.cn/xjszfzj/zcwjfb/zfxxgk_cwxx.shtml',
        {
            container: "#wzlm dd",
            fields: {
                "标题": "a",
                "链接": "a",
                "发布日期": "span"
            }
        },
        'fixed_xinjiang'
    );

    // 2. Sichuan (Fixed Selector: .comul.on li)
    await crawlSite(
        'https://www.sc.gov.cn/10462/10464/index.shtml',
        {
            container: ".con1leftul .comul.on li",
            fields: {
                "标题": "a",
                "链接": "a",
                "发布日期": "span"
            }
        },
        'fixed_sichuan'
    );

    // 3. Hubei (Headers + Root Dir)
    // Try the directory that usually works: zwgk/zfgb/
    await crawlSite(
        'https://www.hubei.gov.cn/zwgk/zfgb/',
        {
            container: "ul.list-box li", // Based on common gov patterns 
            fields: {
                "标题": "a",
                "链接": "a",
                "发布日期": "span"
            }
        },
        'fixed_hubei',
        {
            'Referer': 'https://www.hubei.gov.cn/',
            'Cookie': 'wzws_cid=CHECK_IF_NEEDED' // Sometimes needed, but referer is safer first step
        }
    );

    // 4. Guizhou (Entry Discovery - Manual Logic in Crawler)
    // Since we don't have a direct URL, we try the main GK page
    await crawlSite(
        'https://www.guizhou.gov.cn/zwgk/',
        {
            container: "a[href*='zfgb'], a:contains('公报')", // Try to find link to Gazette
            fields: {
                "标题": "a", // self
                "链接": "a"  // self
            }
        },
        'guizhou_discovery'
    );

    // 5. Shandong Curl
    await tryCurlShandong();
}

run();
