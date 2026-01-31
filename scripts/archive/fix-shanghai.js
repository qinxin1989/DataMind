

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function crawlShanghai() {
    const url = 'https://sdb.sh.gov.cn/zcwj/index.html'; // Try /zcwj/ or /zcwj/index.html
    console.log(`\n--- Crawling Shanghai (SDB) ---`);

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

        // Wait for potential rendering
        await new Promise(r => setTimeout(r, 3000));

        const data = await page.evaluate(() => {
            const results = [];
            const links = document.querySelectorAll('a');
            const seen = new Set();

            links.forEach(link => {
                const href = link.href;
                if (!href || seen.has(href)) return;

                // Filter irrelevant links
                if (!href.includes('html') && !href.includes('zcwj')) return;
                if (href.includes('index.html') && !href.includes('content')) return; // skip index pages unless content

                const title = link.innerText.trim() || link.title;
                if (!title || title.length < 5) return; // skip short links

                // Find date in parent or siblings
                // Look up 3 levels
                let container = link.parentElement;
                let dateStr = '';

                for (let i = 0; i < 3; i++) {
                    if (!container) break;
                    const text = container.innerText.replace(/\s+/g, ' ');

                    // 1. Look for YYYY-MM and DD split
                    const ymMatch = text.match(/(\d{4}-\d{2})/);
                    if (ymMatch) {
                        if (/\d{4}-\d{2}-\d{2}/.test(text)) {
                            dateStr = text.match(/(\d{4}-\d{2}-\d{2})/)[1];
                            break;
                        } else {
                            // Split date logic
                            // Heuristic: container text has YYYY-MM ... DD or DD ... YYYY-MM
                            // We found YYYY-MM, let's look for DD in the SAME container text
                            const parts = text.split(' ');
                            for (const p of parts) {
                                if (/^\d{2}$/.test(p)) {
                                    // Ensure it's not part of the year (basic check)
                                    if (!ymMatch[1].includes(p)) {
                                        dateStr = `${ymMatch[1]}-${p}`;
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    if (dateStr) break;
                    container = container.parentElement;
                }

                if (dateStr && title) {
                    seen.add(href);
                    results.push({
                        "标题": title,
                        "链接": href,
                        "发布日期": dateStr
                    });
                }
            });
            return results;
        });

        console.log(`Shanghai Found ${data.length} items`);
        if (data.length > 0) {
            console.log('Sample:', data[0]);
        }

        const result = { success: true, data, count: data.length };
        // We will output to a specific file for Shanghai
        // Note: fs is not available in browser context, so we do it here
        return result;

    } catch (e) {
        console.error(`Error Shanghai:`, e.message);
        return { success: false, error: e.message };
    } finally {
        await browser.close();
    }
}

async function run() {
    const result = await crawlShanghai();
    fs.writeFileSync(path.join(__dirname, `fixed_shanghai.json`), JSON.stringify(result, null, 2));
}

run();
