
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const API_URL = 'http://localhost:3000/api';

async function testAuthBridge() {
    console.log('开始测试 Auth 路由桥接...');
    try {
        // 测试一个不需要登录的接口，或者尝试一个必定失败的登录来验证路由是否到达
        console.log('请求: POST /api/auth/login (预期: 400 Bad Request if missing body)');
        const response = await axios.post(`${API_URL}/auth/login`, {}, {
            validateStatus: (status) => status < 500
        });

        console.log('响应状态码:', response.status);
        console.log('响应内容:', response.data);

        if (response.status === 400 && response.data.error) {
            console.log('✅ Auth 路由桥接测试通过：请求已成功转发至模块路由。');
        } else {
            console.log('⚠️ Auth 路由桥接测试结果异常，请检查后台日志。');
        }
    } catch (error: any) {
        console.error('❌ 测试过程中发生错误:', error.message);
    }
}

testAuthBridge();
