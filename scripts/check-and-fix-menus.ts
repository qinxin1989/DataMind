import { pool } from '../src/admin/core/database';

async function checkAndFixMenus() {
  const connection = await pool.getConnection();
  try {
    console.log('=== 检查菜单状态 ===\n');
    
    // 1. 查看所有模板优化相关菜单
    const [menus] = await connection.execute(
      "SELECT id, title, path, parent_id, module_code, visible FROM sys_menus WHERE title LIKE '%模板%' OR title LIKE '%优化%' OR path LIKE '%template%'"
    );
    
    console.log('找到以下模板优化菜单:');
    for (const menu of menus as any[]) {
      const parent = menu.parent_id ? `(父菜单: ${menu.parent_id})` : '(一级菜单)';
      console.log(`  - ID: ${menu.id}, 标题: ${menu.title}, 路径: ${menu.path} ${parent}`);
    }
    
    // 2. 检查是否有重复的一级菜单（parent_id 为 NULL 的）
    const orphanMenus = (menus as any[]).filter(m => m.parent_id === null && m.path === '/template-optimizer');
    
    if (orphanMenus.length > 0) {
      console.log('\n=== 发现重复的一级菜单，正在清理... ===');
      for (const menu of orphanMenus) {
        await connection.execute('DELETE FROM sys_menus WHERE id = ?', [menu.id]);
        console.log(`  ✓ 已删除重复菜单: ${menu.title} (ID: ${menu.id})`);
      }
    } else {
      console.log('\n✓ 没有发现重复的一级菜单');
    }
    
    // 3. 确保正确的菜单存在
    const [correctMenu] = await connection.execute(
      "SELECT * FROM sys_menus WHERE path = '/system/template-optimizer'"
    );
    
    if ((correctMenu as any[]).length === 0) {
      console.log('\n=== 正确的菜单不存在，正在创建... ===');
      const { v4: uuidv4 } = await import('uuid');
      const menuId = 'template-optimizer';
      
      await connection.execute(
        `INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, visible, permission_code, is_system, menu_type, open_mode, module_code)
         VALUES (?, ?, ?, ?, 'system-management', ?, TRUE, ?, FALSE, 'internal', 'current', ?)`,
        [menuId, '模板优化', '/system/template-optimizer', 'ThunderboltOutlined', 200, 'template:optimize', 'template-optimizer']
      );
      console.log('  ✓ 已创建正确的菜单');
    } else {
      console.log('\n✓ 正确的菜单已存在');
    }
    
    // 4. 显示最终菜单树
    console.log('\n=== 当前菜单结构 ===');
    const [allMenus] = await connection.execute(
      'SELECT id, title, path, parent_id, sort_order FROM sys_menus ORDER BY sort_order ASC'
    );
    
    const topMenus = (allMenus as any[]).filter(m => !m.parent_id);
    for (const top of topMenus) {
      console.log(`📁 ${top.title} (${top.id})`);
      const children = (allMenus as any[]).filter(m => m.parent_id === top.id);
      for (const child of children) {
        console.log(`   └─ ${child.title} (${child.path})`);
      }
    }
    
    console.log('\n✅ 菜单检查完成！');
  } catch (error) {
    console.error('检查菜单失败:', error);
  } finally {
    connection.release();
    pool.end();
  }
}

checkAndFixMenus();
