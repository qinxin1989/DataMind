import { DynamicEngine } from "../src/agent/skills/crawler/dynamic_engine";
import fs from "fs";
import path from "path";

async function getHtml(url: string, fileName: string) {
    console.log(`--- Fetching: ${url} ---`);
    try {
        const html = await DynamicEngine.fetchHtml(url);
        fs.writeFileSync(path.join("scripts", fileName), html);
        console.log(`Saved to ${fileName}`);
    } catch (e) {
        console.error(`Failed: ${e}`);
    }
}

async function run() {
    await getHtml('https://www.hubei.gov.cn/zwgk/hbgp/', 'hubei_gazette.html');
    await getHtml('https://www.zj.gov.cn/col/col1229019364/index.html', 'zhejiang_list.html');
    await getHtml('https://www.gd.gov.cn/zwgk/gongbao/', 'guangdong_gazette.html');
    await getHtml('https://www.guizhou.gov.cn/zwgk/zfgz/zfgbt/', 'guizhou_gazette.html');
    await getHtml('https://www.sc.gov.cn/10462/15088/index.shtml', 'sichuan_gazette.html');
    await getHtml('https://www.xinjiang.gov.cn/xinjiang/zfwj/zfwj_list.shtml', 'xinjiang_list.html');
    await getHtml('http://www.shandong.gov.cn/zwgk/zfwj/', 'shandong_http.html');
}

run();
