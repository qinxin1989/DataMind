/**
 * 创建模块系统数据库表
 * 执行命令: npx ts-node scripts/create-module-system-tables.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from '../src/admin/core/database';

async function createModuleSystemTables() {
  console.log('开始创建模块系统数据库表...\n');
  
  const connection = await pool.getConnection();
  
  try {
    // 读取 SQL 文件
    const sqlPath = join(__dirname, '../migrations/create-module-system-tables.sql');
    const sql = readFileSync(sqlPath, 'utf-8');
    
    // 分割 SQL 语句（按分号分割，但忽略注释中的分号）
    const statements = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && line.trim().length > 0)
      .join('\n')
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`共有 ${statements.length} 条 SQL 语句需要执行\n`);
    
    // 执行每条 SQL 语句
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // 提取表名用于显示
      const tableMatch = statement.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
      const tableName = tableMatch ? tableMatch[1] : `语句 ${i + 1}`;
      
      console.log(`[${i + 1}/${statements.length}] 正在创建: ${tableName}...`);
      
      try {
        await connection.query(statement);
        console.log(`✓ ${tableName} 创建成功\n`);
      } catch (error: any) {
        // 如果表已存在，只显示警告
        if (error.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log(`⚠ ${tableName} 已存在，跳过\n`);
        } else {
          throw error;
        }
      }
    }
    
    // 验证表是否创建成功
    console.log('验证表创建结果...\n');
    const tables = ['sys_modules', 'sys_module_dependencies', 'sys_module_migrations', 'sys_module_configs'];
    
    for (const table of tables) {
      const [rows] = await connection.query(
        `SELECT COUNT(*) as count FROM information_schema.tables 
         WHERE table_schema = DATABASE() AND table_name = ?`,
        [table]
      );
      
      const exists = (rows as any)[0].count > 0;
      if (exists) {
        console.log(`✓ ${table} 存在`);
      } else {
        console.log(`✗ ${table} 不存在`);
      }
    }
    
    console.log('\n✅ 模块系统数据库表创建完成！');
    
  } catch (error) {
    console.error('\n❌ 创建失败:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// 执行脚本
if (require.main === module) {
  createModuleSystemTables()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { createModuleSystemTables };
