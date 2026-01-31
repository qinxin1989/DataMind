
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const targets = [
    {
        name: 'sichuan_prov',
        url: 'https://www.scdsjzx.cn/scdsjzx/shengshiwenjian/2601shuzifagui.shtml',
        sourceName: '四川省大数据中心-四川政策'
    },
    {
        name: 'sichuan_nat',
        url: 'https://www.scdsjzx.cn/scdsjzx/guojiazhengce/2601shuzifagui.shtml',
        sourceName: '四川省大数据中心-国家政策'
    }
];

async function crawlSichuan() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        for (const target of targets) {
            console.log(`Crawling ${target.sourceName} from ${target.url}...`);

            try {
                await page.goto(target.url, { waitUntil: 'networkidle0', timeout: 60000 });

                // Wait for list to load
                await page.waitForSelector('.list li', { timeout: 10000 }).catch(() => console.log('Timeout waiting for list selector, trying extraction anyway...'));

                const data = await page.evaluate(() => {
                    const items = document.querySelectorAll('.list li');
                    const results = [];

                    items.forEach(li => {
                        const linkEl = li.querySelector('a');
                        const titleEl = li.querySelector('.title');
                        const dateEl = li.querySelector('.date');

                        if (linkEl && titleEl) {
                            let link = linkEl.getAttribute('href');
                            if (link && !link.startsWith('http')) {
                                // Handle relative paths broadly
                                if (link.startsWith('/')) {
                                    link = window.location.origin + link;
                                } else {
                                    // simple relative handling
                                    const pathParts = window.location.pathname.split('/');
                                    pathParts.pop();
                                    link = window.location.origin + pathParts.join('/') + '/' + link;
                                }
                            }

                            results.push({
                                "标题": titleEl.innerText.trim(),
                                "发布日期": dateEl ? dateEl.innerText.trim() : '',
                                "链接": link
                            });
                        }
                    });
                    return results;
                });

                console.log(`Extracted ${data.length} items from ${target.sourceName}`);

                const output = {
                    success: true,
                    data: data,
                    source: target.sourceName
                };

                fs.writeFileSync(path.join(__dirname, `fixed_${target.name}.json`), JSON.stringify(output, null, 2));

            } catch (e) {
                console.error(`Error crawling ${target.name}:`, e);
                fs.writeFileSync(path.join(__dirname, `fixed_${target.name}.json`), JSON.stringify({ success: false, error: e.message }, null, 2));
            }
        }

    } catch (e) {
        console.error('Browser error:', e);
    } finally {
        await browser.close();
    }
}

crawlSichuan();
