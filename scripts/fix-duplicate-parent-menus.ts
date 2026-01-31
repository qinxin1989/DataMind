/**
 * 修复重复的数据采集中心父菜单
 */

import { pool } from '../src/admin/core/database';

async function fixDuplicateParentMenus() {
  const connection = await pool.getConnection();
  
  try {
    console.log('修复重复的数据采集中心菜单...\n');

    // 1. 查找所有"数据采集中心"菜单
    const [centerMenus] = await connection.execute(
      `SELECT id, title, created_at FROM sys_menus 
       WHERE title = '数据采集中心' 
       ORDER BY created_at ASC`
    );

    const menus = centerMenus as any[];
    console.log(`找到 ${menus.length} 个"数据采集中心"菜单:`);
    console.table(menus);

    if (menus.length <= 1) {
      console.log('\n没有重复菜单，无需处理');
      return;
    }

    // 2. 保留最早创建的菜单，删除其他的
    const keepMenuId = menus[0].id;
    const deleteMenuIds = menus.slice(1).map(m => m.id);

    console.log(`\n保留菜单: ${keepMenuId}`);
    console.log(`删除菜单: ${deleteMenuIds.join(', ')}`);

    // 3. 将所有子菜单迁移到保留的父菜单下
    for (const deleteId of deleteMenuIds) {
      await connection.execute(
        'UPDATE sys_menus SET parent_id = ? WHERE parent_id = ?',
        [keepMenuId, deleteId]
      );
      console.log(`✓ 已迁移子菜单: ${deleteId} -> ${keepMenuId}`);
    }

    // 4. 删除重复的父菜单
    for (const deleteId of deleteMenuIds) {
      await connection.execute('DELETE FROM sys_role_menus WHERE menu_id = ?', [deleteId]);
      await connection.execute('DELETE FROM sys_menus WHERE id = ?', [deleteId]);
      console.log(`✓ 已删除菜单: ${deleteId}`);
    }

    // 5. 显示最终的菜单结构
    const [finalMenus] = await connection.execute(
      `SELECT m.id, m.title, m.path, p.title as parent_title, m.sort_order 
       FROM sys_menus m
       LEFT JOIN sys_menus p ON m.parent_id = p.id
       WHERE m.title LIKE '%爬虫%' OR m.title LIKE '%采集%' OR m.path LIKE '%crawler%'
       ORDER BY COALESCE(p.sort_order, m.sort_order), m.sort_order`
    );

    console.log('\n最终的菜单结构:');
    console.table(finalMenus);

    console.log('\n✅ 修复完成！请刷新浏览器查看');

  } catch (error) {
    console.error('修复失败:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

fixDuplicateParentMenus().catch(console.error);
