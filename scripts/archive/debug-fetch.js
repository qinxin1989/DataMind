const https = require('https');
const fs = require('fs');
const path = require('path');

const url = 'https://szj.hebei.gov.cn/zwgk/002004/policyInter.html';
const outputPath = path.resolve(__dirname, 'page_source.html');

const options = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
};

https.get(url, options, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log(`Redirecting to ${res.headers.location}`);
        https.get(res.headers.location, options, (res2) => {
            let data = '';
            res2.on('data', (chunk) => data += chunk);
            res2.on('end', () => {
                fs.writeFileSync(outputPath, data);
                console.log('Downloaded to', outputPath);
            });
        });
        return;
    }

    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        fs.writeFileSync(outputPath, data);
        console.log('Downloaded to', outputPath);
    });
}).on('error', (e) => {
    console.error(e);
});
