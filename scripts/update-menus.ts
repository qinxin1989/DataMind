/**
 * 更新菜单数据脚本
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function updateMenus() {
  const pool = mysql.createPool({
    host: process.env.CONFIG_DB_HOST || 'localhost',
    port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
    user: process.env.CONFIG_DB_USER || 'root',
    password: process.env.CONFIG_DB_PASSWORD || '',
    database: process.env.CONFIG_DB_NAME || 'ai-data-platform',
  });

  const connection = await pool.getConnection();
  
  try {
    // 插入 AI 问答和知识库菜单
    await connection.execute(`
      INSERT INTO admin_menus (id, title, path, icon, parent_id, sort_order, is_system) VALUES
      ('00000000-0000-0000-0000-000000000011', 'AI问答', '/ai/chat', 'MessageOutlined', '00000000-0000-0000-0000-000000000005', 0, TRUE),
      ('00000000-0000-0000-0000-000000000012', '知识库', '/ai/knowledge', 'BookOutlined', '00000000-0000-0000-0000-000000000005', 1, TRUE)
      ON DUPLICATE KEY UPDATE title = VALUES(title), path = VALUES(path)
    `);

    // 更新其他 AI 子菜单的排序
    await connection.execute(`UPDATE admin_menus SET sort_order = 2 WHERE id = '00000000-0000-0000-0000-000000000006'`);
    await connection.execute(`UPDATE admin_menus SET sort_order = 3 WHERE id = '00000000-0000-0000-0000-000000000007'`);
    await connection.execute(`UPDATE admin_menus SET sort_order = 4 WHERE id = '00000000-0000-0000-0000-000000000008'`);

    console.log('菜单更新成功！');
  } catch (error) {
    console.error('更新失败:', error);
  } finally {
    connection.release();
    await pool.end();
  }
}

updateMenus();
