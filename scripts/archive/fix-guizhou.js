
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function crawlGuizhou() {
    const url = 'https://dsj.guizhou.gov.cn/zwgk/zcwj/bmwj/';
    console.log(`Crawling Guizhou: ${url}`);

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors', '--disable-web-security']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        // Wait for list
        await page.waitForSelector('.NewsList li', { timeout: 10000 }).catch(() => console.log('Wait for .NewsList li timeout'));

        const data = await page.evaluate(() => {
            const items = document.querySelectorAll('.NewsList li');
            const results = [];

            items.forEach(li => {
                // Check if it's a valid item (some might be empty or dividers)
                if (li.className && li.className.includes('b')) return; // skip divider lines if class='b'

                const linkEl = li.querySelector('a');
                const dateEl = li.querySelector('span');

                if (linkEl) {
                    const title = linkEl.innerText.trim();
                    const date = dateEl ? dateEl.innerText.trim() : '';
                    let link = linkEl.href;

                    if (title) {
                        results.push({
                            "标题": title,
                            "发布日期": date,
                            "链接": link
                        });
                    }
                }
            });
            return results;
        });

        console.log(`Extracted ${data.length} items from Guizhou`);

        const output = {
            success: true,
            data: data,
            source: '贵州省大数据发展管理局'
        };

        fs.writeFileSync(path.join(__dirname, 'fixed_guizhou.json'), JSON.stringify(output, null, 2));

    } catch (e) {
        console.error('Error crawling Guizhou:', e);
    } finally {
        await browser.close();
    }
}

crawlGuizhou();
