/**
 * 执行爬虫模板表字段迁移
 */

import { pool } from '../src/admin/core/database';
import * as fs from 'fs';
import * as path from 'path';

async function migrateCrawlerTemplateFields() {
  const connection = await pool.getConnection();
  
  try {
    console.log('开始迁移爬虫模板表字段...\n');

    // 读取SQL文件
    const sqlFile = path.join(__dirname, '../migrations/add-crawler-template-pagination-fields.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // 执行迁移
    await connection.query(sql);
    
    console.log('✓ 字段添加成功\n');

    // 验证字段
    const [columns] = await connection.execute(
      'DESCRIBE crawler_templates'
    );

    console.log('crawler_templates 表结构:');
    console.table(columns);

    console.log('\n✅ 迁移完成！');

  } catch (error: any) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('✓ 字段已存在，跳过迁移');
    } else {
      console.error('迁移失败:', error);
      throw error;
    }
  } finally {
    connection.release();
    await pool.end();
  }
}

migrateCrawlerTemplateFields().catch(console.error);
