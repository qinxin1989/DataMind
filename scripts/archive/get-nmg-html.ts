
const { DynamicEngine } = require('../src/agent/skills/crawler/dynamic_engine');
const fs = require('fs');
const path = require('path');

async function test() {
    const args = process.argv.slice(2);
    const url = args.includes('--url') ? args[args.indexOf('--url') + 1] : 'https://zsj.nmg.gov.cn/zwgk/zfxxgk/fdzdgknr/zfwj/';
    const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : path.join(__dirname, 'nmg_full.html');

    console.log('Fetching full HTML for:', url);

    try {
        const html = await DynamicEngine.fetchHtml(url);
        fs.writeFileSync(out, html);
        console.log('Full HTML saved to:', out);
        console.log('HTML Length:', html.length);
    } catch (e) {
        console.error('Fetch failed:', e);
    }
}

test();
