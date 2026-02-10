/**
 * 根据设计文档完善模块化管理框架
 */

const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function completeModularSystem() {
  let connection;
  
  try {
    console.log('🚀 开始完善模块化管理框架...');
    
    connection = await mysql.createConnection({
      host: process.env.CONFIG_DB_HOST || 'localhost',
      port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
      user: process.env.CONFIG_DB_USER || 'root',
      password: process.env.CONFIG_DB_PASSWORD || '',
      database: process.env.CONFIG_DB_NAME || 'DataMind',
      charset: 'utf8mb4'
    });
    
    console.log('✅ 数据库连接成功');
    
    // 1. 创建模块生命周期管理表
    console.log('📋 创建模块生命周期管理表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sys_module_lifecycle (
        id VARCHAR(36) PRIMARY KEY,
        module_name VARCHAR(100) NOT NULL,
        event_type ENUM('install', 'uninstall', 'enable', 'disable', 'update') NOT NULL,
        status ENUM('pending', 'running', 'success', 'failed') DEFAULT 'pending',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL,
        FOREIGN KEY (module_name) REFERENCES sys_modules(name) ON DELETE CASCADE,
        INDEX idx_module_event (module_name, event_type),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 2. 创建模块配置表
    console.log('⚙️ 创建模块配置表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sys_module_configs (
        id VARCHAR(36) PRIMARY KEY,
        module_name VARCHAR(100) NOT NULL,
        config_key VARCHAR(200) NOT NULL,
        config_value TEXT,
        config_type ENUM('string', 'number', 'boolean', 'json', 'array') DEFAULT 'string',
        is_encrypted BOOLEAN DEFAULT FALSE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (module_name) REFERENCES sys_modules(name) ON DELETE CASCADE,
        UNIQUE KEY unique_module_config (module_name, config_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 3. 创建模块资源表
    console.log('📁 创建模块资源表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sys_module_resources (
        id VARCHAR(36) PRIMARY KEY,
        module_name VARCHAR(100) NOT NULL,
        resource_type ENUM('css', 'js', 'image', 'font', 'template', 'other') NOT NULL,
        resource_path VARCHAR(500) NOT NULL,
        resource_url VARCHAR(500),
        load_order INT DEFAULT 0,
        is_critical BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (module_name) REFERENCES sys_modules(name) ON DELETE CASCADE,
        INDEX idx_module_type (module_name, resource_type),
        INDEX idx_load_order (load_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 4. 完善权限系统 - 创建权限组
    console.log('🔐 完善权限系统...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sys_permission_groups (
        id VARCHAR(36) PRIMARY KEY,
        code VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        module_name VARCHAR(100),
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (module_name) REFERENCES sys_modules(name) ON DELETE SET NULL,
        INDEX idx_module (module_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    // 5. 为权限表添加权限组关联
    await connection.execute(`
      ALTER TABLE sys_permissions 
      ADD COLUMN IF NOT EXISTS permission_group_id VARCHAR(36),
      ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0,
      ADD FOREIGN KEY IF NOT EXISTS (permission_group_id) REFERENCES sys_permission_groups(id) ON DELETE SET NULL
    `);
    
    // 6. 创建系统核心权限组和权限
    console.log('🏗️ 创建系统核心权限...');
    const corePermissionGroups = [
      {
        code: 'system-management',
        name: '系统管理',
        description: '系统核心管理功能权限组',
        permissions: [
          { code: 'system:view', name: '查看系统信息', description: '查看系统基本信息和状态' },
          { code: 'system:config', name: '系统配置', description: '修改系统配置参数' },
          { code: 'system:maintenance', name: '系统维护', description: '执行系统维护操作' }
        ]
      },
      {
        code: 'user-management',
        name: '用户管理',
        description: '用户账户管理权限组',
        permissions: [
          { code: 'user:view', name: '查看用户', description: '查看用户列表和详情' },
          { code: 'user:create', name: '创建用户', description: '创建新用户账户' },
          { code: 'user:update', name: '更新用户', description: '修改用户信息' },
          { code: 'user:delete', name: '删除用户', description: '删除用户账户' },
          { code: 'user:reset-password', name: '重置密码', description: '重置用户密码' }
        ]
      },
      {
        code: 'role-management',
        name: '角色管理',
        description: '角色权限管理权限组',
        permissions: [
          { code: 'role:view', name: '查看角色', description: '查看角色列表和详情' },
          { code: 'role:create', name: '创建角色', description: '创建新角色' },
          { code: 'role:update', name: '更新角色', description: '修改角色信息' },
          { code: 'role:delete', name: '删除角色', description: '删除角色' },
          { code: 'role:assign-permissions', name: '分配权限', description: '为角色分配权限' }
        ]
      },
      {
        code: 'module-management',
        name: '模块管理',
        description: '模块系统管理权限组',
        permissions: [
          { code: 'module:view', name: '查看模块', description: '查看模块列表和详情' },
          { code: 'module:install', name: '安装模块', description: '安装新模块' },
          { code: 'module:uninstall', name: '卸载模块', description: '卸载模块' },
          { code: 'module:enable', name: '启用模块', description: '启用模块' },
          { code: 'module:disable', name: '禁用模块', description: '禁用模块' },
          { code: 'module:config', name: '配置模块', description: '修改模块配置' }
        ]
      },
      {
        code: 'menu-management',
        name: '菜单管理',
        description: '系统菜单管理权限组',
        permissions: [
          { code: 'menu:view', name: '查看菜单', description: '查看菜单列表和结构' },
          { code: 'menu:create', name: '创建菜单', description: '创建新菜单项' },
          { code: 'menu:update', name: '更新菜单', description: '修改菜单信息' },
          { code: 'menu:delete', name: '删除菜单', description: '删除菜单项' },
          { code: 'menu:sort', name: '排序菜单', description: '调整菜单顺序' }
        ]
      }
    ];
    
    for (const group of corePermissionGroups) {
      // 创建权限组
      const groupId = uuidv4();
      await connection.execute(
        `INSERT IGNORE INTO sys_permission_groups (id, code, name, description, sort_order) VALUES (?, ?, ?, ?, ?)`,
        [groupId, group.code, group.name, group.description, 0]
      );
      
      // 创建权限
      for (const [index, perm] of group.permissions.entries()) {
        await connection.execute(
          `INSERT IGNORE INTO sys_permissions (id, code, name, description, permission_group_id, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [uuidv4(), perm.code, perm.name, perm.description, groupId, index * 10]
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
    }
    
    // 7. 创建标准菜单结构
    console.log('🗂️ 创建标准菜单结构...');
    const standardMenus = [
      // 主菜单
      { id: 'dashboard', title: '工作台', path: '/dashboard', icon: 'DashboardOutlined', parentId: null, sortOrder: 10, permission: 'system:view' },
      
      // 系统管理
      { id: 'system-management', title: '系统管理', path: '/system', icon: 'SettingOutlined', parentId: null, sortOrder: 900, permission: 'system:view' },
      { id: 'user-management', title: '用户管理', path: '/system/users', icon: 'UserOutlined', parentId: 'system-management', sortOrder: 10, permission: 'user:view' },
      { id: 'role-management', title: '角色管理', path: '/system/roles', icon: 'TeamOutlined', parentId: 'system-management', sortOrder: 20, permission: 'role:view' },
      { id: 'menu-management', title: '菜单管理', path: '/system/menus', icon: 'MenuOutlined', parentId: 'system-management', sortOrder: 30, permission: 'menu:view' },
      { id: 'module-management', title: '模块管理', path: '/system/modules', icon: 'AppstoreOutlined', parentId: 'system-management', sortOrder: 40, permission: 'module:view' },
      { id: 'system-config', title: '系统配置', path: '/system/config', icon: 'SettingOutlined', parentId: 'system-management', sortOrder: 50, permission: 'system:config' },
      
      // AI中心
      { id: 'ai-center', title: 'AI中心', path: '/ai', icon: 'RobotOutlined', parentId: null, sortOrder: 100, permission: 'ai:view' },
      
      // 数据中心
      { id: 'data-center', title: '数据中心', path: '/data', icon: 'DatabaseOutlined', parentId: null, sortOrder: 200, permission: 'datasource:view' },
      
      // 数据采集
      { id: 'data-collection', title: '数据采集', path: '/collection', icon: 'CloudDownloadOutlined', parentId: null, sortOrder: 300, permission: 'crawler:view' },
      
      // 工具箱
      { id: 'tools-center', title: '工具箱', path: '/tools', icon: 'ToolOutlined', parentId: null, sortOrder: 500, permission: 'file:tools' }
    ];
    
    for (const menu of standardMenus) {
      await connection.execute(
        `INSERT IGNORE INTO sys_menus (id, title, path, icon, parent_id, sort_order, permission_code, visible, is_system, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, NOW(), NOW())`,
        [menu.id, menu.title, menu.path, menu.icon, menu.parentId, menu.sortOrder, menu.permission]
      );
    }
    
    // 8. 更新现有模块菜单的父级关系
    console.log('🔗 更新模块菜单父级关系...');
    const menuUpdates = [
      // AI中心下的菜单
      { moduleMenu: 'ai-stats-menu', newParentId: 'ai-center' },
      { moduleMenu: 'ai-qa-main', newParentId: 'ai-center' },
      { moduleMenu: 'knowledge-base', newParentId: 'ai-center' },
      
      // 数据中心下的菜单
      { moduleMenu: 'datasource-management-menu', newParentId: 'data-center' },
      { moduleMenu: 'datasource-approval-menu', newParentId: 'data-center' },
      
      // 数据采集下的菜单
      { moduleMenu: 'crawler-management-main', newParentId: 'data-collection' },
      { moduleMenu: 'crawler-template-config', newParentId: 'data-collection' },
      
      // 系统管理下的菜单 - 更新为新的父级ID
      { moduleMenu: 'user-management-main', newParentId: 'system-management', newMenuId: 'user-management' },
      { moduleMenu: 'role-management-main', newParentId: 'system-management', newMenuId: 'role-management' },
      { moduleMenu: 'menu-management-main', newParentId: 'system-management', newMenuId: 'menu-management' },
      
      // 工具箱下的菜单
      { moduleMenu: 'file-tools-main', newParentId: 'tools-center' },
      { moduleMenu: 'efficiency-tools-main', newParentId: 'tools-center' },
      { moduleMenu: 'official-doc-main', newParentId: 'tools-center' }
    ];
    
    for (const update of menuUpdates) {
      // 更新模块菜单表
      await connection.execute(
        `UPDATE sys_module_menus SET parent_id = ? WHERE menu_id = ?`,
        [update.newParentId, update.moduleMenu]
      );
      
      // 更新系统菜单表
      const updateId = update.newMenuId || update.moduleMenu;
      await connection.execute(
        `UPDATE sys_menus SET parent_id = ? WHERE id = ?`,
        [update.newParentId, updateId]
      );
    }
    
    // 9. 创建默认模块配置
    console.log('⚙️ 创建默认模块配置...');
    const defaultConfigs = [
      { module: 'system', key: 'site_name', value: 'DataMind管理平台', type: 'string', description: '网站名称' },
      { module: 'system', key: 'site_description', value: 'AI数据平台管理系统', type: 'string', description: '网站描述' },
      { module: 'system', key: 'enable_registration', value: 'false', type: 'boolean', description: '是否允许用户注册' },
      { module: 'system', key: 'default_role', value: 'user', type: 'string', description: '新用户默认角色' },
      { module: 'system', key: 'session_timeout', value: '3600', type: 'number', description: '会话超时时间(秒)' }
    ];
    
    for (const config of defaultConfigs) {
      await connection.execute(
        `INSERT IGNORE INTO sys_module_configs (id, module_name, config_key, config_value, config_type, description, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [uuidv4(), config.module, config.key, config.value, config.type, config.description]
      );
    }
    
    console.log('✅ 模块化管理框架完善完成！');
    
    // 显示最终统计
    const [moduleCount] = await connection.execute('SELECT COUNT(*) as count FROM sys_modules');
    const [menuCount] = await connection.execute('SELECT COUNT(*) as count FROM sys_menus');
    const [permCount] = await connection.execute('SELECT COUNT(*) as count FROM sys_permissions');
    const [permGroupCount] = await connection.execute('SELECT COUNT(*) as count FROM sys_permission_groups');
    
    console.log('\n📊 系统统计:');
    console.log(`   - 模块数量: ${moduleCount[0].count}`);
    console.log(`   - 菜单数量: ${menuCount[0].count}`);
    console.log(`   - 权限数量: ${permCount[0].count}`);
    console.log(`   - 权限组数量: ${permGroupCount[0].count}`);
    
  } catch (error) {
    console.error('❌ 系统完善失败:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

completeModularSystem();