import { pool } from '../src/admin/core/database';

async function fixDatasourceMenu() {
  const conn = await pool.getConnection();
  try {
    console.log('=== 修复数据源菜单层级 ===\n');
    
    // 查找数据源相关菜单
    const [rows] = await conn.execute(
      "SELECT id, title, path, parent_id FROM sys_menus WHERE title LIKE '%数据源%' ORDER BY id"
    );
    
    console.log('当前数据源菜单:');
    for (const r of rows as any[]) {
      const parent = r.parent_id ? `(父: ${r.parent_id})` : '(一级菜单!)';
      console.log(`  - ${r.id}: ${r.title} ${parent}`);
    }
    
    // 应该的结构：
    // data-center (数据资源中心) - 一级
    //   └─ datasource-management-menu (数据源管理)
    //   └─ datasource-approval-menu (数据源审核)
    
    // 检查并修复数据源管理菜单
    const [mgmtMenu] = await conn.execute(
      "SELECT * FROM sys_menus WHERE id = 'datasource-management-menu'"
    );
    
    if ((mgmtMenu as any[]).length > 0) {
      const menu = (mgmtMenu as any[])[0];
      if (menu.parent_id !== 'data-center') {
        console.log('\n修复: 数据源管理菜单的父菜单应该是 data-center');
        await conn.execute(
          "UPDATE sys_menus SET parent_id = 'data-center' WHERE id = 'datasource-management-menu'"
        );
        console.log('  ✓ 已更新');
      } else {
        console.log('\n✓ 数据源管理菜单层级正确');
      }
    }
    
    // 检查并修复数据源审核菜单
    const [approvalMenu] = await conn.execute(
      "SELECT * FROM sys_menus WHERE id = 'datasource-approval-menu'"
    );
    
    if ((approvalMenu as any[]).length > 0) {
      const menu = (approvalMenu as any[])[0];
      if (menu.parent_id !== 'data-center') {
        console.log('修复: 数据源审核菜单的父菜单应该是 data-center');
        await conn.execute(
          "UPDATE sys_menus SET parent_id = 'data-center' WHERE id = 'datasource-approval-menu'"
        );
        console.log('  ✓ 已更新');
      } else {
        console.log('✓ 数据源审核菜单层级正确');
      }
    }
    
    // 删除错误的数据源管理一级菜单（如果有）
    const wrongMenus = (rows as any[]).filter(m => 
      m.parent_id === null && (m.id.includes('datasource') || m.title.includes('数据源'))
    );
    
    for (const menu of wrongMenus) {
      // 检查是否有子菜单
      const [children] = await conn.execute(
        'SELECT COUNT(*) as cnt FROM sys_menus WHERE parent_id = ?',
        [menu.id]
      );
      
      if ((children as any[])[0].cnt === 0) {
        console.log(`\n删除错误的一级菜单: ${menu.title}`);
        await conn.execute('DELETE FROM sys_menus WHERE id = ?', [menu.id]);
        console.log('  ✓ 已删除');
      }
    }
    
    console.log('\n=== 最终数据源菜单结构 ===');
    const [finalRows] = await conn.execute(
      "SELECT id, title, parent_id FROM sys_menus WHERE title LIKE '%数据源%' OR id = 'data-center' ORDER BY parent_id, sort_order"
    );
    
    for (const r of finalRows as any[]) {
      const level = r.parent_id ? '  └─ ' : '📁 ';
      console.log(`${level}${r.title} (${r.id})`);
    }
    
    console.log('\n✅ 数据源菜单修复完成！');
  } catch (e) {
    console.error('错误:', e);
  } finally {
    conn.release();
    pool.end();
  }
}

fixDatasourceMenu();
