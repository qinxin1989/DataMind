/**
 * API 测试脚本
 * 测试 AI 爬虫助手的后端接口是否正常工作
 *
 * 运行：node scripts/test-crawler-api.js
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/admin/ai/crawler/analyze',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

console.log('🧪 测试 AI 爬虫助手 API...\n');

const testData = {
  url: 'https://example.com',
  description: '测试分析'
};

const req = http.request(options, (res) => {
  console.log(`📡 状态码: ${res.statusCode}`);

  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('📦 响应数据:');
    console.log(data);

    if (res.statusCode === 200) {
      console.log('\n✅ API 正常工作！');
    } else if (res.statusCode === 404) {
      console.log('\n❌ 404 - 路由未找到');
      console.log('可能的原因：');
      console.log('1. 服务器没有重启');
      console.log('2. 路由没有正确注册');
      console.log('3. 路径配置错误');
    } else if (res.statusCode === 401 || res.statusCode === 403) {
      console.log('\n❌ 认证/权限问题');
      console.log('需要先登录或检查权限配置');
    } else {
      console.log('\n❌ 服务器错误');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ 请求失败:', error.message);
  console.log('\n可能的原因：');
  console.log('1. 后端服务器没有启动');
  console.log('2. 端口3000被占用');
  console.log('3. 网络连接问题');
});

req.write(JSON.stringify(testData));
req.end();
