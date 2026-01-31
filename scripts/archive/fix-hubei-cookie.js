
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const rawCookie = 'enable_924omrTVcFch=true; _trs_uv=ml0g10b1_6338_868a; _trs_ua_s_1=ml0g10b1_6338_3tvl; dataHide2=58b641eb-a7fb-4b2e-a151-42172a83b45c; Hm_lvt_a9c5fa607309cb402c31d3897ab83aa9=1769750970; HMACCOUNT=0F4851E76129724D; _trs_gv=g_ml0g10b1_6338_868a; Hm_lpvt_a9c5fa607309cb402c31d3897ab83aa9=1769751035; 924omrTVcFchP=0pnICUbXV01bF6Em7uWO1824SIfe1JqG6NFuTGjqDy5uke3b7AKWzBdFuqOFFBoBHSL3X0MCp8nyzAJgVP8mu72SMGIo2Efkzi.dFwRF0yNZYbALgeIxtyveIybVs32nq4_p.1N6e_wx1CzSAZ9fWEE1ZMexPryZuTs63J2Ebx77jejKsYvLtLroHrM1Wr6hGNGA1UJRY5hxsK4DAyawAmnywd_ZoQo4pTRkZJ8yBICSZ7t4aqDoyQnmuAGKvZtivp.fpZpgpshcCSQD5KkaIM0K5o3NX4pJ8tT9IFdlUz89nFKA3RDDYD4Nf4XbxX2VhE5aSUxtP.LKYOLEf5nEdPO9yCHeHOZqVl36DekGlSRL';

async function crawlHubeiWithCookie() {
    console.log('Crawling Hubei with provided cookies...');

    // Parse cookies
    const cookies = rawCookie.split(';').map(part => {
        const [name, value] = part.split('=').map(s => s.trim());
        return { name, value, domain: 'sjj.hubei.gov.cn', path: '/' };
    });

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.setCookie(...cookies);

        // Add headers just in case
        await page.setExtraHTTPHeaders({
            'Referer': 'https://sjj.hubei.gov.cn/zfxxgk/zc/qtzdgkwj/',
            'Cache-Control': 'max-age=0',
            'Upgrade-Insecure-Requests': '1'
        });

        const url = 'https://sjj.hubei.gov.cn/zfxxgk/zc/qtzdgkwj/';

        // Using networkidle2 to be faster, wait for DOM
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for potential list
        try {
            await page.waitForSelector('.list-right-list', { timeout: 10000 }); // Guessed selector based on other Hubei sites or standard templates
        } catch (e) {
            console.log('Specific selector wait failed, trying generic...');
        }

        // Debug screenshot
        await page.screenshot({ path: path.join(__dirname, 'debug_hubei_cookie.png') });
        const html = await page.content();
        fs.writeFileSync(path.join(__dirname, 'debug_hubei_cookie.html'), html);

        const data = await page.evaluate(() => {
            // Generalize selector finding
            const items = [];
            // Try common list patterns
            // pattern 1: ul > li > a
            const lists = document.querySelectorAll('ul li, table tr');

            lists.forEach(li => {
                const linkEl = li.querySelector('a');
                if (linkEl) {
                    const text = linkEl.innerText.trim();
                    const href = linkEl.href;
                    // Filter for likely policy items (long titles, dates)
                    if (text.length > 5 && !text.includes('首页') && !text.includes('公开指南')) {
                        // Try to find date
                        let date = '';
                        const dateEl = li.querySelector('span, td[align="center"], .date');
                        if (dateEl) date = dateEl.innerText.replace(/[\[\]]/g, '').trim();

                        items.push({
                            "标题": text,
                            "发布日期": date,
                            "链接": href
                        });
                    }
                }
            });
            return items;
        });

        console.log(`Extracted ${data.length} potential items from Hubei`);

        // Filter empty or navigation items significantly
        const validData = data.filter(d => d.标题.includes('数据') || d['发布日期'].length > 0 || d.标题.length > 10).slice(0, 50);

        const output = {
            success: true,
            data: validData,
            source: '湖北省数据局'
        };

        if (validData.length > 0) {
            fs.writeFileSync(path.join(__dirname, 'fixed_hubei.json'), JSON.stringify(output, null, 2));
            console.log('Saved fixed_hubei.json');
        } else {
            console.log('No valid data found even with cookies. Check debug_hubei_cookie.png/html');
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

crawlHubeiWithCookie();
