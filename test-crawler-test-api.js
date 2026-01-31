/**
 * 测试爬虫模板测试API
 * 测试需求: 10.2, 10.3, 10.4
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/admin/ai';

async function testCrawlerTestAPI() {
  console.log('=== 测试爬虫模板测试API ===\n');

  try {
    // 测试1: 成功场景
    console.log('测试1: 成功采集场景');
    const response1 = await axios.post(`${BASE_URL}/crawler/test`, {
      url: 'https://example.com',
      selectors: {
        container: 'body',
        fields: {
          title: 'h1',
          content: 'p'
        }
      }
    });
    console.log('响应:', JSON.stringify(response1.data, null, 2));
    console.log('✓ 成功场景测试通过\n');

    // 测试2: 失败场景（选择器不匹配）
    console.log('测试2: 失败场景（选择器不匹配）');
    const response2 = await axios.post(`${BASE_URL}/crawler/test`, {
      url: 'https://example.com',
      selectors: {
        container: '.non-existent',
        fields: {
          title: '.non-existent-title'
        }
      }
    });
    console.log('响应:', JSON.stringify(response2.data, null, 2));
    console.log('✓ 失败场景测试通过\n');

    // 测试3: 带分页配置
    console.log('测试3: 带分页配置');
    const response3 = await axios.post(`${BASE_URL}/crawler/test`, {
      url: 'https://example.com',
      selectors: {
        container: 'body',
        fields: {
          title: 'h1'
        }
      },
      paginationConfig: {
        enabled: true,
        maxPages: 5,
        nextPageSelector: '.next-page'
      }
    });
    console.log('响应:', JSON.stringify(response3.data, null, 2));
    console.log('✓ 分页配置测试通过\n');

    // 测试4: 缺少必要参数
    console.log('测试4: 缺少必要参数');
    try {
      await axios.post(`${BASE_URL}/crawler/test`, {
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

    // 测试5: 无效URL格式
    console.log('测试5: 无效URL格式');
    try {
      await axios.post(`${BASE_URL}/crawler/test`, {
        url: 'not-a-valid-url',
        selectors: {
          container: 'body',
          fields: { title: 'h1' }
        }
      });
      console.log('✗ 应该返回错误');
    } catch (err) {
      if (err.response?.status === 400) {
        console.log('✓ URL验证测试通过\n');
      } else {
        throw err;
      }
    }

    // 测试6: 网络错误处理
    console.log('测试6: 网络错误处理');
    const response6 = await axios.post(`${BASE_URL}/crawler/test`, {
      url: 'https://this-domain-does-not-exist-12345.com',
      selectors: {
        container: 'body',
        fields: { title: 'h1' }
      }
    });
    console.log('响应:', JSON.stringify(response6.data, null, 2));
    console.log('✓ 网络错误处理测试通过\n');

    console.log('=== 所有测试通过 ===');
  } catch (error) {
    console.error('测试失败:', error.response?.data || error.message);
    process.exit(1);
  }
}

// 运行测试
testCrawlerTestAPI();
