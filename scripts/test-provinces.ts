/**
 * 省份爬虫批量测试脚本
 * 使用统一的配置和工具进行批量测试
 */

import { ProvincesCrawler } from '../src/agent/skills/crawler/ProvincesCrawler';
import { PROVINCE_CONFIGS } from '../src/agent/skills/crawler/provinces.config';

const crawler = new ProvincesCrawler();

/**
 * 测试单个省份
 */
async function testSingleProvince(code: string) {
  const config = PROVINCE_CONFIGS.find(p => p.code === code);
  if (!config) {
    console.error(`未找到省份配置: ${code}`);
    return;
  }

  const result = await crawler.crawlProvince(config, 'output');

  if (result.success) {
    console.log(`✓ ${result.province} 成功: ${result.count} 条数据`);
    console.log(`  文件: ${result.outputFile}`);
  } else {
    console.error(`✗ ${result.province} 失败: ${result.error}`);
  }
}

/**
 * 测试多个指定省份
 */
async function testMultipleProvinceCodes(codes: string[]) {
  console.log(`开始测试 ${codes.length} 个省份...\n`);
  const results = await crawler.crawlMultiple(codes, 'output');
  crawler.generateSummary(results);
}

/**
 * 测试所有省份
 */
async function testAllProvinces() {
  console.log(`开始测试所有 ${PROVINCE_CONFIGS.length} 个省份...\n`);
  const results = await crawler.crawlAll('output');
  crawler.generateSummary(results);
}

/**
 * 测试需要动态渲染的省份
 */
async function testDynamicProvinces() {
  const dynamicCodes = PROVINCE_CONFIGS
    .filter(p => p.needDynamic)
    .map(p => p.code);

  console.log(`开始测试 ${dynamicCodes.length} 个需要动态渲染的省份...\n`);
  const results = await crawler.crawlMultiple(dynamicCodes, 'output');
  crawler.generateSummary(results);
}

// ===== 主程序 =====

// 从命令行参数读取要测试的省份
const args = process.argv.slice(2);

if (args.length === 0) {
  // 无参数：显示帮助
  console.log(`
省份爬虫测试工具

用法:
  npm run test:province <province>    # 测试单个省份（按省份代码）
  npm run test:provinces <codes...>   # 测试多个省份
  npm run test:all                    # 测试所有省份
  npm run test:dynamic                # 测试需要动态渲染的省份

示例:
  npm run test:province beijing
  npm run test:provinces beijing tianjin shanghai
  npm run test:all

省份代码列表:
${PROVINCE_CONFIGS.map(p => `  ${p.code.padEnd(12)} - ${p.name}`).join('\n')}
  `);
} else if (args[0] === 'all') {
  // 测试所有省份
  testAllProvinces();
} else if (args[0] === 'dynamic') {
  // 测试动态渲染省份
  testDynamicProvinces();
} else if (args.length === 1) {
  // 测试单个省份
  testSingleProvince(args[0]);
} else {
  // 测试多个省份
  testMultipleProvinceCodes(args);
}

export { testSingleProvince, testMultipleProvinceCodes, testAllProvinces, testDynamicProvinces };
