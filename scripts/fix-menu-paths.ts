import { pool } from '../src/admin/core/database';

async function fixMenuPaths() {
  try {
    console.log('检查菜单路径...');

    // 查询所有菜单
    const [rows] = await pool.execute('SELECT id, title, path FROM sys_menus');
    console.log('当前菜单:', rows);

    // 修复用户管理、角色管理、菜单管理的路径
    const fixes = [
      { title: '用户管理', path: '/user' },
      { title: '角色管理', path: '/role' },
      { title: '菜单管理', path: '/menu' },
    ];

    for (const fix of fixes) {
      await pool.execute(
        'UPDATE sys_menus SET path = ? WHERE title = ?',
        [fix.path, fix.title]
      );
      console.log(`✓ 修复菜单路径: ${fix.title} -> ${fix.path}`);
    }

    console.log('✅ 菜单路径修复完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 修复失败:', error);
    process.exit(1);
  }
}

fixMenuPaths();
