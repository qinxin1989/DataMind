/**
 * 调试河北爬虫
 */

import { ProvincesCrawler } from '../src/agent/skills/crawler/ProvincesCrawler';
import { getProvinceConfig } from '../src/agent/skills/crawler/provinces.config';

async function debugHebei() {
  console.log('========================================');
  console.log('调试河北爬虫');
  console.log('========================================\n');

  const config = getProvinceConfig('hebei');
  if (!config) {
    console.error('未找到河北配置');
    return;
  }

  console.log('配置信息:');
  console.log(`  名称: ${config.name}`);
  console.log(`  URL: ${config.url}`);
  console.log(`  部门: ${config.department}`);
  console.log(`  容器选择器: ${config.selectors.container}`);
  console.log(`  需要动态渲染: ${config.needDynamic ? '是' : '否'}`);
  console.log('\n字段配置:');
  for (const [name, selector] of Object.entries(config.selectors.fields)) {
    console.log(`  ${name}: ${selector}`);
  }

  console.log('\n开始爬取...\n');

  const crawler = new ProvincesCrawler();
  const result = await crawler.crawlProvince(config, 'output');

  console.log('\n========================================');
  console.log('爬取结果');
  console.log('========================================\n');

  console.log(`成功: ${result.success}`);
  console.log(`数据量: ${result.count}`);
  console.log(`错误: ${result.error || '无'}`);

  if (result.success && result.data && result.data.length > 0) {
    console.log('\n前3条数据:');
    result.data.slice(0, 3).forEach((item, index) => {
      console.log(`\n[${index + 1}]`);
      for (const [key, value] of Object.entries(item)) {
        console.log(`  ${key}: ${value}`);
      }
    });
  }

  if (result.outputFile) {
    console.log(`\n文件已保存: ${result.outputFile}`);
  }
}

debugHebei()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('调试失败:', error);
    process.exit(1);
  });
