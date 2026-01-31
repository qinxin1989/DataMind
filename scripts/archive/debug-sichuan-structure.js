
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function analyzeSichuanStructure() {
    const urls = [
        'https://www.scdsjzx.cn/scdsjzx/shengshiwenjian/2601shuzifagui.shtml',
        'https://www.scdsjzx.cn/scdsjzx/guojiazhengce/2601shuzifagui.shtml'
    ];

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        for (const url of urls) {
            console.log(`Analyzing: ${url}`);
            await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

            // Take screenshot
            const name = url.includes('shengshi') ? 'sichuan_prov' : 'sichuan_nat';
            await page.screenshot({ path: path.join(__dirname, `${name}_debug.png`) });

            // Analyze DOM
            const structure = await page.evaluate(() => {
                // Try to find list items
                const candidates = [];
                const lists = document.querySelectorAll('ul, div.list, table');

                lists.forEach((list, i) => {
                    const items = list.querySelectorAll('li, tr, div.item');
                    if (items.length > 3) {
                        const firstItem = items[0];
                        const link = firstItem.querySelector('a');
                        const date = firstItem.innerText.match(/\d{4}-\d{2}-\d{2}/)
                            || firstItem.querySelector('span');

                        if (link) {
                            candidates.push({
                                index: i,
                                tag: list.tagName,
                                class: list.className,
                                itemCount: items.length,
                                firstItemText: firstItem.innerText.replace(/\s+/g, ' ').substring(0, 50),
                                exampleLink: link.href,
                                itemHtml: firstItem.outerHTML.substring(0, 150)
                            });
                        }
                    }
                });
                return candidates;
            });

            console.log(`Structure for ${name}:`);
            console.log(JSON.stringify(structure, null, 2));
        }

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

analyzeSichuanStructure();
