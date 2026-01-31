/**
 * 添加分页支持到数据库
 */

import { pool } from '../src/admin/core/database';

async function addPaginationSupport() {
  console.log('========================================');
  console.log('添加分页支持');
  console.log('========================================\n');

  const connection = await pool.getConnection();

  try {
    // 检查列是否已存在
    const [columns]: any = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_NAME = 'crawler_templates'
       AND COLUMN_NAME IN ('pagination_enabled', 'pagination_next_selector', 'pagination_max_pages')
       AND TABLE_SCHEMA = DATABASE()`
    );

    const existingColumns = columns.map((c: any) => c.COLUMN_NAME);

    // 添加分页启用标志
    if (!existingColumns.includes('pagination_enabled')) {
      await connection.execute(
        `ALTER TABLE crawler_templates
         ADD COLUMN pagination_enabled BOOLEAN DEFAULT FALSE COMMENT '是否启用多页抓取'`
      );
      console.log('✓ 已添加 pagination_enabled 列');
    } else {
      console.log('- pagination_enabled 列已存在');
    }

    // 添加下一页选择器
    if (!existingColumns.includes('pagination_next_selector')) {
      await connection.execute(
        `ALTER TABLE crawler_templates
         ADD COLUMN pagination_next_selector VARCHAR(500) NULL COMMENT '下一页按钮选择器'`
      );
      console.log('✓ 已添加 pagination_next_selector 列');
    } else {
      console.log('- pagination_next_selector 列已存在');
    }

    // 添加最大页数限制
    if (!existingColumns.includes('pagination_max_pages')) {
      await connection.execute(
        `ALTER TABLE crawler_templates
         ADD COLUMN pagination_max_pages INT DEFAULT 1 COMMENT '最大抓取页数'`
      );
      console.log('✓ 已添加 pagination_max_pages 列');
    } else {
      console.log('- pagination_max_pages 列已存在');
    }

    console.log('\n✓ 分页支持添加完成！\n');

    // 显示当前表结构
    const [structure]: any = await connection.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, IS_NULLABLE, COLUMN_COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_NAME = 'crawler_templates'
       AND TABLE_SCHEMA = DATABASE()
       AND COLUMN_NAME LIKE 'pagination%'
       ORDER BY ORDINAL_POSITION`
    );

    console.log('当前分页相关列:');
    for (const col of structure) {
      console.log(`  - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} (默认: ${col.COLUMN_DEFAULT || 'NULL'})`);
      if (col.COLUMN_COMMENT) {
        console.log(`    说明: ${col.COLUMN_COMMENT}`);
      }
    }

  } finally {
    connection.release();
  }
}

addPaginationSupport()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('添加失败:', error);
    process.exit(1);
  });
