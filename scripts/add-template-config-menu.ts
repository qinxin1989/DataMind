/**
 * 添加采集模板配置菜单
 */

import { pool } from '../src/admin/core/database';

async function addTemplateConfigMenu() {
  const connection = await pool.getConnection();
  
  try {
    console.log('开始添加采集模板配置菜单...');

    // 1. 查找 AI 服务父菜单
    const [aiMenus] = await connection.execute(
      "SELECT id FROM sys_menus WHERE title = 'AI 服务' OR title = 'AI管理' LIMIT 1"
    );
    
    const aiMenuList = aiMenus as any[];
    let aiParentId = null;
    
    if (aiMenuList.length > 0) {
      aiParentId = aiMenuList[0].id;
      console.log(`找到 AI 服务菜单，ID: ${aiParentId}`);
    } else {
      console.error('未找到 AI 服务菜单');
      return;
    }

    // 2. 添加采集模板配置菜单
    await connection.execute(
      `INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, is_system, visible)
       VALUES ('ai-crawler-template-config', '采集模板配置', '/ai/crawler-template-config', 'SettingOutlined', ?, 6, TRUE, TRUE)
       ON DUPLICATE KEY UPDATE 
         title = VALUES(title),
         path = VALUES(path),
         icon = VALUES(icon),
         parent_id = VALUES(parent_id),
         sort_order = VALUES(sort_order),
         visible = TRUE`,
      [aiParentId]
    );
    console.log('✓ 添加菜单: 采集模板配置 (/ai/crawler-template-config)');

    // 3. 验证菜单
    const [result] = await connection.execute(
      `SELECT m.id, m.title, m.path, m.icon, p.title as parent_title, m.sort_order, m.visible
       FROM sys_menus m
       LEFT JOIN sys_menus p ON m.parent_id = p.id
       WHERE m.id = 'ai-crawler-template-config'`
    );

    console.log('\n已添加的菜单:');
    console.table(result);

    console.log('\n✅ 采集模板配置菜单添加完成！');
    console.log('请刷新浏览器页面查看新菜单');

  } catch (error) {
    console.error('添加菜单失败:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

addTemplateConfigMenu().catch(console.error);
