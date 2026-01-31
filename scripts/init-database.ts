/**
 * 数据库初始化脚本
 * 读取并执行SQL迁移文件
 */

import * as fs from 'fs';
import * as path from 'path';
import { pool } from '../src/admin/core/database';

const SQL_FILE = path.join(__dirname, '../migrations/add_crawler_enhancements_mysql57.sql');

async function initDatabase() {
  console.log('========================================');
  console.log('数据库初始化');
  console.log('========================================\n');

  try {
    // 读取SQL文件
    console.log('[1/3] 读取SQL文件...');
    const sqlContent = fs.readFileSync(SQL_FILE, 'utf-8');
    console.log(`✓ SQL文件已读取 (${sqlContent.length} 字符)\n`);

    // 连接数据库
    console.log('[2/3] 连接数据库...');
    const connection = await pool.getConnection();
    console.log('✓ 数据库连接成功\n');

    // 分割并执行SQL语句
    console.log('[3/3] 执行迁移...\n');

    // 移除注释和空行，分割SQL语句
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'))
      .filter(s => s.toUpperCase().startsWith('CREATE') ||
                   s.toUpperCase().startsWith('ALTER') ||
                   s.toUpperCase().startsWith('INSERT') ||
                   s.toUpperCase().startsWith('USE') ||
                   s.toUpperCase().startsWith('DELIMITER'));

    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      if (statement.length === 0) continue;

      try {
        // 跳过DELIMITER命令（MySQL特定）
        if (statement.toUpperCase().includes('DELIMITER')) {
          continue;
        }

        await connection.query(statement);
        successCount++;
        console.log(`✓ 执行成功: ${statement.substring(0, 50)}...`);
      } catch (error: any) {
        // 忽略"已存在"错误
        if (error.code === 'ER_TABLE_EXISTS_ERROR' ||
            error.code === 'ER_DUP_KEYNAME' ||
            error.code === 'ER_DUP_ENTRY') {
          console.log(`⊘ 跳过（已存在）: ${statement.substring(0, 50)}...`);
        } else {
          errorCount++;
          console.error(`✗ 执行失败: ${error.message}`);
          console.error(`   SQL: ${statement.substring(0, 100)}...`);
        }
      }
    }

    connection.release();

    console.log('\n========================================');
    console.log('初始化完成！');
    console.log(`成功: ${successCount} 条`);
    console.log(`跳过/失败: ${errorCount} 条`);
    console.log('========================================\n');

    // 验证表结构
    console.log('验证表结构...');
    await verifyTables();

  } catch (error: any) {
    console.error('\n✗ 初始化失败:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function verifyTables() {
  const connection = await pool.getConnection();

  try {
    const tables = [
      'crawler_templates',
      'crawler_template_fields',
      'crawler_tasks',
      'crawler_results',
      'crawler_result_rows',
      'crawler_result_items',
      'crawler_notifications',
      'crawler_content_classify',
      'crawler_deduplication'
    ];

    console.log('\n检查表是否存在:');
    for (const table of tables) {
      const [rows] = await connection.query(
        `SHOW TABLES LIKE '${table}'`
      );
      const exists = (rows as any[]).length > 0;
      console.log(`  ${exists ? '✓' : '✗'} ${table}`);
    }

    // 检查新增字段
    console.log('\n检查crawler_templates表字段:');
    const [columns] = await connection.query(
      `SHOW COLUMNS FROM crawler_templates`
    );

    const newFields = ['page_type', 'auto_generated', 'confidence', 'last_used_at', 'usage_count', 'tags'];
    const columnNames = (columns as any[]).map((c: any) => c.Field);

    for (const field of newFields) {
      const exists = columnNames.includes(field);
      console.log(`  ${exists ? '✓' : '✗'} ${field}`);
    }

  } finally {
    connection.release();
  }
}

// 运行
initDatabase()
  .then(() => {
    console.log('\n✓ 数据库初始化成功！');
    console.log('\n下一步:');
    console.log('  npm run bootstrap:templates  # 初始化省级模板');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ 数据库初始化失败:', error);
    process.exit(1);
  });
