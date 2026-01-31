/**
 * 更新河北模板为动态渲染
 */

import { pool } from '../src/admin/core/database';

async function updateHebeiTemplate() {
  console.log('========================================');
  console.log('更新河北模板配置');
  console.log('========================================\n');

  const connection = await pool.getConnection();

  try {
    // 更新page_type为dynamic
    await connection.execute(
      `UPDATE crawler_templates
       SET page_type = 'dynamic',
           updated_at = NOW()
       WHERE name = '河北政策文件'`
    );

    console.log('✓ 河北模板已更新为动态渲染\n');

    // 验证
    const [templates] = await connection.execute(
      'SELECT name, page_type FROM crawler_templates WHERE name = ?',
      ['河北政策文件']
    );

    for (const tpl of templates as any[]) {
      console.log('更新后的配置:');
      console.log(`  名称: ${tpl.name}`);
      console.log(`  页面类型: ${tpl.page_type}`);
    }

    console.log('\n✓ 更新完成！');

  } finally {
    connection.release();
  }
}

updateHebeiTemplate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('更新失败:', error);
    process.exit(1);
  });
