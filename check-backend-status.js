/**
 * 后端状态检查脚本
 */

const http = require('http');

console.log('🔍 检查后端状态...\n');

// 测试1: 检查服务器是否运行
console.log('1️⃣ 测试服务器连接...');
http.get('http://localhost:3000/api/admin/health', (res) => {
  console.log(`   状态码: ${res.statusCode}`);
  if (res.statusCode === 200) {
    console.log('   ✅ 后端服务器正常运行\n');
  } else {
    console.log('   ❌ 后端响应异常\n');
  }
}).on('error', () => {
  console.log('   ❌ 后端服务器未启动\n');
  console.log('   请先启动后端: npm run start:secure\n');
});

// 测试2: 检查路由是否存在
setTimeout(() => {
  console.log('2️⃣ 测试爬虫助手路由...');
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/ai/crawler/analyze',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  };

  const req = http.request(options, (res) => {
    console.log(`   状态码: ${res.statusCode}`);

    if (res.statusCode === 404) {
      console.log('   ❌ 路由不存在 (404)');
      console.log('   请检查：');
      console.log('   - src/admin/modules/ai/routes.ts 是否包含爬虫路由？');
      console.log('   - 是否已重启服务器？');
    } else if (res.statusCode === 401 || res.statusCode === 403) {
      console.log('   ⚠️ 需要认证');
      console.log('   这是正常的，API需要登录\n');
    } else if (res.statusCode === 500) {
      console.log('   ❌ 服务器内部错误');
      console.log('   请检查服务器日志\n');
    } else {
      console.log('   ✅ 路由存在\n');
    }

    res.on('data', (d) => {
      process.stdout.write(d);
    });
  });

  req.on('error', (err) => {
    console.log(`   ❌ 请求失败: ${err.message}\n`);
  });

  req.write(JSON.stringify({ url: 'test', description: 'test' }));
  req.end();
}, 1000);
