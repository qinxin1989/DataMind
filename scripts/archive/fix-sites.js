
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

async function crawlSite(url, selectors, name, headers = {}) {
    console.log(`\n--- Crawling ${name} ---`);
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors', '--disable-web-security']
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

        // Wait a bit
        await new Promise(r => setTimeout(r, 5000));

        const html = await page.content();
        fs.writeFileSync(path.join(__dirname, `${name}_debug.html`), html);

        const $ = cheerio.load(html);
        const data = [];

        if (selectors.container) {
            $(selectors.container).each((i, el) => {
                const item = {};
                for (const [key, sel] of Object.entries(selectors.fields)) {
                    let $el = $(el).find(sel);

                    if (key.includes('链接')) {
                        item[key] = $el.attr('href') || '';
                        if (item[key] && !item[key].startsWith('http')) {
                            // Simple relative resolution
                            try {
                                item[key] = new URL(item[key], url).href;
                            } catch (e) { }
                        }
                    } else {
                        item[key] = $el.text().trim();
                    }
                }
                if (item['标题']) data.push(item);
            });
        }

        console.log(`Success ${name}: found ${data.length} items`);
        const result = { success: true, data, count: data.length };
        fs.writeFileSync(path.join(__dirname, `${name}.json`), JSON.stringify(result, null, 2));

    } catch (e) {
        console.error(`Error ${name}:`, e.message);
        fs.writeFileSync(path.join(__dirname, `${name}.json`), JSON.stringify({ success: false, error: e.message }, null, 2));
    } finally {
        await browser.close();
    }
}

async function tryCurlShandong() {
    console.log('\n--- Curl Shandong ---');
    try {
        const { stdout, stderr } = await execPromise('cmd /c curl -k -v -A "Mozilla/5.0" "https://www.shandong.gov.cn/col/col99805/index.html"');
        console.log('Curl success (length):', stdout.length);
        fs.writeFileSync(path.join(__dirname, `shandong_curl.html`), stdout);
    } catch (e) {
        console.error('Curl failed:', e.message);
    }
}

async function run() {
    // 1. Xinjiang
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

    // 2. Sichuan
    await crawlSite(
        'https://www.sc.gov.cn/10462/10464/index.shtml',
        {
            container: ".con1leftul .comul:not([style*='display: none']) li",
            fields: {
                "标题": "a",
                "链接": "a",
                "发布日期": "span"
            }
        },
        'fixed_sichuan'
    );

    // 3. Hubei
    await crawlSite(
        'https://www.hubei.gov.cn/zwgk/zfgb/',
        {
            container: "ul.list-box li",
            fields: {
                "标题": "a",
                "链接": "a",
                "发布日期": "span"
            }
        },
        'fixed_hubei',
        {
            'Referer': 'https://www.hubei.gov.cn/',
            'Upgrade-Insecure-Requests': '1'
        }
    );

    // 4. Guizhou Discovery
    await crawlSite(
        'https://www.guizhou.gov.cn/zwgk/',
        {
            container: "a", // All links
            fields: {
                "标题": "self",
                "链接": "href"
            }
        },
        'guizhou_discovery' // Will analyze manually
    );

    // 5. Shandong Curl
    await tryCurlShandong();
}

run();
