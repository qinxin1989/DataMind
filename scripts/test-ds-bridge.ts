
import axios from 'axios';
const API_URL = 'http://localhost:3000/api';

async function testDataSourceBridge() {
    console.log('开始测试 DataSource 路由桥接...');
    try {
        // 1. 测试列表接口 (预期: 返回数组，即使未登录也是 401，但能确认路由已到达)
        console.log('请求: GET /api/datasource');
        const response = await axios.get(`${API_URL}/datasource`, {
            validateStatus: (status) => status < 500
        });

        console.log('响应状态码:', response.status);

        if (response.status === 401) {
            console.log('✅ DataSource 路由桥接测试基本通过（拦截器生效）。');
        } else if (response.status === 200 && Array.isArray(response.data)) {
            console.log('✅ DataSource 路由桥接测试通过：返回了数据列表。');
        } else {
            console.log('⚠️ DataSource 路由桥接测试结果异常，请检查后台日志。状态码:', response.status);
        }
    } catch (error: any) {
        console.error('❌ 测试过程中发生错误:', error.message);
    }
}

testDataSourceBridge();
