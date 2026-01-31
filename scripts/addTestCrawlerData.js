/**
 * 添加爬虫测试数据
 * 运行：node scripts/addTestCrawlerData.js
 */

const { pool } = require('../src/admin/core/database');
const { v4: uuidv4 } = require('uuid');

async function addTestData() {
  try {
    console.log('开始添加爬虫测试数据...\n');

    const userId = 'admin';
    const templateId = uuidv4();
    const resultId = uuidv4();

    // 1. 创建测试模板
    await pool.execute(
      `INSERT INTO crawler_templates (id, user_id, name, url, container_selector)
       VALUES (?, ?, ?, ?, ?)`,
      [templateId, userId, '测试新闻爬虫', 'https://example.com/news', '.news-item']
    );
    console.log('✓ 创建测试模板');

    // 2. 创建模板字段
    await pool.execute(
      `INSERT INTO crawler_template_fields (id, template_id, field_name, field_selector)
       VALUES (?, ?, ?, ?)`,
      [uuidv4(), templateId, '标题', '.title']
    );
    await pool.execute(
      `INSERT INTO crawler_template_fields (id, template_id, field_name, field_selector)
       VALUES (?, ?, ?, ?)`,
      [uuidv4(), templateId, '链接', 'a.href']
    );
    console.log('✓ 创建模板字段');

    // 3. 创建采集结果批次
    await pool.execute(
      `INSERT INTO crawler_results (id, user_id, template_id, status, row_count)
       VALUES (?, ?, ?, ?, ?)`,
      [resultId, userId, templateId, 'completed', 3]
    );
    console.log('✓ 创建采集批次');

    // 4. 创建采集数据行
    const row1Id = uuidv4();
    const row2Id = uuidv4();
    const row3Id = uuidv4();

    await pool.execute(
      `INSERT INTO crawler_result_rows (id, result_id) VALUES (?, ?)`,
      [row1Id, resultId]
    );
    await pool.execute(
      `INSERT INTO crawler_result_rows (id, result_id) VALUES (?, ?)`,
      [row2Id, resultId]
    );
    await pool.execute(
      `INSERT INTO crawler_result_rows (id, result_id) VALUES (?, ?)`,
      [row3Id, resultId]
    );
    console.log('✓ 创建数据行');

    // 5. 创建字段值
    const testData = [
      { rowId: row1Id, title: '测试新闻标题1', link: 'https://example.com/news/1' },
      { rowId: row2Id, title: '测试新闻标题2', link: 'https://example.com/news/2' },
      { rowId: row3Id, title: '测试新闻标题3', link: 'https://example.com/news/3' }
    ];

    for (const data of testData) {
      await pool.execute(
        `INSERT INTO crawler_result_items (id, row_id, field_name, field_value)
         VALUES (?, ?, ?, ?)`,
        [uuidv4(), data.rowId, '标题', data.title]
      );
      await pool.execute(
        `INSERT INTO crawler_result_items (id, row_id, field_name, field_value)
         VALUES (?, ?, ?, ?)`,
        [uuidv4(), data.rowId, '链接', data.link]
      );
    }
    console.log('✓ 创建字段值');

    console.log('\n✅ 测试数据添加完成！');
    console.log('\n现在您可以在"爬虫管理"的"采集记录"中看到测试数据。');

    // 验证数据
    const [results] = await pool.execute('SELECT * FROM crawler_results WHERE user_id = ?', [userId]);
    console.log(`\n📊 采集批次数量: ${results.length}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

addTestData();
