/**
 * 添加数据源审核菜单
 */

import { pool } from '../src/admin/core/database';

async function addApprovalMenu() {
  try {
    console.log('开始添加数据源审核菜单...');

    // 查找数据源管理的父菜单ID（如果有的话）
    const [dsMenus] = await pool.execute(
      "SELECT id, parent_id FROM sys_menus WHERE path = '/datasource' LIMIT 1"
    );
    
    const dsMenu = (dsMenus as any[])[0];
    
    if (!dsMenu) {
      console.log('数据源管理菜单不存在，先创建数据源管理菜单...');
      await pool.execute(
        `INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, is_system, visible, permission_code) 
         VALUES ('datasource-management', '数据源管理', '/datasource', 'DatabaseOutlined', NULL, 6, TRUE, TRUE, 'datasource:view')
         ON DUPLICATE KEY UPDATE title = VALUES(title), path = VALUES(path), icon = VALUES(icon)`
      );
      console.log('✓ 创建数据源管理菜单');
    }

    // 添加数据源审核菜单
    await pool.execute(
      `INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, is_system, visible, permission_code) 
       VALUES ('datasource-approval', '数据源审核', '/datasource/approval', 'AuditOutlined', NULL, 7, TRUE, TRUE, 'datasource:approve')
       ON DUPLICATE KEY UPDATE title = VALUES(title), path = VALUES(path), icon = VALUES(icon), permission_code = VALUES(permission_code), visible = TRUE`
    );
    console.log('✓ 添加数据源审核菜单');

    // 确保管理员角色有审核权限
    const [adminRoles] = await pool.execute(
      "SELECT id FROM sys_roles WHERE code = 'admin' LIMIT 1"
    );
    
    const adminRole = (adminRoles as any[])[0];
    if (adminRole) {
      // 添加审核菜单到管理员角色
      await pool.execute(
        `INSERT INTO sys_role_menus (role_id, menu_id) 
         VALUES (?, 'datasource-approval')
         ON DUPLICATE KEY UPDATE role_id = role_id`,
        [adminRole.id]
      );
      console.log('✓ 将数据源审核菜单分配给管理员角色');
      
      // 添加审核权限到管理员角色
      await pool.execute(
        `INSERT INTO sys_role_permissions (role_id, permission_code) 
         VALUES (?, 'datasource:approve')
         ON DUPLICATE KEY UPDATE role_id = role_id`,
        [adminRole.id]
      );
      console.log('✓ 将数据源审核权限分配给管理员角色');
    }

    console.log('✅ 数据源审核菜单添加完成！');
    console.log('请刷新页面查看菜单');
    process.exit(0);
  } catch (error) {
    console.error('❌ 添加菜单失败:', error);
    process.exit(1);
  }
}

addApprovalMenu();
