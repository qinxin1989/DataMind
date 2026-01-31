const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateMenus() {
    const pool = mysql.createPool({
        host: process.env.CONFIG_DB_HOST || 'localhost',
        port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
        user: process.env.CONFIG_DB_USER || 'root',
        password: process.env.CONFIG_DB_PASSWORD || 'qinxin',
        database: process.env.CONFIG_DB_NAME || 'ai-data-platform',
    });

    const connection = await pool.getConnection();
    try {
        console.log('Starting menu synchronization...');

        // 1. 同步名称及图标
        await connection.execute("UPDATE sys_menus SET title = '智能问答', icon = 'MessageOutlined' WHERE id = '00000000-0000-0000-0000-000000000011'");
        await connection.execute("UPDATE sys_menus SET title = '知识中心', icon = 'BookOutlined' WHERE id = '00000000-0000-0000-0000-000000000012'");
        await connection.execute("UPDATE sys_menus SET title = '对话历史', icon = 'HistoryOutlined' WHERE id = '00000000-0000-0000-0000-000000000008'");

        // 2. 插入或更新爬虫管理
        await connection.execute(`
      INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, is_system) 
      VALUES ('00000000-0000-0000-0000-000000000014', '爬虫管理', '/ai/crawler', 'GlobalOutlined', '00000000-0000-0000-0000-000000000005', 6, TRUE)
      ON DUPLICATE KEY UPDATE title='爬虫管理', path='/ai/crawler', icon='GlobalOutlined', sort_order=6
    `);

        // 3. 插入或更新 OCR 识别
        await connection.execute(`
      INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, is_system) 
      VALUES ('00000000-0000-0000-0000-000000000015', 'OCR识别', '/ai/ocr', 'ScanOutlined', '00000000-0000-0000-0000-000000000005', 2, TRUE)
      ON DUPLICATE KEY UPDATE title='OCR识别', path='/ai/ocr', icon='ScanOutlined', sort_order=2
    `);

        // 4. 重组数据管理
        await connection.execute(`
      UPDATE sys_menus SET title = '数据处理中心', path = NULL, icon = 'DatabaseOutlined', sort_order = 6 
      WHERE id = '00000000-0000-0000-0000-000000000009'
    `);

        await connection.execute(`
      INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, is_system) 
      VALUES ('00000000-0000-0000-0000-000000000016', '数据源管理', '/datasource', 'DatabaseOutlined', '00000000-0000-0000-0000-000000000009', 0, TRUE)
      ON DUPLICATE KEY UPDATE parent_id='00000000-0000-0000-0000-000000000009', sort_order=0
    `);

        await connection.execute(`
      INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, is_system) 
      VALUES ('00000000-0000-0000-0000-000000000017', '数据源审核', '/datasource/approval', 'AuditOutlined', '00000000-0000-0000-0000-000000000009', 1, TRUE)
      ON DUPLICATE KEY UPDATE parent_id='00000000-0000-0000-0000-000000000009', sort_order=1
    `);

        console.log('Menu synchronization completed successfully!');
    } catch (error) {
        console.error('Error updating menus:', error);
    } finally {
        connection.release();
        await pool.end();
    }
}

updateMenus();
