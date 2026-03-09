import { pool } from '../src/admin/core/database';

async function checkKBMenu() {
  const conn = await pool.getConnection();
  try {
    console.log('=== 检查知识库菜单 ===\n');
    
    // 查找所有知识库相关菜单
    const [rows] = await conn.execute(
      "SELECT id, title, path, parent_id, module_code, visible FROM sys_menus WHERE title LIKE '%知识%' OR path LIKE '%knowledge%'"
    );
    
    console.log('找到以下知识库菜单:');
    for (const r of rows as any[]) {
      const parent = r.parent_id ? `(父: ${r.parent_id})` : '(一级菜单!)';
      console.log(`  - ${r.id}: ${r.title} | ${r.path} ${parent}`);
    }
    
    // 检查是否有重复的一级菜单
    const orphanMenus = (rows as any[]).filter(m => m.parent_id === null && m.title.includes('知识'));
    
    if (orphanMenus.length > 0) {
      console.log('\n=== 发现重复的一级知识库菜单，准备删除 ===');
      for (const menu of orphanMenus) {
        // 先检查是否有子菜单
        const [children] = await conn.execute(
          'SELECT COUNT(*) as cnt FROM sys_menus WHERE parent_id = ?',
          [menu.id]
        );
        
        if ((children as any[])[0].cnt > 0) {
          console.log(`  ! ${menu.title} 有 ${(children as any[])[0].cnt} 个子菜单，不能删除`);
        } else {
          await conn.execute('DELETE FROM sys_menus WHERE id = ?', [menu.id]);
          console.log(`  ✓ 已删除: ${menu.title} (${menu.id})`);
        }
      }
    }
    
    console.log('\n=== 当前菜单结构 ===');
    const [allMenus] = await conn.execute(
      'SELECT id, title, path, parent_id FROM sys_menus ORDER BY sort_order ASC'
    );
    
    const topMenus = (allMenus as any[]).filter(m => !m.parent_id);
    for (const top of topMenus) {
      console.log(`📁 ${top.title} (${top.id})`);
      const children = (allMenus as any[]).filter(m => m.parent_id === top.id);
      for (const child of children) {
        console.log(`   └─ ${child.title}`);
      }
    }
    
    console.log('\n✅ 完成');
  } catch (e) {
    console.error('错误:', e);
  } finally {
    conn.release();
    pool.end();
  }
}

checkKBMenu();
