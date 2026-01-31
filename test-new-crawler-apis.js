/**
 * 测试新增的爬虫API
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/admin/ai';
const TEST_URL = 'https://www.gov.cn/pushinfo/v150203/index.htm';

// 模拟登录token（需要替换为实际token）
const TOKEN = 'your-token-here';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function testValidateSelector() {
  console.log('\n=== 测试选择器验证API ===');
  try {
    const res = await api.post('/crawler/validate-selector', {
      url: TEST_URL,
      selector: '.list_tit a'
    });
    console.log('✓ 选择器验证成功:', res.data);
  } catch (error) {
    console.error('✗ 选择器验证失败:', error.response?.data || error.message);
  }
}

async function testPreview() {
  console.log('\n=== 测试数据预览API ===');
  try {
    const res = await api.post('/crawler/preview', {
      url: TEST_URL,
      selectors: {
        container: '.list_tit',
        fields: {
          title: 'a',
          link: 'a@href'
        }
      },
      limit: 5
    });
    console.log('✓ 数据预览成功:');
    console.log('  总数:', res.data.data.total);
    console.log('  返回:', res.data.data.limit);
    console.log('  数据:', res.data.data.data.slice(0, 2));
  } catch (error) {
    console.error('✗ 数据预览失败:', error.response?.data || error.message);
  }
}

async function testDiagnose() {
  console.log('\n=== 测试AI诊断API ===');
  try {
    const res = await api.post('/crawler/diagnose', {
      url: TEST_URL,
      selectors: {
        container: '.invalid-selector',
        fields: {
          title: '.also-invalid'
        }
      }
    });
    console.log('✓ AI诊断成功:');
    console.log('  问题:', res.data.data.issues);
    console.log('  建议:', res.data.data.recommendations);
  } catch (error) {
    console.error('✗ AI诊断失败:', error.response?.data || error.message);
  }
}

async function testCrawlerTest() {
  console.log('\n=== 测试模板测试API ===');
  try {
    const res = await api.post('/crawler/test', {
      url: TEST_URL,
      selectors: {
        container: '.list_tit',
        fields: {
          title: 'a',
          link: 'a@href'
        }
      }
    });
    console.log('✓ 模板测试成功:');
    console.log('  成功:', res.data.data.success);
    console.log('  数量:', res.data.data.count);
    console.log('  消息:', res.data.data.message);
  } catch (error) {
    console.error('✗ 模板测试失败:', error.response?.data || error.message);
  }
}

async function runTests() {
  console.log('开始测试新增的爬虫API...');
  console.log('注意：需要先启动后端服务器并设置有效的TOKEN');
  
  await testValidateSelector();
  await testPreview();
  await testDiagnose();
  await testCrawlerTest();
  
  console.log('\n=== 测试完成 ===\n');
}

runTests().catch(console.error);
