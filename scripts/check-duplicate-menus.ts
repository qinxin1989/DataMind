/**
 * 检查并清理重复的爬虫菜单
 */

import { pool } from '../src/admin/core/database';

async function checkDuplicateMenus() {
  const connection = await pool.getConnection();
  
  try {
    console.log('检查重复菜单...\n');

    // 1. 查找所有爬虫相关菜单
    const [allMenus] = await connection.execute(
      `SELECT id, title, path, parent_id, sort_order, visible 
       FROM sys_menus 
       WHERE title LIKE '%爬虫%' OR title LIKE '%采集%' OR path LIKE '%crawler%'
       ORDER BY title, sort_order`
    );

    console.log('找到的所有爬虫相关菜单:');
    console.table(allMenus);

    // 2. 查找父菜单
    const [parentMenus] = await connection.execute(
      `SELECT id, title, path, parent_id 
       FROM sys_menus 
       WHERE title IN ('数据采集', '数据采集中心', 'AI 服务', '高效办公工具')
       ORDER BY title`
    );

    console.log('\n父菜单:');
    console.table(parentMenus);

    // 3. 查找需要删除的重复菜单
    const menusToDelete: string[] = [];
    
    // 删除旧的"数据采集"菜单（保留"数据采集中心"）
    const [oldDataCollectionMenus] = await connection.execute(
      `SELECT id FROM sys_menus WHERE title = '数据采集' AND title != '数据采集中心'`
    );
    
    for (const menu of oldDataCollectionMenus as any[]) {
      menusToDelete.push(menu.id);
    }

    // 删除在其他父菜单下的爬虫子菜单（保留在"数据采集中心"下的）
    const [crawlerCenterMenu] = await connection.execute(
      `SELECT id FROM sys_menus WHERE title = '数据采集中心' LIMIT 1`
    );
    
    if ((crawlerCenterMenu as any[]).length > 0) {
      const centerId = (crawlerCenterMenu as any[])[0].id;
      
      const [duplicateSubMenus] = await connection.execute(
        `SELECT id, title, parent_id FROM sys_menus 
         WHERE (title IN ('AI爬虫助手', '爬虫管理', '采集模板配置') 
         OR path IN ('/ai/crawler-assistant', '/ai/crawler', '/ai/crawler-template-config'))
         AND parent_id != ?`,
        [centerId]
      );
      
      for (const menu of duplicateSubMenus as any[]) {
        console.log(`\n发现重复子菜单: ${menu.title} (parent_id: ${menu.parent_id})`);
        menusToDelete.push(menu.id);
      }
    }

    if (menusToDelete.length > 0) {
      console.log(`\n准备删除 ${menusToDelete.length} 个重复菜单...`);
      
      for (const menuId of menusToDelete) {
        // 删除角色菜单关联
        await connection.execute('DELETE FROM sys_role_menus WHERE menu_id = ?', [menuId]);
        // 删除菜单
        await connection.execute('DELETE FROM sys_menus WHERE id = ?', [menuId]);
        console.log(`✓ 已删除菜单: ${menuId}`);
      }
    } else {
      console.log('\n没有发现重复菜单');
    }

    // 4. 显示清理后的菜单结构
    const [finalMenus] = await connection.execute(
      `SELECT m.id, m.title, m.path, p.title as parent_title, m.sort_order 
       FROM sys_menus m
       LEFT JOIN sys_menus p ON m.parent_id = p.id
       WHERE m.title LIKE '%爬虫%' OR m.title LIKE '%采集%' OR m.path LIKE '%crawler%'
       ORDER BY p.title, m.sort_order`
    );

    console.log('\n清理后的菜单结构:');
    console.table(finalMenus);

    console.log('\n✅ 菜单检查和清理完成！');

  } catch (error) {
    console.error('检查菜单失败:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

checkDuplicateMenus().catch(console.error);
