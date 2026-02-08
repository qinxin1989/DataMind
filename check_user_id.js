/**
 * 检查实际的用户 ID
 */
const mysql = require('mysql2/promise');

async function checkUserId() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'qinxin',
        database: 'datamind'
    });

    try {
        console.log('🔍 检查用户表...\n');

        // 检查 users 表
        const [users] = await connection.execute('SELECT id, username FROM users LIMIT 10');
        console.log('📋 Users 表:');
        users.forEach(u => console.log(`   ID: ${u.id}, Username: ${u.username}`));

        console.log('\n📋 爬虫模板的 user_id:');
        const [templates] = await connection.execute('SELECT id, name, user_id FROM crawler_templates');
        if (templates.length > 0) {
            templates.forEach(t => {
                console.log(`   模板: ${t.name}, user_id: ${t.user_id}`);
            });
        } else {
            console.log('   （无模板）');
        }

        console.log('\n📋 采集记录的 user_id:');
        const [results] = await connection.execute('SELECT id, user_id FROM crawler_results LIMIT 5');
        if (results.length > 0) {
            results.forEach(r => {
                console.log(`   记录: ${r.id}, user_id: ${r.user_id}`);
            });
        } else {
            console.log('   （无记录）');
        }

    } finally {
        await connection.end();
    }
}

checkUserId().catch(console.error);
