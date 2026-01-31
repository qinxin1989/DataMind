/**
 * 调试河北爬虫 - 使用动态渲染
 */

import { ProvincesCrawler } from '../src/agent/skills/crawler/ProvincesCrawler';
import { getProvinceConfig } from '../src/agent/skills/crawler/provinces.config';

async function debugHebeiDynamic() {
  console.log('========================================');
  console.log('调试河北爬虫（动态渲染）');
  console.log('========================================\n');

  const config = getProvinceConfig('hebei');
  if (!config) {
    console.error('未找到河北配置');
    return;
  }

  // 强制使用动态渲染
  const modifiedConfig = {
    ...config,
    needDynamic: true
  };

  console.log('配置信息:');
  console.log(`  URL: ${config.url}`);
  console.log(`  容器: ${config.selectors.container}`);
  console.log(`  动态渲染: 是（强制）`);
  console.log('');

  const crawler = new ProvincesCrawler();
  const result = await crawler.crawlProvince(modifiedConfig, 'output');

  console.log('\n========================================');
  console.log('爬取结果');
  console.log('========================================\n');

  console.log(`成功: ${result.success}`);
  console.log(`数据量: ${result.count}`);

  if (result.success && result.data && result.data.length > 0) {
    console.log('\n前3条数据:');
    result.data.slice(0, 3).forEach((item, index) => {
      console.log(`\n[${index + 1}]`);
      for (const [key, value] of Object.entries(item)) {
        console.log(`  ${key}: ${value}`);
      }
    });

    console.log(`\n文件已保存: ${result.outputFile}`);
  } else {
    console.log(`错误: ${result.error || '未提取到数据'}`);
  }
}

debugHebeiDynamic()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('调试失败:', error);
    process.exit(1);
  });
