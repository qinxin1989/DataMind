// 测试API返回的数据结构
const axios = require('axios');

async function testAPI() {
  try {
    const response = await axios.post('http://localhost:3000/api/ask', {
      datasourceId: 'sakila的ID', // 需要替换为实际的ID
      question: '各电影分类的总销售额如何分布？'
    }, {
      headers: {
        'Authorization': 'Bearer YOUR_TOKEN', // 需要替换为实际的token
        'Content-Type': 'application/json'
      }
    });
    
    console.log('=== API Response ===');
    console.log('Full response:', JSON.stringify(response.data, null, 2));
    console.log('\n=== answer field ===');
    console.log(response.data.answer);
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testAPI();
