/**
 * 初始化模块系统表并启用 template-optimizer 模块
 */

import { pool } from '../src/admin/core/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_NAME = 'template-optimizer';

async function initModuleSystem() {
  const conn = await pool.getConnection();
  
  try {
    console.log('[Init] 开始初始化模块系统...');
    
    // 1. 创建模块系统表
    console.log('[Init] 创建模块系统表...');
    
    // 1.1 创建模块注册表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS sys_modules (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        display_name VARCHAR(200) NOT NULL,
        version VARCHAR(20) NOT NULL,
        description TEXT,
        author VARCHAR(100),
        type VARCHAR(50),
        category VARCHAR(50),
        manifest JSON,
        status ENUM('installed', 'enabled', 'disabled', 'error') DEFAULT 'installed',
        error_message TEXT,
        installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        enabled_at TIMESTAMP NULL,
        disabled_at TIMESTAMP NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_name (name),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('  ✓ sys_modules 表已创建');
    
    // 1.2 创建模块依赖表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS sys_module_dependencies (
        id VARCHAR(36) PRIMARY KEY,
        module_name VARCHAR(100) NOT NULL,
        dependency_name VARCHAR(100) NOT NULL,
        version_range VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (module_name) REFERENCES sys_modules(name) ON DELETE CASCADE,
        UNIQUE KEY uk_module_dependency (module_name, dependency_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('  ✓ sys_module_dependencies 表已创建');
    
    // 1.3 创建模块迁移记录表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS sys_module_migrations (
        id VARCHAR(36) PRIMARY KEY,
        module_name VARCHAR(100) NOT NULL,
        version VARCHAR(20) NOT NULL,
        name VARCHAR(200) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        execution_time INT,
        status ENUM('success', 'failed', 'rolled_back') DEFAULT 'success',
        error_message TEXT,
        FOREIGN KEY (module_name) REFERENCES sys_modules(name) ON DELETE CASCADE,
        UNIQUE KEY uk_module_version (module_name, version)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('  ✓ sys_module_migrations 表已创建');
    
    // 1.4 创建模块配置表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS sys_module_configs (
        id VARCHAR(36) PRIMARY KEY,
        module_name VARCHAR(100) NOT NULL,
        config_key VARCHAR(200) NOT NULL,
        config_value TEXT,
        is_encrypted BOOLEAN DEFAULT FALSE,
        description VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (module_name) REFERENCES sys_modules(name) ON DELETE CASCADE,
        UNIQUE KEY uk_module_config (module_name, config_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('  ✓ sys_module_configs 表已创建');
    
    // 2. 启用 template-optimizer 模块
    console.log(`[Init] 启用模块: ${MODULE_NAME}`);
    
    // 读取模块配置
    const manifestPath = path.join(process.cwd(), 'modules', MODULE_NAME, 'module.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`模块配置文件不存在: ${manifestPath}`);
    }
    
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    
    // 检查模块是否已存在
    const [existing] = await conn.execute(
      'SELECT * FROM sys_modules WHERE name = ?',
      [MODULE_NAME]
    ) as any[];
    
    if (existing && existing.length > 0) {
      console.log(`  模块已存在，更新为启用状态`);
      await conn.execute(
        'UPDATE sys_modules SET status = ?, enabled_at = NOW(), updated_at = NOW() WHERE name = ?',
        ['enabled', MODULE_NAME]
      );
    } else {
      // 插入新模块
      const { v4: uuidv4 } = await import('uuid');
      await conn.execute(
        `INSERT INTO sys_modules (id, name, display_name, version, description, author, type, category, manifest, status, enabled_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          uuidv4(),
          MODULE_NAME,
          manifest.name || MODULE_NAME,
          manifest.version || '1.0.0',
          manifest.description || '',
          manifest.author || '',
          manifest.type || 'tool',
          'system',
          JSON.stringify(manifest),
          'enabled'
        ]
      );
      console.log(`  ✓ 模块已注册并启用`);
    }
    
    // 3. 创建 sys_menus 表（如果不存在）并添加菜单
    console.log('[Init] 创建菜单表...');

    // 检查 sys_menus 表是否存在
    const [tables] = await conn.execute(
      "SHOW TABLES LIKE 'sys_menus'"
    ) as any[];

    if (tables.length === 0) {
      // 创建菜单表（尽量与现有系统一致：title、visible、module_code）
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS sys_menus (
          id VARCHAR(36) PRIMARY KEY,
          title VARCHAR(100) NOT NULL COMMENT '菜单标题',
          path VARCHAR(200) COMMENT '路由路径',
          icon VARCHAR(50) COMMENT '图标',
          parent_id VARCHAR(36) COMMENT '父菜单ID',
          sort_order INT DEFAULT 0 COMMENT '排序',
          visible BOOLEAN DEFAULT TRUE COMMENT '是否可见',
          permission_code VARCHAR(100) COMMENT '权限代码',
          is_system BOOLEAN DEFAULT FALSE COMMENT '是否系统菜单',
          menu_type VARCHAR(20) DEFAULT 'internal' COMMENT '菜单类型: internal/external/iframe',
          external_url VARCHAR(500) COMMENT '外部链接地址',
          open_mode VARCHAR(20) DEFAULT 'current' COMMENT '打开方式: current/blank/iframe',
          module_code VARCHAR(50) COMMENT '模块代码',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_parent_id (parent_id),
          INDEX idx_sort_order (sort_order),
          INDEX idx_visible (visible)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统菜单表'
      `);
      console.log('  ✓ sys_menus 表已创建');
    }

    // 添加模板优化菜单到系统管理下
    const { v4: uuidv4 } = await import('uuid');
    const menuId = 'template-optimizer'; // 使用固定ID避免重复

    // 检查菜单是否已存在（按ID检查）
    const [existingMenu] = await conn.execute(
      'SELECT * FROM sys_menus WHERE id = ?',
      [menuId]
    ) as any[];

    if (existingMenu && existingMenu.length > 0) {
      console.log('  菜单已存在，更新路径和父菜单');
      await conn.execute(
        `UPDATE sys_menus 
         SET path = ?, parent_id = 'system-management', module_code = ?, title = '模板优化'
         WHERE id = ?`,
        ['/system/template-optimizer', MODULE_NAME, menuId]
      );
    } else {
      await conn.execute(
        `INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, visible, permission_code, is_system, menu_type, open_mode, module_code)
         VALUES (?, ?, ?, ?, 'system-management', ?, TRUE, ?, FALSE, 'internal', 'current', ?)`,
        [menuId, '模板优化', '/system/template-optimizer', 'ThunderboltOutlined', 200, 'template:optimize', MODULE_NAME]
      );
      console.log('  ✓ 菜单已添加到系统管理');
    }
    
    // 4. 创建 sys_permissions 表（如果不存在）并添加权限
    console.log('[Init] 添加权限...');
    
    const permissions = [
      { code: 'template:optimize', name: '模板优化', description: '运行SQL模板测试和优化任务' },
      { code: 'template:test', name: '模板测试', description: '运行SQL模板匹配测试' },
      { code: 'template:view', name: '查看报告', description: '查看模板验证报告' }
    ];

    // sys_permissions 实际结构（用户提供）：无 status 字段，有 category/module_name
    // 这里用 INSERT IGNORE，避免重复执行报错
    for (const perm of permissions) {
      const permId = uuidv4();
      await conn.execute(
        `INSERT IGNORE INTO sys_permissions (id, code, name, description, category, module_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [permId, perm.code, perm.name, perm.description, 'template', MODULE_NAME]
      );
    }
    console.log(`  ✓ 权限已写入 (${permissions.length}个)`);
    
    console.log('\n✅ 模块系统初始化完成！');
    console.log('请刷新页面查看新菜单');
    
  } catch (error) {
    console.error('\n❌ 初始化失败:', error);
    throw error;
  } finally {
    conn.release();
    await pool.end();
  }
}

// 运行
initModuleSystem().catch(() => process.exit(1));
