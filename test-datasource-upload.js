const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const username = 'admin';
const password = 'admin123';

async function testDatasourceUpload() {
  try {
    console.log('开始测试数据源上传...');
    
    // 1. 登录获取token
    console.log('1. 登录系统...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      username,
      password
    });
    
    const token = loginResponse.data.token;
    const user = loginResponse.data.user;
    console.log('登录成功:', { userId: user.id, username: user.username });
    
    // 2. 创建一个测试数据源配置
    console.log('\n2. 创建测试数据源...');
    const testDatasource = {
      name: '测试数据源',
      type: 'mysql',
      config: {
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: '',
        database: 'ai-data-platform'
      },
      visibility: 'private',
      approvalStatus: null
    };
    
    // 3. 上传数据源
    const uploadResponse = await axios.post(`${BASE_URL}/api/datasource`, testDatasource, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('数据源上传成功:', uploadResponse.data);
    console.log('\n✅ 测试通过！文件上传不再出现外键约束错误。');
    
    // 4. 清理：删除测试数据源
    console.log('\n3. 清理测试数据...');
    await axios.delete(`${BASE_URL}/api/datasource/${uploadResponse.data.id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log('测试数据源已删除');
    
  } catch (error) {
    console.error('测试失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
      console.error('响应头:', error.response.headers);
    } else if (error.request) {
      console.error('请求已发送但未收到响应:', error.request);
    } else {
      console.error('请求配置错误:', error.config);
    }
    console.error('\n❌ 测试失败！文件上传仍出现错误。');
  }
}

testDatasourceUpload();