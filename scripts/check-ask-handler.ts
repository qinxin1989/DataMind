
import axios from 'axios';
const API_URL = 'http://localhost:3000/api';

async function testAsk() {
    console.log('测试 AI QA (/api/ask)...');
    try {
        const response = await axios.post(`${API_URL}/ask`, {
            question: '你好',
            datasourceId: 'any'
        }, {
            validateStatus: (status) => status < 500
        });

        console.log('响应状态码:', response.status);
        console.log('响应内容字段:', Object.keys(response.data));

        if (response.data.meta) {
            console.log('✅ 此请求由【模块路由】处理。');
        } else {
            console.log('ℹ️ 此请求由【旧版逻辑】处理。');
        }
    } catch (error: any) {
        console.error('❌ 发生错误:', error.message);
    }
}

testAsk();
