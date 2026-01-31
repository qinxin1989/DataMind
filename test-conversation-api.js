/**
 * 测试爬虫助手对话历史API
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/admin/ai';
const TOKEN = 'your-token-here'; // 需要替换为实际的token

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function testConversationAPI() {
  console.log('开始测试对话历史API...\n');

  try {
    // 1. 创建新对话
    console.log('1. 创建新对话...');
    const createRes = await api.post('/crawler-conversations', {
      title: '测试对话',
      messages: [
        { role: 'user', content: '你好', type: 'text' },
        { role: 'ai', content: '你好！有什么可以帮助你的？', type: 'text' }
      ]
    });
    console.log('✓ 创建成功:', createRes.data);
    const conversationId = createRes.data.data.id;

    // 2. 获取对话列表
    console.log('\n2. 获取对话列表...');
    const listRes = await api.get('/crawler-conversations');
    console.log('✓ 对话列表:', listRes.data.data.length, '条');

    // 3. 获取对话详情
    console.log('\n3. 获取对话详情...');
    const detailRes = await api.get(`/crawler-conversations/${conversationId}`);
    console.log('✓ 对话详情:', detailRes.data.data.title);

    // 4. 更新对话
    console.log('\n4. 更新对话...');
    const updateRes = await api.put(`/crawler-conversations/${conversationId}`, {
      title: '测试对话（已更新）',
      messages: [
        { role: 'user', content: '你好', type: 'text' },
        { role: 'ai', content: '你好！有什么可以帮助你的？', type: 'text' },
        { role: 'user', content: '帮我爬取网页', type: 'text' }
      ]
    });
    console.log('✓ 更新成功:', updateRes.data);

    // 5. 获取最新对话
    console.log('\n5. 获取最新对话...');
    const latestRes = await api.get('/crawler-conversations-latest');
    console.log('✓ 最新对话:', latestRes.data.data?.title);

    // 6. 删除对话
    console.log('\n6. 删除对话...');
    const deleteRes = await api.delete(`/crawler-conversations/${conversationId}`);
    console.log('✓ 删除成功:', deleteRes.data);

    console.log('\n✅ 所有测试通过！');
  } catch (error) {
    console.error('❌ 测试失败:', error.response?.data || error.message);
  }
}

testConversationAPI();
