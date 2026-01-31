/**
 * 修复爬虫管理菜单位置 - 确保只在数据采集中心下
 * 使用固定的菜单ID确保一致性
 */

import { pool } from '../src/admin/core/database';

// 固定的菜单ID
const MENU_IDS = {
  DATA_CENTER: '00000000-0000-0000-0000-000000000021',
  AI_ASSISTANT: '00000000-0000-0000-0000-000000000022',
  TEMPLATE_CONFIG: '00000000-0000-0000-0000-000000000023',
  CRAWLER_MANAGEMENT: '00000000-0000-0000-0000-000000000014',
  OFFICE_TOOLS: '00000000-0000-0000-0000-000000000018'
};

async function fixCrawlerManagementLocation() {
  const connection = await pool.getConnection();
  
  try {
    console.log('检查并修复爬虫管理菜单位置...\n');

    // 1. 查找所有爬虫相关菜单
    const [allCrawlerMenus] = await connection.execute(
      `SELECT id, title, path, parent_id FROM sys_menus 
       WHERE title IN ('爬虫管理', 'AI爬虫助手', '采集模板配置')
       OR path IN ('/ai/crawler', '/ai/crawler-assistant', '/ai/crawler-template-config')`
    );

    console.log('找到的所有爬虫相关菜单:');
    console.table(allCrawlerMenus);

    // 2. 确保数据采集中心菜单存在
    await connection.execute(
      `INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, is_system, visible)
       VALUES (?, '数据采集中心', NULL, 'CloudDownloadOutlined', NULL, 4, TRUE, TRUE)
       ON DUPLICATE KEY UPDATE 
         title = VALUES(title),
         icon = VALUES(icon),
         sort_order = VALUES(sort_order),
         visible = TRUE`,
      [MENU_IDS.DATA_CENTER]
    );
    console.log('\n✓ 确保数据采集中心菜单存在');

    // 3. 删除所有在高效办公工具下的爬虫相关菜单
    const [deleteResult] = await connection.execute(
      `DELETE FROM sys_menus 
       WHERE (title IN ('爬虫管理', 'AI爬虫助手', '采集模板配置')
       OR path IN ('/ai/crawler', '/ai/crawler-assistant', '/ai/crawler-template-config'))
       AND parent_id = ?`,
      [MENU_IDS.OFFICE_TOOLS]
    );
    console.log(`✓ 已删除高效办公工具下的爬虫相关菜单 (${(deleteResult as any).affectedRows} 条)`);

    // 4. 删除所有使用错误ID的重复菜单
    await connection.execute(
      `DELETE FROM sys_menus 
       WHERE (title IN ('爬虫管理', 'AI爬虫助手', '采集模板配置')
       OR path IN ('/ai/crawler', '/ai/crawler-assistant', '/ai/crawler-template-config'))
       AND id NOT IN (?, ?, ?)`,
      [MENU_IDS.AI_ASSISTANT, MENU_IDS.TEMPLATE_CONFIG, MENU_IDS.CRAWLER_MANAGEMENT]
    );
    console.log('✓ 清理重复菜单');

    // 5. 创建或更新正确的菜单结构
    const crawlerMenus = [
      {
        id: MENU_IDS.AI_ASSISTANT,
        title: 'AI爬虫助手',
        path: '/ai/crawler-assistant',
        icon: 'RobotOutlined',
        sortOrder: 1
      },
      {
        id: MENU_IDS.TEMPLATE_CONFIG,
        title: '采集模板配置',
        path: '/ai/crawler-template-config',
        icon: 'SettingOutlined',
        sortOrder: 2
      },
      {
        id: MENU_IDS.CRAWLER_MANAGEMENT,
        title: '爬虫管理',
        path: '/ai/crawler',
        icon: 'DatabaseOutlined',
        sortOrder: 3
      }
    ];

    for (const menu of crawlerMenus) {
      await connection.execute(
        `INSERT INTO sys_menus (id, parent_id, title, path, icon, sort_order, is_system, visible)
         VALUES (?, ?, ?, ?, ?, ?, TRUE, TRUE)
         ON DUPLICATE KEY UPDATE 
           parent_id = VALUES(parent_id),
           title = VALUES(title),
           path = VALUES(path),
           icon = VALUES(icon),
           sort_order = VALUES(sort_order),
           visible = TRUE`,
        [menu.id, MENU_IDS.DATA_CENTER, menu.title, menu.path, menu.icon, menu.sortOrder]
      );
      console.log(`✓ 创建/更新菜单: ${menu.title}`);
    }

    // 6. 确保超级管理员有权限
    for (const menu of crawlerMenus) {
      await connection.execute(
        `INSERT IGNORE INTO sys_role_menus (role_id, menu_id)
         VALUES ('00000000-0000-0000-0000-000000000001', ?)`,
        [menu.id]
      );
    }
    console.log('✓ 确保超级管理员权限');

    // 7. 显示最终结果
    console.log('\n最终的菜单结构:');
    
    const [centerSubMenus] = await connection.execute(
      `SELECT m.id, m.title, m.path, m.sort_order 
       FROM sys_menus m
       WHERE m.parent_id = ?
       ORDER BY m.sort_order`,
      [MENU_IDS.DATA_CENTER]
    );

    console.log('\n数据采集中心的子菜单:');
    console.table(centerSubMenus);

    const [officeSubMenus] = await connection.execute(
      `SELECT m.id, m.title, m.path, m.sort_order 
       FROM sys_menus m
       WHERE m.parent_id = ? AND (m.title LIKE '%爬虫%' OR m.path LIKE '%crawler%')
       ORDER BY m.sort_order`,
      [MENU_IDS.OFFICE_TOOLS]
    );

    if ((officeSubMenus as any[]).length > 0) {
      console.log('\n⚠️ 高效办公工具下仍有爬虫相关菜单:');
      console.table(officeSubMenus);
    } else {
      console.log('\n✓ 高效办公工具下已无爬虫相关菜单');
    }

    console.log('\n✅ 修复完成！请刷新浏览器查看');

  } catch (error) {
    console.error('修复失败:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

fixCrawlerManagementLocation().catch(console.error);
