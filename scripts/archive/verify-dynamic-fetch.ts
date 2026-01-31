
const { DynamicEngine } = require('../src/agent/skills/crawler/dynamic_engine');

async function test() {
    const url = 'https://szj.hebei.gov.cn/zwgk/002004/policyInter.html';
    console.log('Testing Dynamic Engine for:', url);

    try {
        const html = await DynamicEngine.fetchHtml(url, '#resultlist tr'); // Wait for table rows
        console.log('Fetch complete. Length:', html.length);

        // Check for specific content visible in screenshot but missing in static source
        const keywords = ['关于印发', '发布日期', '河北省信用信息资源目录'];
        const found = keywords.filter(k => html.includes(k));

        console.log('Keywords found:', found);

        if (found.length > 0) {
            console.log('SUCCESS: Dynamic content loaded!');
        } else {
            console.log('FAILURE: Keywords not found.');
        }

        // Check tbody content
        if (html.includes('<tbody class="ewb-look-tbody" id="resultlist">') && html.includes('<tr>')) {
            console.log('Table rows detected.');
        }

    } catch (e) {
        console.error('Test failed:', e);
    }
}

test();
