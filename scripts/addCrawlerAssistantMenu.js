/**
 * 添加 AI 爬虫助手菜单
 * 运行方式：node scripts/addCrawlerAssistantMenu.js
 */

const { pool } = require('../src/admin/core/database');

async function addMenu() {
  try {
    console.log('开始添加 AI 爬虫助手菜单...');

    // 1. 删除可能存在的旧菜单
    await pool.execute(
      'DELETE FROM admin_menus WHERE id = ? OR path = ?',
      ['ai-crawler-assistant', '/ai/crawler-assistant']
    );
    console.log('✓ 清理旧菜单（如果有）');

    // 2. 添加新菜单
    await pool.execute(
      `INSERT INTO admin_menus (id, title, path, icon, parent_id, sort_order, is_system, visible)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['ai-crawler-assistant', 'AI爬虫助手', '/ai/crawler-assistant', 'RobotOutlined', '00000000-0000-0000-0000-000000000005', 5, true, true]
    );
    console.log('✓ 添加新菜单');

    // 3. 验证是否添加成功
    const [menus] = await pool.execute(
      `SELECT m.*, p.title as parent_title
       FROM admin_menus m
       LEFT JOIN admin_menus p ON m.parent_id = p.id
       WHERE m.id = 'ai-crawler-assistant'`
    );

    if (menus.length > 0) {
      console.log('\n✅ 菜单添加成功！');
      console.log('菜单详情：', menus[0]);
      console.log('\n请刷新页面或重新登录查看新菜单。');
    } else {
      console.log('\n❌ 菜单添加失败，请检查错误');
    }

    // 4. 显示 AI 创新中心下的所有菜单
    const [allMenus] = await pool.execute(
      `SELECT id, title, path, sort_order, visible
       FROM admin_menus
       WHERE parent_id = '00000000-0000-0000-0000-000000000005'
       ORDER BY sort_order`
    );

    console.log('\n📋 AI 创新中心下的所有菜单：');
    allMenus.forEach((menu, index) => {
      console.log(`  ${index + 1}. ${menu.title} (${menu.path}) - sort_order: ${menu.sort_order}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

addMenu();
