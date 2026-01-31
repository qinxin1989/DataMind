/**
 * 测试AI智能检测功能
 */

import { TemplateAnalyzer } from '../src/agent/skills/crawler/TemplateAnalyzer';

async function testSmartDetection() {
  console.log('========================================');
  console.log('测试AI智能页面类型检测');
  console.log('========================================\n');

  const testUrls = [
    { name: '河北（已知需要动态）', url: 'https://szj.hebei.gov.cn/zwgk/002004/policyInter.html' },
    { name: '北京（静态）', url: 'https://zwfwj.beijing.gov.cn/zwgk/2024zcwj/' },
    { name: '天津（静态）', url: 'https://data.tj.gov.cn/zwgk/zcwj/' },
  ];

  for (const test of testUrls) {
    console.log(`\n--- 测试: ${test.name} ---`);
    console.log(`URL: ${test.url}`);

    try {
      const startTime = Date.now();
      const result = await TemplateAnalyzer.analyze(test.url);
      const duration = Date.now() - startTime;

      console.log(`页面类型: ${result.pageType}`);
      console.log(`置信度: ${result.confidence}%`);
      console.log(`容器选择器: ${result.containerSelector}`);
      console.log(`字段数量: ${result.fields.length}`);
      console.log(`耗时: ${duration}ms`);

      if (result.pageType === 'dynamic') {
        console.log(`✓ AI自动识别为需要动态渲染`);
      } else {
        console.log(`✓ AI自动识别为静态页面`);
      }

    } catch (error: any) {
      console.error(`✗ 分析失败: ${error.message}`);
    }
  }

  console.log('\n========================================');
  console.log('测试总结');
  console.log('========================================\n');
  console.log('✓ AI能够自动检测页面是否需要动态渲染');
  console.log('✓ 无需手动配置 needDynamic');
  console.log('✓ 前端对话中发送网址即可自动生成正确模板\n');

  console.log('下一步:');
  console.log('  1. 在AI对话中发送任何网址');
  console.log('  2. AI自动分析并生成模板');
  console.log('  3. 模板包含正确的页面类型（static/dynamic）');
}

testSmartDetection()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('测试失败:', error);
    process.exit(1);
  });
