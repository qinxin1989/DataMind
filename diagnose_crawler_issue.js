/**
 * 爬虫采集记录问题诊断脚本
 * 运行: node scripts/diagnose_crawler_issue.js
 */

const mysql = require('mysql2/promise');

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'qinxin',
    database: 'ai-data-platform'
};

async function diagnose() {
    console.log('🔍 开始诊断爬虫采集记录问题...\n');

    const connection = await mysql.createConnection(dbConfig);

    try {
        // 1. 检查表是否存在
        console.log('📊 步骤 1: 检查爬虫相关表');
        const [tables] = await connection.execute(`
            SELECT TABLE_NAME, TABLE_ROWS
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = 'ai-data-platform'
            AND TABLE_NAME LIKE 'crawler%'
            ORDER BY TABLE_NAME
        `);

        if (tables.length === 0) {
            console.log('❌ 没有找到爬虫相关表！');
            console.log('请先运行 create_crawler_tables.sql 创建表\n');
            return;
        }

        console.log('✅ 找到以下爬虫表:');
        tables.forEach(t => console.log(`   - ${t.TABLE_NAME} (${t.TABLE_ROWS} 行)`));
        console.log();

        // 2. 检查 crawler_results 表结构
        console.log('📋 步骤 2: 检查 crawler_results 表结构');
        const [columns] = await connection.execute(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = 'ai-data-platform'
            AND TABLE_NAME = 'crawler_results'
            ORDER BY ORDINAL_POSITION
        `);

        console.log('字段列表:');
        columns.forEach(col => {
            console.log(`   - ${col.COLUMN_NAME} (${col.DATA_TYPE}) ${col.COLUMN_KEY ? 'KEY' : ''}`);
        });

        // 检查是否有 task_id 字段
        const hasTaskId = columns.some(col => col.COLUMN_NAME === 'task_id');
        if (!hasTaskId) {
            console.log('\n⚠️  缺少 task_id 字段！');
            console.log('修复 SQL:');
            console.log('   ALTER TABLE crawler_results ADD COLUMN task_id VARCHAR(36) NULL AFTER template_id;');
            console.log('   ALTER TABLE crawler_results ADD INDEX idx_task (task_id);');
        } else {
            console.log('✅ task_id 字段存在\n');
        }

        // 3. 测试查询（模拟后端代码）
        console.log('🔎 步骤 3: 测试采集记录查询');
        const userId = 'admin'; // 替换为实际用户 ID

        try {
            const [results] = await connection.execute(`
                SELECT r.*, COALESCE(t.name, '未知模板') as template_name
                FROM crawler_results r
                LEFT JOIN crawler_templates t ON r.template_id = t.id
                WHERE r.user_id = ?
                ORDER BY r.created_at DESC
                LIMIT 20
            `, [userId]);

            console.log(`✅ 查询成功，找到 ${results.length} 条采集记录`);
            if (results.length > 0) {
                console.log('示例记录:');
                console.log(`   ID: ${results[0].id}`);
                console.log(`   模板: ${results[0].template_name}`);
                console.log(`   创建时间: ${results[0].created_at}`);
            } else {
                console.log('💡 没有采集记录，这是正常的如果还没有运行过爬虫');
            }
        } catch (error) {
            console.log('❌ 查询失败:', error.message);
        }
        console.log();

        // 4. 检查是否有模板数据
        console.log('📝 步骤 4: 检查爬虫模板');
        const [templates] = await connection.execute(`
            SELECT id, name, url
            FROM crawler_templates
            WHERE user_id = ?
            LIMIT 5
        `, [userId]);

        if (templates.length === 0) {
            console.log('💡 没有找到爬虫模板');
            console.log('   提示: 请先在"AI 爬虫助手"中创建模板');
        } else {
            console.log(`✅ 找到 ${templates.length} 个模板:`);
            templates.forEach(t => console.log(`   - ${t.name}: ${t.url}`));
        }
        console.log();

        // 5. 测试插入采集记录
        console.log('🧪 步骤 5: 测试插入采集记录');
        if (templates.length > 0) {
            const templateId = templates[0].id;
            const testResultId = `test-${Date.now()}`;

            try {
                // 检查 task_id 字段是否存在
                const checkTaskId = await connection.execute(`
                    SELECT COLUMN_NAME
                    FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = 'ai-data-platform'
                    AND TABLE_NAME = 'crawler_results'
                    AND COLUMN_NAME = 'task_id'
                `);

                let insertSQL;
                if (checkTaskId[0].length > 0) {
                    insertSQL = `
                        INSERT INTO crawler_results (id, task_id, template_id, user_id)
                        VALUES (?, ?, ?, ?)
                    `;
                    await connection.execute(insertSQL, [testResultId, null, templateId, userId]);
                } else {
                    insertSQL = `
                        INSERT INTO crawler_results (id, template_id, user_id)
                        VALUES (?, ?, ?)
                    `;
                    await connection.execute(insertSQL, [testResultId, templateId, userId]);
                }

                console.log('✅ 插入测试记录成功');

                // 删除测试记录
                await connection.execute('DELETE FROM crawler_results WHERE id = ?', [testResultId]);
                console.log('✅ 清理测试记录成功');

            } catch (error) {
                console.log('❌ 插入测试失败:', error.message);
                console.log('   SQL:', insertSQL);
            }
        } else {
            console.log('⏭️  跳过（没有模板可供测试）');
        }
        console.log();

        // 6. 总结
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 诊断总结:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if (hasTaskId && templates.length >= 0) {
            console.log('✅ 数据库结构正常');
            console.log('✅ 如果前端仍然报错，请检查:');
            console.log('   1. 后端服务器是否已重启？');
            console.log('   2. 浏览器控制台是否有错误？');
            console.log('   3. 网络请求返回了什么？');
            console.log('\n💡 查看浏览器网络请求:');
            console.log('   打开浏览器开发者工具 -> Network 选项卡');
            console.log('   刷新页面，查找 /skills/crawler/results 请求');
            console.log('   查看 Response 和 Status Code');
        } else {
            console.log('⚠️  发现问题需要修复');
        }

    } catch (error) {
        console.error('❌ 诊断过程出错:', error.message);
    } finally {
        await connection.end();
    }
}

diagnose().catch(console.error);
