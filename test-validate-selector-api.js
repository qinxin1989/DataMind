/**
 * 测试选择器验证API
 * 测试 POST /api/admin/ai/crawler/validate-selector
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const API_URL = `${BASE_URL}/api/admin/ai/crawler/validate-selector`;

// 测试用的认证token（需要根据实际情况调整）
const AUTH_TOKEN = 'your-auth-token-here';

async function testValidateSelector() {
  console.log('=== 测试选择器验证API ===\n');

  // 测试1: 有效的选择器
  console.log('测试1: 有效的选择器');
  try {
    const response1 = await axios.post(API_URL, {
      url: 'https://www.example.com',
      selector: 'h1'
    }, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('✓ 成功:', response1.data);
  } catch (error) {
    console.log('✗ 失败:', error.response?.data || error.message);
  }
  console.log('');

  // 测试2: 无效的选择器（不匹配任何元素）
  console.log('测试2: 无效的选择器（不匹配任何元素）');
  try {
    const response2 = await axios.post(API_URL, {
      url: 'https://www.example.com',
      selector: '.non-existent-class-12345'
    }, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('✓ 成功:', response2.data);
  } catch (error) {
    console.log('✗ 失败:', error.response?.data || error.message);
  }
  console.log('');

  // 测试3: 缺少参数
  console.log('测试3: 缺少参数');
  try {
    const response3 = await axios.post(API_URL, {
      url: 'https://www.example.com'
      // 缺少 selector
    }, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('✓ 成功:', response3.data);
  } catch (error) {
    console.log('✗ 失败:', error.response?.data || error.message);
  }
  console.log('');

  // 测试4: 无效的URL格式
  console.log('测试4: 无效的URL格式');
  try {
    const response4 = await axios.post(API_URL, {
      url: 'not-a-valid-url',
      selector: 'h1'
    }, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('✓ 成功:', response4.data);
  } catch (error) {
    console.log('✗ 失败:', error.response?.data || error.message);
  }
  console.log('');

  // 测试5: 空选择器
  console.log('测试5: 空选择器');
  try {
    const response5 = await axios.post(API_URL, {
      url: 'https://www.example.com',
      selector: ''
    }, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('✓ 成功:', response5.data);
  } catch (error) {
    console.log('✗ 失败:', error.response?.data || error.message);
  }
  console.log('');

  // 测试6: 复杂的选择器
  console.log('测试6: 复杂的选择器');
  try {
    const response6 = await axios.post(API_URL, {
      url: 'https://www.example.com',
      selector: 'div > p:first-child'
    }, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('✓ 成功:', response6.data);
  } catch (error) {
    console.log('✗ 失败:', error.response?.data || error.message);
  }
  console.log('');

  console.log('=== 测试完成 ===');
}

// 运行测试
testValidateSelector().catch(console.error);
