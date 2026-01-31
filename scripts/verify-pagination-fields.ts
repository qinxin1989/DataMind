/**
 * 验证爬虫模板表的分页字段
 */

import { pool } from '../src/admin/core/database';

async function verifyPaginationFields() {
  const connection = await pool.getConnection();
  
  try {
    console.log('验证 crawler_templates 表的分页配置字段...\n');

    // 获取表结构
    const [columns] = await connection.execute(
      'DESCRIBE crawler_templates'
    ) as any;

    // 检查必需的分页字段
    const requiredFields = [
      'pagination_enabled',
      'max_pages',
      'url_pattern',
      'next_page_selector'
    ];

    console.log('表结构:');
    console.table(columns);

    console.log('\n检查分页字段:');
    const existingFields = columns.map((col: any) => col.Field);
    
    let allFieldsPresent = true;
    for (const field of requiredFields) {
      const exists = existingFields.includes(field);
      console.log(`  ${exists ? '✓' : '✗'} ${field}: ${exists ? '存在' : '缺失'}`);
      if (!exists) allFieldsPresent = false;
    }

    if (allFieldsPresent) {
      console.log('\n✅ 所有分页配置字段已成功添加！');
      console.log('\n字段详情:');
      const paginationFields = columns.filter((col: any) => 
        requiredFields.includes(col.Field)
      );
      console.table(paginationFields);
    } else {
      console.log('\n❌ 部分字段缺失，请检查迁移脚本');
    }

  } catch (error) {
    console.error('验证失败:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

verifyPaginationFields().catch(console.error);
