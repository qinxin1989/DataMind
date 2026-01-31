
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = 'https://sjj.hubei.gov.cn/zfxxgk/zc/qtzdgkwj/';

function crawlHubeiSimple() {
    console.log(`Fetching Hubei (Simple HTTPS): ${url}`);

    const options = {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }
    };

    https.get(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log(`Fetch complete. Status: ${res.statusCode}. Length: ${data.length}`);
            fs.writeFileSync(path.join(__dirname, 'debug_hubei_simple.html'), data);

            // Basic regex extraction if successful
            if (data.length > 1000) {
                // Try to look for list items roughly
                // Typical pattern: <a href="..." ...>Title</a> ... <span ...>Date</span>
                // Using simple regex for now to verify content availability
                const titleMatch = data.match(/<a[^>]+>([^<]+政策[^<]*)<\/a>/);
                if (titleMatch) {
                    console.log('Found potential title:', titleMatch[1]);
                }
            } else {
                console.log('Content too short, likely failed.');
            }
        });
    }).on('error', (e) => {
        console.error('Fetch error:', e);
    });
}

crawlHubeiSimple();
