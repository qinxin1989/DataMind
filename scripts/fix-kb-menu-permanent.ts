import { pool } from '../src/admin/core/database';

async function fixKBMenu() {
  const conn = await pool.getConnection();
  try {
    console.log('=== 修复知识库菜单问题 ===\n');
    
    // 1. 查找所有知识库相关菜单
    const [rows] = await conn.execute(
      "SELECT id, title, path, parent_id, module_code, module_name FROM sys_menus WHERE title LIKE '%知识%' OR path LIKE '%knowledge%'"
    );
    
    console.log('当前知识库菜单:');
    for (const r of rows as any[]) {
      const parent = r.parent_id ? `(父: ${r.parent_id})` : '(一级菜单!)';
      console.log(`  - ${r.id}: ${r.title} | ${r.path} ${parent} | module: ${r.module_name || r.module_code}`);
    }
    
    // 2. 删除所有错误的一级知识库菜单（rag-knowledge 或任何 parent_id 为 NULL 的知识库菜单）
    const wrongMenus = (rows as any[]).filter(m => 
      m.parent_id === null && (m.title.includes('知识') || m.id === 'rag-knowledge')
    );
    
    if (wrongMenus.length > 0) {
      console.log('\n=== 删除错误的一级知识库菜单 ===');
      for (const menu of wrongMenus) {
        // 先检查是否有子菜单
        const [children] = await conn.execute(
          'SELECT COUNT(*) as cnt FROM sys_menus WHERE parent_id = ?',
          [menu.id]
        );
        
        if ((children as any[])[0].cnt > 0) {
          console.log(`  ! ${menu.title} 有子菜单，不能删除，跳过`);
        } else {
          await conn.execute('DELETE FROM sys_menus WHERE id = ?', [menu.id]);
          console.log(`  ✓ 已删除: ${menu.title} (${menu.id})`);
        }
      }
    } else {
      console.log('\n✓ 没有错误的一级知识库菜单');
    }
    
    // 3. 确保正确的知识库管理菜单存在且 parent_id 正确
    const [kbMenu] = await conn.execute(
      "SELECT * FROM sys_menus WHERE id = 'knowledge-base'"
    );
    
    if ((kbMenu as any[]).length === 0) {
      console.log('\n=== 创建正确的知识库管理菜单 ===');
      await conn.execute(
        `INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, visible, permission_code, is_system, menu_type, module_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, TRUE, ?, FALSE, 'internal', ?, NOW(), NOW())`,
        ['knowledge-base', '知识库管理', '/ai/knowledge', 'BookOutlined', 'ai-center', 31, 'ai-qa:knowledge:view', 'ai-qa']
      );
      console.log('  ✓ 已创建知识库管理菜单 (parent: ai-center)');
    } else {
      const menu = (kbMenu as any[])[0];
      if (menu.parent_id !== 'ai-center') {
        console.log('\n=== 修复知识库管理菜单的父菜单 ===');
        await conn.execute(
          "UPDATE sys_menus SET parent_id = 'ai-center', module_name = 'ai-qa' WHERE id = 'knowledge-base'"
        );
        console.log('  ✓ 已更新 parent_id 为 ai-center');
      } else {
        console.log('\n✓ 知识库管理菜单已正确配置');
      }
    }
    
    // 4. 显示最终菜单结构
    console.log('\n=== 最终菜单结构 ===');
    const [allMenus] = await conn.execute(
      'SELECT id, title, path, parent_id FROM sys_menus ORDER BY sort_order ASC'
    );
    
    const topMenus = (allMenus as any[]).filter(m => !m.parent_id);
    for (const top of topMenus) {
      console.log(`📁 ${top.title} (${top.id})`);
      const children = (allMenus as any[]).filter(m => m.parent_id === top.id);
      for (const child of children) {
        console.log(`   └─ ${child.title} (${child.id})`);
      }
    }
    
    console.log('\n✅ 知识库菜单修复完成！');
    console.log('注意：请重启后端服务以确保模块系统不会重新创建错误菜单');
  } catch (e) {
    console.error('错误:', e);
  } finally {
    conn.release();
    pool.end();
  }
}

fixKBMenu();
