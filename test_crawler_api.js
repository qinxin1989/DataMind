/**
 * 端到端测试爬虫 API
 * 测试从后端接口到数据库的完整流程
 */
const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/skills/crawler/results',
    method: 'GET',
    headers: {
        'Content-Type': 'application/json',
    }
};

console.log('🧪 测试爬虫采集记录 API...\n');
console.log('提示: 如果需要认证，请先登录获取 token');

// 从 localStorage 获取 token（需要手动设置）
const token = process.env.TOKEN || '';

if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
    console.log('✅ 使用认证 token\n');
} else {
    console.log('⚠️  没有设置 TOKEN 环境变量');
    console.log('   设置方法: export TOKEN=your_jwt_token');
    console.log('   或者从浏览器开发者工具 -> Application -> Local Storage 获取\n');
}

const req = http.request(options, (res) => {
    console.log(`📡 状态码: ${res.statusCode}`);
    console.log(`📋 响应头: ${JSON.stringify(res.headers, null, 2)}\n`);

    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('📦 响应数据:');
        try {
            const parsed = JSON.parse(data);
            console.log(JSON.stringify(parsed, null, 2));

            if (parsed.success && parsed.data) {
                console.log(`\n✅ 查询成功，共 ${parsed.data.length} 条记录`);
                if (parsed.data.length > 0) {
                    console.log('\n示例记录:');
                    const record = parsed.data[0];
                    console.log(`   ID: ${record.id}`);
                    console.log(`   模板: ${record.template_name}`);
                    console.log(`   用户ID: ${record.user_id}`);
                    console.log(`   创建时间: ${record.created_at}`);
                }
            } else {
                console.log('\n⚠️  响应格式异常或无数据');
            }
        } catch (e) {
            console.log('原始响应:', data);
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        if (res.statusCode === 200) {
            console.log('✅ API 正常工作！');
        } else if (res.statusCode === 401) {
            console.log('❌ 认证失败 - 需要登录');
            console.log('💡 解决方法:');
            console.log('   1. 登录系统');
            console.log('   2. 从浏览器开发者工具获取 token');
            console.log('   3. 设置环境变量: export TOKEN=xxx');
            console.log('   4. 重新运行测试');
        } else if (res.statusCode === 500) {
            console.log('❌ 服务器错误');
            console.log('💡 检查后端日志');
        }
    });
});

req.on('error', (error) => {
    console.error('❌ 请求失败:', error.message);
    console.log('\n可能的原因:');
    console.log('1. 后端服务器没有启动');
    console.log('2. 端口3000被占用');
    console.log('3. 网络连接问题');
});

req.end();
