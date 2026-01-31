
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio'); // Use cheerio for static HTML parsing since we have the HTML

async function crawlNMG() {
    const url = 'https://zsj.nmg.gov.cn/zwgk/zfxxgk/fdzdgknr/zfwj/';
    console.log(`Crawling Inner Mongolia: ${url}`);

    // Since we have confirmed the HTML structure is static-ish (from debug_nmg.html), 
    // we can use Puppeteer to get content and Cheerio to parse, or just Puppeteer evaluation.
    // Given the previous debug success, Puppeteer evaluation is safest.

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

        const data = await page.evaluate(() => {
            const rows = document.querySelectorAll('#table1 tbody tr');
            const results = [];

            rows.forEach(tr => {
                const linkEl = tr.querySelector('td:nth-child(2) a');
                const title = linkEl ? linkEl.innerText.trim() : '';
                const link = linkEl ? linkEl.href : '';

                // Date is usually in the last column or second to last
                // Checking debug_nmg.html: <th class="th4">发布日期</th> is the 5th column index 4 (0-indexed)
                // The tds in body: <td>...</td> ... <td>2025-07-28</td> (5th td)
                const dateEl = tr.querySelector('td:nth-child(5)');
                const date = dateEl ? dateEl.innerText.trim() : '';

                if (title && link) {
                    results.push({
                        "标题": title,
                        "发布日期": date,
                        "链接": link
                    });
                }
            });
            return results;
        });

        console.log(`Extracted ${data.length} items from Inner Mongolia`);

        const output = {
            success: true,
            data: data,
            source: '内蒙古自治区政务服务与数据管理局'
        };

        fs.writeFileSync(path.join(__dirname, 'fixed_nmg.json'), JSON.stringify(output, null, 2));

    } catch (e) {
        console.error('Error crawling NMG:', e);
    } finally {
        await browser.close();
    }
}

crawlNMG();
