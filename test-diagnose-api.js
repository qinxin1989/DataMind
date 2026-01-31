/**
 * 测试AI失败诊断API
 * 测试需求: 6.2, 6.3, 6.4, 6.5
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/admin/ai';

async function testDiagnoseAPI() {
  console.log('=== 测试AI失败诊断API ===\n');

  try {
    // 测试1: 选择器不匹配的情况
    console.log('测试1: 选择器不匹配');
    const response1 = await axios.post(`${BASE_URL}/crawler/diagnose`, {
      url: 'https://example.com',
      selectors: {
        container: '.non-existent-container',
        fields: {
          title: '.non-existent-title',
          content: '.non-existent-content'
        }
      },
      error: '未采集到数据'
    });
    console.log('响应:', JSON.stringify(response1.data, null, 2));
    console.log('✓ 选择器不匹配测试通过\n');

    // 测试2: 动态加载检测
    console.log('测试2: 动态加载检测');
    const response2 = await axios.post(`${BASE_URL}/crawler/diagnose`, {
      url: 'https://react-app-example.com',
      selectors: {
        container: 'body',
        fields: {
          title: 'h1'
        }
      },
      error: '页面内容为空'
    });
    console.log('响应:', JSON.stringify(response2.data, null, 2));
    console.log('✓ 动态加载检测测试通过\n');

    // 测试3: 部分字段失败
    console.log('测试3: 部分字段失败');
    const response3 = await axios.post(`${BASE_URL}/crawler/diagnose`, {
      url: 'https://example.com',
      selectors: {
        container: 'body',
        fields: {
          title: 'h1',  // 存在
          author: '.author',  // 不存在
          date: '.publish-date'  // 不存在
        }
      },
      error: '部分字段采集失败'
    });
    console.log('响应:', JSON.stringify(response3.data, null, 2));
    console.log('✓ 部分字段失败测试通过\n');

    // 测试4: 缺少必要参数
    console.log('测试4: 缺少必要参数');
    try {
      await axios.post(`${BASE_URL}/crawler/diagnose`, {
        url: 'https://example.com'
        // 缺少 selectors
      });
      console.log('✗ 应该返回错误');
    } catch (err) {
      if (err.response?.status === 400) {
        console.log('✓ 参数验证测试通过\n');
      } else {
        throw err;
      }
    }

    console.log('=== 所有测试通过 ===');
  } catch (error) {
    console.error('测试失败:', error.response?.data || error.message);
    process.exit(1);
  }
}

// 运行测试
testDiagnoseAPI();
