import { pool } from '../src/admin/core/database';

async function checkDataCenter() {
  const conn = await pool.getConnection();
  try {
    console.log('=== 检查数据资源中心菜单 ===\n');
    
    const [rows] = await conn.execute(
      'SELECT id, title, path, parent_id FROM sys_menus WHERE id IN ("data-center", "system-management")'
    );
    
    console.log('关键菜单:');
    for (const r of rows as any[]) {
      const parent = r.parent_id ? `child of ${r.parent_id}` : 'TOP LEVEL';
      console.log(`  - ${r.id}: ${r.title} (${parent})`);
    }
    
    // 检查 data-center 的 parent_id
    const dataCenter = (rows as any[]).find(r => r.id === 'data-center');
    if (dataCenter) {
      if (dataCenter.parent_id) {
        console.log(`\n❌ 问题: data-center 的 parent_id = ${dataCenter.parent_id}`);
        console.log('应该为 NULL（一级菜单）');
        
        // 修复它
        await conn.execute('UPDATE sys_menus SET parent_id = NULL WHERE id = "data-center"');
        console.log('\n✅ 已修复: data-center 现在是一级菜单');
      } else {
        console.log('\n✅ data-center 是一级菜单，正确');
      }
    }
    
    // 显示完整菜单树
    console.log('\n=== 完整菜单结构 ===');
    const [allMenus] = await conn.execute(
      'SELECT id, title, parent_id FROM sys_menus ORDER BY sort_order'
    );
    
    const topMenus = (allMenus as any[]).filter(m => !m.parent_id);
    for (const top of topMenus) {
      console.log(`📁 ${top.title} (${top.id})`);
      const children = (allMenus as any[]).filter(m => m.parent_id === top.id);
      for (const child of children) {
        console.log(`   └─ ${child.title} (${child.id})`);
      }
    }
    
  } catch (e) {
    console.error('错误:', e);
  } finally {
    conn.release();
    pool.end();
  }
}

checkDataCenter();
