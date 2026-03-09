const http = require('http');

function testEndpoint(path, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Authorization': 'Bearer test',
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log(`${method} ${path} - Status: ${res.statusCode}`);
        if (data) {
          try {
            const json = JSON.parse(data);
            console.log('  Response:', JSON.stringify(json, null, 2).substring(0, 200));
          } catch {
            console.log('  Response:', data.substring(0, 200));
          }
        }
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', (err) => {
      console.log(`${method} ${path} - Error: ${err.message}`);
      resolve({ status: 0, error: err.message });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function main() {
  console.log('=== 测试后端API ===\n');
  
  // 测试数据源API
  await testEndpoint('/api/admin/datasources');
  
  console.log('');
  
  // 测试模板优化器API
  await testEndpoint('/api/admin/template-optimizer/status');
  
  console.log('');
  
  // 测试POST请求
  await testEndpoint('/api/admin/template-optimizer/test', 'POST', {
    datasourceId: 'test',
    options: { quick: true }
  });
}

main();
