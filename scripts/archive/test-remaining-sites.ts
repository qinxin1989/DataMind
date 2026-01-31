import { DynamicEngine } from '../src/agent/skills/crawler/dynamic_engine';
import * as fs from 'fs';
import { execSync } from 'child_process';

async function crawlSite(url: string, selectors: any, fileName: string) {
    console.log(`\n--- Crawling: ${url} ---`);
    try {
        const html = await DynamicEngine.fetchHtml(url);
        fs.writeFileSync('temp_test.html', html);

        // 调用 python 解析
        const selectorJson = JSON.stringify(selectors).replace(/"/g, '\\"');
        const command = `python f:\\Project\\ai-data-platform\\src\\agent\\skills\\crawler\\engine.py "temp_test.html" "${selectorJson}"`;
        const result = execSync(command, { encoding: 'utf8' });
        console.log(`Result for ${fileName}:`, result);

        // 如果有数据，保存到文件
        if (result.includes('[') && result.length > 10) {
            fs.writeFileSync(`scripts/${fileName}.json`, result);
        }
    } catch (error) {
        console.error(`Failed to crawl ${url}:`, error);
    }
}

async function runBatch() {
    // 1. 广东 (Confirmed)
    await crawlSite(
        'https://www.gd.gov.cn/zwgk/gongbao/',
        {
            container: "ul.list li",
            fields: {
                "标题": "a",
                "链接": "a",
                "发布日期": "span.time"
            }
        },
        'test_guangdong'
    );

    // 2. 浙江 (Confirmed selectors)
    await crawlSite(
        'https://www.zj.gov.cn/col/col1229019364/index.html',
        {
            container: "div.fg_list",
            fields: {
                "标题": ".fg_list_2 a",
                "链接": ".fg_list_2 a",
                "发布日期": ".fg_list_5"
            }
        },
        'test_zhejiang'
    );

    // 3. 湖北 (Target specific column to avoid empty)
    await crawlSite(
        'https://www.hubei.gov.cn/zwgk/zfgb/n2024/',
        {
            container: "table.list-table tr, ul.list-box li",
            fields: {
                "标题": "a",
                "链接": "a",
                "发布日期": "td:nth-last-child(1), span"
            }
        },
        'final_hubei'
    );

    // 4. 贵州 (Try common pattern)
    await crawlSite(
        'https://www.guizhou.gov.cn/zwgk/zfgz/zfgbt/',
        {
            container: "table tr, ul.list li",
            fields: {
                "标题": "a",
                "链接": "a",
                "发布日期": "td, span"
            }
        },
        'final_guizhou'
    );

    // 5. 四川 (Verified)
    await crawlSite(
        'https://www.sc.gov.cn/10462/10464/index.shtml',
        {
            container: "ul.list li, div.list-item",
            fields: {
                "标题": "a",
                "链接": "a",
                "发布日期": "span"
            }
        },
        'final_sichuan'
    );

    // 6. 新疆 (Adjusted for digital bureau style)
    await crawlSite(
        'https://sfj.xinjiang.gov.cn/xjszfzj/zcwjfb/zfxxgk_cwxx.shtml',
        {
            container: "table tr, ul.list li",
            fields: {
                "标题": "a",
                "链接": "a",
                "发布日期": "td:nth-last-child(1), span"
            }
        },
        'final_xinjiang'
    );

    // 7. 山东 (HTTP downgrade attempt)
    await crawlSite(
        'http://www.shandong.gov.cn/col/col99805/index.html',
        {
            container: "ul.list li, div.infocard",
            fields: {
                "标题": "a",
                "链接": "a",
                "发布日期": "span"
            }
        },
        'final_shandong'
    );
}

runBatch();
