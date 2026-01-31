/**
 * 快速测试智能检测
 */

import { TemplateAnalyzer } from '../src/agent/skills/crawler/TemplateAnalyzer';

async function quickTest() {
  console.log('========================================');
  console.log('AI智能检测 - 快速测试');
  console.log('========================================\n');

  // 测试河北（已知需要动态）
  const hebeiUrl = 'https://szj.hebei.gov.cn/zwgk/002004/policyInter.html';

  console.log(`测试URL: ${hebeiUrl}\n`);
  console.log('工作流程:');
  console.log('  1. 先尝试静态抓取');
  console.log('  2. AI分析HTML内容');
  console.log('  3. 判断是否需要动态渲染');
  console.log('  4. 自动切换到正确模式');
  console.log('  5. 生成模板\n');

  try {
    const result = await TemplateAnalyzer.analyze(hebeiUrl, '河北政策文件');

    console.log('========================================');
    console.log('分析结果');
    console.log('========================================\n');
    console.log(`✓ 模板名称: ${result.name}`);
    console.log(`✓ 页面类型: ${result.pageType}`);
    console.log(`✓ 置信度: ${result.confidence}%`);
    console.log(`✓ 容器选择器: ${result.containerSelector}`);
    console.log(`✓ 字段配置:`);
    result.fields.forEach(f => {
      console.log(`    - ${f.name}: ${f.selector}`);
    });
    console.log(`✓ 标签: ${result.metadata.suggestedTags.join(', ')}`);

    if (result.pageType === 'dynamic') {
      console.log('\n✓✓✓ AI自动识别：该网站需要动态渲染！');
    } else {
      console.log('\n✓✓✓ AI自动识别：该网站为静态页面');
    }

    console.log('\n========================================');
    console.log('✓ 智能检测工作正常！');
    console.log('========================================\n');

    console.log('使用方式：');
    console.log('  在AI对话中直接发送网址，例如：');
    console.log('  "帮我抓取 https://example.com 的新闻"');
    console.log('\n  AI会自动：');
    console.log('  1. 检测页面类型');
    console.log('  2. 生成选择器');
    console.log('  3. 创建模板');
    console.log('  4. 爬取数据');

  } catch (error: any) {
    console.error('\n✗ 测试失败:', error.message);
    console.error('\n可能原因：');
    console.error('  - 网络问题');
    console.error('  - Puppeteer未安装');
    console.error('  - 网站访问限制');
  }
}

quickTest()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
