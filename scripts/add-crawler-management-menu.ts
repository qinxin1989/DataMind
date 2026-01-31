/**
 * 将爬虫管理菜单添加到数据采集中心
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

async function addCrawlerManagementMenu() {
  const connection = await pool.getConnection();
  
  try {
    console.log('添加爬虫管理菜单到数据采集中心...\n');

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
    console.log('✓ 确保数据采集中心菜单存在\n');

    // 2. 删除其他位置的重复菜单
    await connection.execute(
      `DELETE FROM sys_menus 
       WHERE (title = '爬虫管理' OR path = '/ai/crawler') 
       AND id != ?`,
      [MENU_IDS.CRAWLER_MANAGEMENT]
    );
    console.log('✓ 清理重复菜单');

    // 3. 创建或更新爬虫管理菜单
    await connection.execute(
      `INSERT INTO sys_menus (id, parent_id, title, path, icon, sort_order, is_system, visible)
       VALUES (?, ?, '爬虫管理', '/ai/crawler', 'DatabaseOutlined', 3, TRUE, TRUE)
       ON DUPLICATE KEY UPDATE 
         parent_id = VALUES(parent_id),
         title = VALUES(title),
         path = VALUES(path),
         icon = VALUES(icon),
         sort_order = VALUES(sort_order),
         visible = TRUE`,
      [MENU_IDS.CRAWLER_MANAGEMENT, MENU_IDS.DATA_CENTER]
    );
    console.log('✓ 已创建/更新爬虫管理菜单');

    // 4. 显示最终的菜单结构
    const [finalMenus] = await connection.execute(
      `SELECT m.id, m.title, m.path, m.sort_order 
       FROM sys_menus m
       WHERE m.parent_id = ?
       ORDER BY m.sort_order`,
      [MENU_IDS.DATA_CENTER]
    );

    console.log('\n数据采集中心的子菜单:');
    console.table(finalMenus);

    // 5. 为超级管理员角色添加菜单权限
    await connection.execute(
      `INSERT IGNORE INTO sys_role_menus (role_id, menu_id)
       VALUES ('00000000-0000-0000-0000-000000000001', ?)`,
      [MENU_IDS.CRAWLER_MANAGEMENT]
    );

    console.log('\n✅ 完成！');

  } catch (error) {
    console.error('操作失败:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

addCrawlerManagementMenu().catch(console.error);
