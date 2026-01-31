/**
 * 测试后端爬虫功能
 */

import { TemplateAnalyzer } from '../src/agent/skills/crawler/TemplateAnalyzer';
import { CrawlerTemplate } from '../src/agent/skills/crawler/CrawlerTemplate';

// 测试1: 模板验证
async function testTemplateValidation() {
  console.log('\n=== 测试1: 模板验证 ===\n');

  const invalidTemplate = {
    userId: 'test-user',
    name: '',
    url: 'invalid-url',
    containerSelector: '',
    fields: []
  };

  const validTemplate = {
    userId: 'test-user',
    name: '测试模板',
    url: 'https://example.com',
    containerSelector: '.list li',
    fields: [
      { name: '标题', selector: 'a' },
      { name: '链接', selector: 'a::attr(href)' }
    ]
  };

  console.log('无效模板验证:');
  const result1 = CrawlerTemplate.validate(invalidTemplate);
  console.log(`  有效: ${result1.valid}`);
  console.log(`  错误: ${result1.errors.join(', ')}`);
  console.log(`  警告: ${result1.warnings.join(', ')}`);

  console.log('\n有效模板验证:');
  const result2 = CrawlerTemplate.validate(validTemplate);
  console.log(`  有效: ${result2.valid}`);
  console.log(`  错误: ${result2.errors.length > 0 ? result2.errors.join(', ') : '无'}`);
  console.log(`  警告: ${result2.warnings.length > 0 ? result2.warnings.join(', ') : '无'}`);
}

// 测试2: 模板导入导出
async function testTemplateImportExport() {
  console.log('\n=== 测试2: 模板导入导出 ===\n');

  const template = {
    userId: 'test-user',
    name: '示例模板',
    url: 'https://example.com/news',
    containerSelector: '.news-list li',
    fields: [
      { name: '标题', selector: 'a.title' },
      { name: '链接', selector: 'a::attr(href)' },
      { name: '日期', selector: '.date' }
    ]
  };

  // 导出
  const json = CrawlerTemplate.exportToJson(template);
  console.log('导出的JSON:');
  console.log(json.substring(0, 200) + '...');

  // 导入
  const imported = CrawlerTemplate.importFromJson(json);
  console.log('\n导入成功:');
  console.log(`  名称: ${imported.name}`);
  console.log(`  URL: ${imported.url}`);
  console.log(`  字段数: ${imported.fields.length}`);
}

// 测试3: 网页分析（模拟）
async function testAnalyzer() {
  console.log('\n=== 测试3: 网页分析器 ===\n');

  // 注意：这个测试不会真正访问网络，只是测试分析器的初始化
  console.log('TemplateAnalyzer 已加载');
  console.log('可用方法:');
  console.log('  - analyze(url, description): 分析网页并生成模板');
  console.log('  - validateTemplate(template): 验证模板');

  // 测试URL解析
  const testUrls = [
    'https://www.beijing.gov.cn/zhengce/',
    'https://news.example.com/articles',
    'https://example.com/blog'
  ];

  console.log('\n测试URL:');
  testUrls.forEach(url => {
    try {
      const urlObj = new URL(url);
      console.log(`  ${url}`);
      console.log(`    域名: ${urlObj.hostname}`);
      console.log(`    路径: ${urlObj.pathname}`);
    } catch (e) {
      console.log(`  ${url} - 无效URL`);
    }
  });
}

// 运行所有测试
async function runTests() {
  console.log('=================================');
  console.log('后端爬虫功能测试');
  console.log('=================================');

  try {
    await testTemplateValidation();
    await testTemplateImportExport();
    await testAnalyzer();

    console.log('\n=================================');
    console.log('✓ 所有测试完成！');
    console.log('=================================\n');

    console.log('下一步:');
    console.log('1. 执行数据库迁移: mysql < migrations/add_crawler_enhancements.sql');
    console.log('2. 初始化省级模板: npm run bootstrap:templates');
    console.log('3. 启动服务器测试真实爬取: npm run dev');

  } catch (error: any) {
    console.error('\n✗ 测试失败:', error.message);
    process.exit(1);
  }
}

runTests();
