/**
 * 添加菜单表的外部平台对接字段
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function addMenuFields() {
  const pool = mysql.createPool({
    host: process.env.CONFIG_DB_HOST || 'localhost',
    port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
    user: process.env.CONFIG_DB_USER || 'root',
    password: process.env.CONFIG_DB_PASSWORD || '',
    database: process.env.CONFIG_DB_NAME || 'ai-data-platform',
  });

  const connection = await pool.getConnection();

  try {
    // 检查字段是否已存在
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sys_menus'`,
      [process.env.CONFIG_DB_NAME || 'ai-data-platform']
    );
    
    const existingColumns = (columns as any[]).map(c => c.COLUMN_NAME);
    
    // 添加 menu_type 字段
    if (!existingColumns.includes('menu_type')) {
      await connection.execute(`
        ALTER TABLE sys_menus 
        ADD COLUMN menu_type VARCHAR(20) DEFAULT 'internal' AFTER is_system
      `);
      console.log('添加字段: menu_type');
    }

    // 添加 external_url 字段
    if (!existingColumns.includes('external_url')) {
      await connection.execute(`
        ALTER TABLE sys_menus 
        ADD COLUMN external_url VARCHAR(500) AFTER menu_type
      `);
      console.log('添加字段: external_url');
    }

    // 添加 open_mode 字段
    if (!existingColumns.includes('open_mode')) {
      await connection.execute(`
        ALTER TABLE sys_menus 
        ADD COLUMN open_mode VARCHAR(20) DEFAULT 'current' AFTER external_url
      `);
      console.log('添加字段: open_mode');
    }

    // 添加 module_code 字段
    if (!existingColumns.includes('module_code')) {
      await connection.execute(`
        ALTER TABLE sys_menus 
        ADD COLUMN module_code VARCHAR(50) AFTER open_mode
      `);
      console.log('添加字段: module_code');

      // 添加索引
      await connection.execute(`
        ALTER TABLE sys_menus ADD INDEX idx_module (module_code)
      `);
      console.log('添加索引: idx_module');
    }

    console.log('菜单表字段更新完成！');

  } finally {
    connection.release();
    await pool.end();
  }
}

addMenuFields().catch(console.error);
