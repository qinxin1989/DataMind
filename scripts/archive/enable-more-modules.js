/**
 * 启用更多模块
 */

const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function enableMoreModules() {
  let connection;
  
  try {
    console.log('正在连接数据库...');
    
    connection = await mysql.createConnection({
      host: process.env.CONFIG_DB_HOST || 'localhost',
      port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
      user: process.env.CONFIG_DB_USER || 'root',
      password: process.env.CONFIG_DB_PASSWORD || '',
      database: process.env.CONFIG_DB_NAME || 'DataMind',
      charset: 'utf8mb4'
    });
    
    console.log('数据库连接成功');
    
    // 手动注册更多模块
    const modules = [
      {
        name: 'dashboard',
        displayName: '大屏管理',
        version: '1.0.0',
        description: '数据大屏配置和管理',
        type: 'business',
        category: 'visualization',
        menus: [
          {
            id: 'dashboard-main',
            title: '大屏管理',
            path: '/system/dashboard',
            icon: 'DashboardOutlined',
            parentId: 'system-center',
            sortOrder: 905,
            permission: 'dashboard:view'
          }
        ],
        permissions: [
          { code: 'dashboard:view', name: '查看大屏', description: '查看大屏列表和详情' },
          { code: 'dashboard:create', name: '创建大屏', description: '创建新的大屏' }
        ]
      },
      {
        name: 'user-management',
        displayName: '用户管理',
        version: '1.0.0',
        description: '用户账户管理',
        type: 'system',
        category: 'management',
        menus: [
          {
            id: 'user-management-main',
            title: '用户管理',
            path: '/system/users',
            icon: 'UserOutlined',
            parentId: 'system-center',
            sortOrder: 100,
            permission: 'user:view'
          }
        ],
        permissions: [
          { code: 'user:view', name: '查看用户', description: '查看用户列表' },
          { code: 'user:create', name: '创建用户', description: '创建新用户' }
        ]
      },
      {
        name: 'role-management',
        displayName: '角色管理',
        version: '1.0.0',
        description: '角色权限管理',
        type: 'system',
        category: 'management',
        menus: [
          {
            id: 'role-management-main',
            title: '角色管理',
            path: '/system/roles',
            icon: 'TeamOutlined',
            parentId: 'system-center',
            sortOrder: 200,
            permission: 'role:view'
          }
        ],
        permissions: [
          { code: 'role:view', name: '查看角色', description: '查看角色列表' },
          { code: 'role:create', name: '创建角色', description: '创建新角色' }
        ]
      },
      {
        name: 'menu-management',
        displayName: '菜单管理',
        version: '1.0.0',
        description: '系统菜单管理',
        type: 'system',
        category: 'management',
        menus: [
          {
            id: 'menu-management-main',
            title: '菜单管理',
            path: '/system/menus',
            icon: 'MenuOutlined',
            parentId: 'system-center',
            sortOrder: 300,
            permission: 'menu:view'
          }
        ],
        permissions: [
          { code: 'menu:view', name: '查看菜单', description: '查看菜单列表' },
          { code: 'menu:create', name: '创建菜单', description: '创建新菜单' }
        ]
      },
      {
        name: 'notification',
        displayName: '通知中心',
        version: '1.0.0',
        description: '系统通知管理',
        type: 'system',
        category: 'communication',
        menus: [
          {
            id: 'notification-main',
            title: '通知中心',
            path: '/system/notification',
            icon: 'BellOutlined',
            parentId: 'system-center',
            sortOrder: 400,
            permission: 'notification:view'
          }
        ],
        permissions: [
          { code: 'notification:view', name: '查看通知', description: '查看通知列表' }
        ]
      },
      {
        name: 'system-config',
        displayName: '系统配置',
        version: '1.0.0',
        description: '系统配置管理',
        type: 'system',
        category: 'configuration',
        menus: [
          {
            id: 'system-config-main',
            title: '系统配置',
            path: '/system/config',
            icon: 'SettingOutlined',
            parentId: 'system-center',
            sortOrder: 500,
            permission: 'system:config'
          }
        ],
        permissions: [
          { code: 'system:config', name: '系统配置', description: '管理系统配置' }
        ]
      },
      {
        name: 'file-tools',
        displayName: '文件工具',
        version: '1.0.0',
        description: '文件处理工具',
        type: 'tool',
        category: 'utility',
        menus: [
          {
            id: 'file-tools-main',
            title: '文件工具',
            path: '/tools/file',
            icon: 'FileTextOutlined',
            parentId: 'tools-center',
            sortOrder: 100,
            permission: 'file:tools'
          }
        ],
        permissions: [
          { code: 'file:tools', name: '文件工具', description: '使用文件处理工具' }
        ]
      },
      {
        name: 'efficiency-tools',
        displayName: '效率工具',
        version: '1.0.0',
        description: '开发效率工具',
        type: 'tool',
        category: 'development',
        menus: [
          {
            id: 'efficiency-tools-main',
            title: '效率工具',
            path: '/tools/efficiency',
            icon: 'ThunderboltOutlined',
            parentId: 'tools-center',
            sortOrder: 200,
            permission: 'efficiency:tools'
          }
        ],
        permissions: [
          { code: 'efficiency:tools', name: '效率工具', description: '使用效率工具' }
        ]
      },
      {
        name: 'ai-qa',
        displayName: 'AI智能问答',
        version: '1.0.0',
        description: 'AI智能问答系统',
        type: 'business',
        category: 'ai',
        menus: [
          {
            id: 'ai-qa-main',
            title: 'AI智能问答',
            path: '/ai/qa',
            icon: 'QuestionCircleOutlined',
            parentId: 'ai-center',
            sortOrder: 200,
            permission: 'ai:qa'
          }
        ],
        permissions: [
          { code: 'ai:qa', name: 'AI问答', description: '使用AI智能问答' }
        ]
      }
    ];
    
    for (const module of modules) {
      console.log(`注册模块: ${module.displayName}`);
      
      // 插入主模块记录
      const moduleId = uuidv4();
      await connection.execute(
        `INSERT IGNORE INTO sys_modules (id, name, display_name, version, description, type, category, status, installed_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 'installed', NOW())`,
        [moduleId, module.name, module.displayName, module.version, module.description, module.type, module.category]
      );
      
      // 插入权限
      for (const perm of module.permissions) {
        await connection.execute(
          `INSERT IGNORE INTO sys_permissions (id, code, name, description, created_at) VALUES (?, ?, ?, ?, NOW())`,
          [uuidv4(), perm.code, perm.name, perm.description]
        );
        
        // 给admin角色分配权限
        const [adminRoles] = await connection.execute('SELECT id FROM sys_roles WHERE code = ?', ['admin']);
        if (adminRoles.length > 0) {
          await connection.execute(
            `INSERT IGNORE INTO sys_role_permissions (role_id, permission_code) VALUES (?, ?)`,
            [adminRoles[0].id, perm.code]
          );
        }
      }
      
      // 插入菜单
      for (const menu of module.menus) {
        await connection.execute(
          `INSERT IGNORE INTO sys_module_menus (id, module_name, menu_id, title, path, icon, parent_id, sort_order, permission_code) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), module.name, menu.id, menu.title, menu.path, menu.icon, menu.parentId, menu.sortOrder, menu.permission]
        );
        
        // 同时插入到系统菜单表
        await connection.execute(
          `INSERT IGNORE INTO sys_menus (id, title, path, icon, parent_id, sort_order, permission_code, module_name, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [menu.id, menu.title, menu.path, menu.icon, menu.parentId, menu.sortOrder, menu.permission, module.name]
        );
      }
    }
    
    console.log('所有模块注册完成！');
    
  } catch (error) {
    console.error('注册失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

enableMoreModules();