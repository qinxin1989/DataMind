const mysql = require('mysql2/promise');

async function main() {
    const dbConfig = {
        host: 'localhost',
        user: 'root',
        password: 'qinxin',
        database: 'datamind'
    };

    console.log('正在连接数据库...');
    let conn;
    try {
        conn = await mysql.createConnection(dbConfig);
    } catch (err) {
        console.error('连接失败:', err.message);
        return;
    }

    try {
        // 1. 确保必要的列存在 (修复编辑报错)
        const columnsToAdd = [
            { name: 'menu_type', def: "VARCHAR(20) DEFAULT 'internal'" },
            { name: 'open_mode', def: "VARCHAR(20) DEFAULT 'current'" },
            { name: 'external_url', def: "VARCHAR(500)" },
            { name: 'module_code', def: "VARCHAR(100)" }
        ];

        console.log('正在检查表结构...');
        for (const col of columnsToAdd) {
            try {
                await conn.execute(`ALTER TABLE sys_menus ADD COLUMN ${col.name} ${col.def}`);
                console.log(`✅ 已添加列: ${col.name}`);
            } catch (e) {
                if (e.code === 'ER_DUP_FIELDNAME') {
                    console.log(`ℹ️ 列已存在: ${col.name}`);
                } else {
                    console.error(`❌ 添加列 ${col.name} 失败:`, e.message);
                }
            }
        }

        // 2. 插入缺失的父菜单 (修复层级显示)
        console.log('正在检查缺失的菜单数据...');
        const [rows] = await conn.execute("SELECT id FROM sys_menus WHERE id = 'data-center'");

        if (rows.length === 0) {
            console.log('正在插入 [数据资源中心] 菜单...');
            await conn.execute(`
                INSERT INTO sys_menus 
                (id, title, path, icon, parent_id, sort_order, visible, is_system, menu_type, module_code, created_at, updated_at) 
                VALUES 
                ('data-center', '数据资源中心', '/data', 'DatabaseOutlined', NULL, 10, 1, 0, 'internal', 'datasource-management', NOW(), NOW())
            `);
            console.log('✅ 插入成功: data-center');
        } else {
            console.log('ℹ️ 菜单已存在: data-center');
        }

    } catch (err) {
        console.error('发生错误:', err);
    } finally {
        if (conn) await conn.end();
        console.log('操作完成。请刷新前端页面查看效果。');
        process.exit(0);
    }
}

main();
