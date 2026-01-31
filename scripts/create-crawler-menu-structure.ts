/**
 * 创建爬虫一级菜单结构
 * 将所有爬虫相关功能整合到"数据采集中心"一级菜单下
 */

import { pool } from '../src/admin/core/database';

async function createCrawlerMenuStructure() {
  const connection = await pool.getConnection();
  
  try {
    console.log('开始创建数据采集中心菜单结构...\n');

    // 1. 创建一级菜单：数据采集中心（使用固定ID）
    const crawlerParentId = '00000000-0000-0000-0000-000000000021';
    await connection.execute(
      `INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, is_system, visible)
       VALUES (?, '数据采集中心', NULL, 'CloudDownloadOutlined', NULL, 4, TRUE, TRUE)
       ON DUPLICATE KEY UPDATE 
         title = VALUES(title),
         icon = VALUES(icon),
         sort_order = VALUES(sort_order),
         visible = TRUE`,
      [crawlerParentId]
    );
    console.log('✓ 创建一级菜单: 数据采集中心');

    // 2. 更新其他顶级菜单的排序
    await connection.execute(
      `UPDATE sys_menus SET sort_order = 5 WHERE id = '00000000-0000-0000-0000-000000000018'`  // 高效办公工具
    );
    await connection.execute(
      `UPDATE sys_menus SET sort_order = 6 WHERE id = '00000000-0000-0000-0000-000000000010'`  // 基础系统管理
    );
    console.log('✓ 更新其他菜单排序');

    // 3. 查找现有的爬虫相关菜单
    const [existingMenus] = await connection.execute(
      `SELECT id, title, path, parent_id FROM sys_menus 
       WHERE title IN ('AI爬虫助手', '爬虫管理', '采集模板配置') 
       OR path IN ('/ai/crawler-assistant', '/ai/crawler', '/ai/crawler-template-config')`
    );

    const existing = existingMenus as any[];
    console.log(`\n找到 ${existing.length} 个现有爬虫菜单`);

    // 4. 定义新的菜单结构（使用固定ID）
    const crawlerMenus = [
      {
        id: '00000000-0000-0000-0000-000000000022',
        title: 'AI爬虫助手',
        path: '/ai/crawler-assistant',
        icon: 'RobotOutlined',
        sort: 1
      },
      {
        id: '00000000-0000-0000-0000-000000000023',
        title: '采集模板配置',
        path: '/ai/crawler-template-config',
        icon: 'SettingOutlined',
        sort: 2
      },
      {
        id: '00000000-0000-0000-0000-000000000014',
        title: '爬虫管理',
        path: '/ai/crawler',
        icon: 'DatabaseOutlined',
        sort: 3
      }
    ];

    // 5. 处理每个菜单
    for (const menu of crawlerMenus) {
      // 查找是否有重复菜单
      const duplicate = existing.find(e => 
        e.path === menu.path || e.title === menu.title
      );

      if (duplicate && duplicate.id !== menu.id) {
        console.log(`\n处理重复菜单: ${menu.title}`);
        
        // 迁移角色权限
        await connection.execute(
          'UPDATE IGNORE sys_role_menus SET menu_id = ? WHERE menu_id = ?',
          [menu.id, duplicate.id]
        );
        console.log(`  - 迁移角色权限: ${duplicate.id} -> ${menu.id}`);
        
        // 删除旧菜单
        await connection.execute('DELETE FROM sys_menus WHERE id = ?', [duplicate.id]);
        await connection.execute('DELETE FROM sys_role_menus WHERE menu_id = ?', [duplicate.id]);
        console.log(`  - 删除旧菜单: ${duplicate.id}`);
      }

      // 插入或更新菜单
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
        [menu.id, menu.title, menu.path, menu.icon, crawlerParentId, menu.sort]
      );
      console.log(`✓ 添加子菜单: ${menu.title} (${menu.path})`);
    }

    // 6. 验证菜单结构
    const [result] = await connection.execute(
      `SELECT m.id, m.title, m.path, m.icon, COALESCE(p.title, '顶级菜单') as parent_title, m.sort_order, m.visible
       FROM sys_menus m
       LEFT JOIN sys_menus p ON m.parent_id = p.id
       WHERE m.parent_id = ? OR m.id = ?
       ORDER BY m.sort_order`,
      [crawlerParentId, crawlerParentId]
    );

    console.log('\n\n已创建的菜单结构:');
    console.table(result);

    console.log('\n✅ 数据采集中心菜单结构创建完成！');
    console.log('请刷新浏览器页面查看新菜单');

  } catch (error) {
    console.error('创建菜单结构失败:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

createCrawlerMenuStructure().catch(console.error);
