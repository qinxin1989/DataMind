/**
 * 同步菜单数据到数据库
 * 使菜单管理页面与左侧导航栏一致
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

async function syncMenus() {
  const pool = mysql.createPool({
    host: process.env.CONFIG_DB_HOST || 'localhost',
    port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
    user: process.env.CONFIG_DB_USER || 'root',
    password: process.env.CONFIG_DB_PASSWORD || '',
    database: process.env.CONFIG_DB_NAME || 'ai-data-platform',
  });

  const connection = await pool.getConnection();

  try {
    // 清空现有菜单（忽略表不存在的错误）
    try {
      await connection.execute('DELETE FROM sys_role_menus');
    } catch (e) {
      // 表可能不存在，忽略
    }
    await connection.execute('DELETE FROM sys_menus');

    // 定义新的菜单结构（与 AdminLayout.vue 一致）
    const menus = [
      // 仪表盘
      { id: '1', title: '仪表盘', path: '/dashboard', icon: 'DashboardOutlined', parentId: null, sortOrder: 1 },
      
      // AI服务（父菜单）
      { id: '2', title: 'AI服务', path: null, icon: 'RobotOutlined', parentId: null, sortOrder: 2 },
      { id: '2-1', title: 'AI问答', path: '/ai/chat', icon: 'MessageOutlined', parentId: '2', sortOrder: 1 },
      { id: '2-2', title: '知识库', path: '/ai/knowledge', icon: 'BookOutlined', parentId: '2', sortOrder: 2 },
      { id: '2-3', title: '对话历史', path: '/ai/history', icon: 'HistoryOutlined', parentId: '2', sortOrder: 3 },
      
      // 权限管理（父菜单）
      { id: '3', title: '权限管理', path: null, icon: 'TeamOutlined', parentId: null, sortOrder: 3 },
      { id: '3-1', title: '用户管理', path: '/user', icon: 'UserOutlined', parentId: '3', sortOrder: 1, permissionCode: 'user:view' },
      { id: '3-2', title: '角色管理', path: '/role', icon: 'TeamOutlined', parentId: '3', sortOrder: 2, permissionCode: 'role:view' },
      { id: '3-3', title: '菜单管理', path: '/menu', icon: 'MenuOutlined', parentId: '3', sortOrder: 3, permissionCode: 'menu:view' },
      
      // AI配置（父菜单）
      { id: '4', title: 'AI配置', path: null, icon: 'SettingOutlined', parentId: null, sortOrder: 4 },
      { id: '4-1', title: 'AI管理', path: '/ai/config', icon: 'ControlOutlined', parentId: '4', sortOrder: 1, permissionCode: 'ai:view' },
      { id: '4-2', title: '使用统计', path: '/ai/stats', icon: 'BarChartOutlined', parentId: '4', sortOrder: 2, permissionCode: 'ai:view' },
      
      // 系统配置（父菜单）
      { id: '5', title: '系统配置', path: null, icon: 'DatabaseOutlined', parentId: null, sortOrder: 5 },
      { id: '5-1', title: '数据源管理', path: '/datasource', icon: 'DatabaseOutlined', parentId: '5', sortOrder: 1, permissionCode: 'datasource:view' },
      { id: '5-2', title: '系统管理', path: '/system/config', icon: 'SettingOutlined', parentId: '5', sortOrder: 2, permissionCode: 'system:view' },
      
      // 通知中心
      { id: '6', title: '通知中心', path: '/notification', icon: 'BellOutlined', parentId: null, sortOrder: 6 },
    ];

    // 插入菜单
    for (const menu of menus) {
      const id = uuidv4();
      await connection.execute(
        `INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, permission_code, visible, is_system)
         VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, TRUE)`,
        [id, menu.title, menu.path, menu.icon, menu.parentId ? menus.find(m => m.id === menu.parentId)?.id : null, menu.sortOrder, menu.permissionCode || null]
      );
      // 更新 id 为实际 UUID
      (menu as any).uuid = id;
    }

    // 重新插入，使用正确的 parent_id
    await connection.execute('DELETE FROM sys_menus');
    
    const menuMap = new Map<string, string>();
    
    // 先插入所有菜单，生成 UUID
    for (const menu of menus) {
      menuMap.set(menu.id, uuidv4());
    }

    // 再插入数据
    for (const menu of menus) {
      const uuid = menuMap.get(menu.id)!;
      const parentUuid = menu.parentId ? menuMap.get(menu.parentId) : null;
      
      await connection.execute(
        `INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, permission_code, visible, is_system)
         VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, TRUE)`,
        [uuid, menu.title, menu.path, menu.icon, parentUuid, menu.sortOrder, (menu as any).permissionCode || null]
      );
    }

    console.log('菜单同步完成！共插入', menus.length, '条菜单');

    // 查询并显示结果
    const [rows] = await connection.execute(`
      SELECT m.*, p.title as parent_title 
      FROM sys_menus m 
      LEFT JOIN sys_menus p ON m.parent_id = p.id 
      ORDER BY m.sort_order, m.id
    `);
    console.log('\n当前菜单结构:');
    for (const row of rows as any[]) {
      const indent = row.parent_id ? '  └─ ' : '';
      console.log(`${indent}${row.title} (${row.path || '无路径'})`);
    }

  } finally {
    connection.release();
    await pool.end();
  }
}

syncMenus().catch(console.error);
