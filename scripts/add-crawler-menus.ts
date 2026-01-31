/**
 * 添加 AI 爬虫相关菜单到数据采集中心
 * 使用固定的菜单ID确保一致性
 */

import { pool } from '../src/admin/core/database';

// 固定的菜单ID
const MENU_IDS = {
  DATA_CENTER: '00000000-0000-0000-0000-000000000021',
  AI_ASSISTANT: '00000000-0000-0000-0000-000000000022',
  TEMPLATE_CONFIG: '00000000-0000-0000-0000-000000000023',
  CRAWLER_MANAGEMENT: '00000000-0000-0000-0000-000000000014'
};

async function addCrawlerMenus() {
  const connection = await pool.getConnection();
  
  try {
    console.log('开始添加 AI 爬虫菜单到数据采集中心...\n');

    // 1. 确保数据采集中心菜单存在
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
    console.log('✓ 确保数据采集中心菜单存在');

    // 2. 删除其他位置的重复菜单
    await connection.execute(
      `DELETE FROM sys_menus 
       WHERE (title IN ('AI爬虫助手', '采集模板配置', '爬虫管理') 
       OR path IN ('/ai/crawler-assistant', '/ai/crawler-template-config', '/ai/crawler'))
       AND id NOT IN (?, ?, ?, ?)`,
      [MENU_IDS.AI_ASSISTANT, MENU_IDS.TEMPLATE_CONFIG, MENU_IDS.CRAWLER_MANAGEMENT, MENU_IDS.DATA_CENTER]
    );
    console.log('✓ 清理重复菜单');

    // 3. 添加爬虫相关菜单
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
        `INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, is_system, visible)
         VALUES (?, ?, ?, ?, ?, ?, TRUE, TRUE)
         ON DUPLICATE KEY UPDATE 
           title = VALUES(title),
           path = VALUES(path),
           icon = VALUES(icon),
           parent_id = VALUES(parent_id),
           sort_order = VALUES(sort_order),
           visible = TRUE`,
        [menu.id, menu.title, menu.path, menu.icon, MENU_IDS.DATA_CENTER, menu.sortOrder]
      );
      console.log(`✓ 添加菜单: ${menu.title} (${menu.path})`);
    }

    // 4. 验证菜单
    const [result] = await connection.execute(
      `SELECT m.id, m.title, m.path, m.icon, p.title as parent_title, m.sort_order, m.visible
       FROM sys_menus m
       LEFT JOIN sys_menus p ON m.parent_id = p.id
       WHERE m.id IN (?, ?, ?)
       ORDER BY m.sort_order`,
      [MENU_IDS.AI_ASSISTANT, MENU_IDS.TEMPLATE_CONFIG, MENU_IDS.CRAWLER_MANAGEMENT]
    );

    console.log('\n已添加的菜单:');
    console.table(result);

    console.log('\n✅ AI 爬虫菜单添加完成！');
    console.log('请刷新浏览器页面查看新菜单');

  } catch (error) {
    console.error('添加菜单失败:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

addCrawlerMenus().catch(console.error);
