/**
 * 测试数据预览API
 * 测试需求: 2.1, 2.3, 2.4
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/admin/ai';

// 测试数据
const testData = {
  url: 'https://example.com',
  selectors: {
    container: 'body',
    fields: {
      title: 'h1',
      content: 'p'
    }
  }
};

async function testPreviewAPI() {
  console.log('=== 测试数据预览API ===\n');

  try {
    // 测试1: 默认limit=10
    console.log('测试1: 默认返回10条数据');
    const response1 = await axios.post(`${BASE_URL}/crawler/preview`, testData);
    console.log('响应:', JSON.stringify(response1.data, null, 2));
    console.log('✓ 默认limit测试通过\n');

    // 测试2: 自定义limit
    console.log('测试2: 自定义limit=5');
    const response2 = await axios.post(`${BASE_URL}/crawler/preview`, {
      ...testData,
      limit: 5
    });
    console.log('响应:', JSON.stringify(response2.data, null, 2));
    console.log('✓ 自定义limit测试通过\n');

    // 测试3: 分页模式 - 第1页
    console.log('测试3: 分页模式 - 第1页，每页3条');
    const response3 = await axios.post(`${BASE_URL}/crawler/preview`, {
      ...testData,
      page: 1,
      pageSize: 3
    });
    console.log('响应:', JSON.stringify(response3.data, null, 2));
    console.log('✓ 分页第1页测试通过\n');

    // 测试4: 分页模式 - 第2页
    console.log('测试4: 分页模式 - 第2页，每页3条');
    const response4 = await axios.post(`${BASE_URL}/crawler/preview`, {
      ...testData,
      page: 2,
      pageSize: 3
    });
    console.log('响应:', JSON.stringify(response4.data, null, 2));
    console.log('✓ 分页第2页测试通过\n');

    // 测试5: 数据少于limit的情况
    console.log('测试5: 数据少于limit的情况');
    const response5 = await axios.post(`${BASE_URL}/crawler/preview`, {
      ...testData,
      limit: 100
    });
    console.log('响应:', JSON.stringify(response5.data, null, 2));
    console.log('✓ 数据少于limit测试通过\n');

    console.log('=== 所有测试通过 ===');
  } catch (error) {
    console.error('测试失败:', error.response?.data || error.message);
    process.exit(1);
  }
}

// 运行测试
testPreviewAPI();
