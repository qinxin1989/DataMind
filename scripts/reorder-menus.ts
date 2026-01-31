/**
 * 调整菜单顺序：将数据采集中心移到高效办公工具上面
 */

import { pool } from '../src/admin/core/database';

async function reorderMenus() {
  const connection = await pool.getConnection();
  
  try {
    console.log('开始调整菜单顺序...\n');

    // 1. 先清理重复的数据采集中心菜单
    const [centerMenus] = await connection.execute(
      `SELECT id, title, created_at FROM sys_menus 
       WHERE title = '数据采集中心' 
       ORDER BY created_at ASC`
    );

    const menus = centerMenus as any[];
    if (menus.length > 1) {
      console.log(`发现 ${menus.length} 个重复的"数据采集中心"菜单，正在清理...`);
      
      const keepMenuId = menus[0].id;
      const deleteMenuIds = menus.slice(1).map(m => m.id);

      // 迁移子菜单
      for (const deleteId of deleteMenuIds) {
        await connection.execute(
          'UPDATE sys_menus SET parent_id = ? WHERE parent_id = ?',
          [keepMenuId, deleteId]
        );
      }

      // 删除重复菜单
      for (const deleteId of deleteMenuIds) {
        await connection.execute('DELETE FROM sys_role_menus WHERE menu_id = ?', [deleteId]);
        await connection.execute('DELETE FROM sys_menus WHERE id = ?', [deleteId]);
      }
      console.log('✓ 已清理重复菜单\n');
    }

    // 2. 调整菜单顺序
    // 工作台: 1
    // AI 创新中心: 2
    // 数据资源中心: 3
    // 数据采集中心: 4 (新位置，在高效办公工具之前)
    // 高效办公工具: 5
    // 基础系统管理: 6

    const menuOrder = [
      { title: '工作台', sort: 1 },
      { title: 'AI 创新中心', sort: 2 },
      { title: '数据资源中心', sort: 3 },
      { title: '数据采集中心', sort: 4 },
      { title: '高效办公工具', sort: 5 },
      { title: '基础系统管理', sort: 6 }
    ];

    console.log('调整一级菜单顺序:');
    for (const menu of menuOrder) {
      await connection.execute(
        'UPDATE sys_menus SET sort_order = ? WHERE title = ? AND parent_id IS NULL',
        [menu.sort, menu.title]
      );
      console.log(`✓ ${menu.title}: sort_order = ${menu.sort}`);
    }

    // 3. 显示最终的一级菜单顺序
    const [topMenus] = await connection.execute(
      `SELECT id, title, sort_order, icon 
       FROM sys_menus 
       WHERE parent_id IS NULL 
       ORDER BY sort_order`
    );

    console.log('\n最终的一级菜单顺序:');
    console.table(topMenus);

    // 4. 显示数据采集中心的子菜单
    const [subMenus] = await connection.execute(
      `SELECT m.id, m.title, m.path, m.sort_order 
       FROM sys_menus m
       INNER JOIN sys_menus p ON m.parent_id = p.id
       WHERE p.title = '数据采集中心'
       ORDER BY m.sort_order`
    );

    console.log('\n数据采集中心的子菜单:');
    console.table(subMenus);

    console.log('\n✅ 菜单顺序调整完成！请刷新浏览器查看');

  } catch (error) {
    console.error('调整菜单顺序失败:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

reorderMenus().catch(console.error);
