
const { DynamicEngine } = require('../src/agent/skills/crawler/dynamic_engine');

async function test() {
    const url = 'https://zsj.nmg.gov.cn/zwgk/zfxxgk/fdzdgknr/zfwj/';
    console.log('Testing Dynamic Engine for:', url);

    try {
        const html = await DynamicEngine.fetchHtml(url);
        console.log('Fetch complete. Length:', html.length);

        // Check if it's a list page
        if (html.includes('<li>') || html.includes('tr')) {
            console.log('Detected list items (li or tr).');
        } else {
            console.log('WARNING: No common list items found.');
        }

        // Output a snippet of the body to see what's there
        const bodyStart = html.indexOf('<body');
        console.log('Body snippet:', html.substring(bodyStart, bodyStart + 1000));

    } catch (e) {
        console.error('Test failed:', e);
    }
}

test();
