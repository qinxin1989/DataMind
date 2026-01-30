/**
 * 统一数据库连接池
 * 整个应用共用一个连接池
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// 创建统一的连接池（整个应用共用）
export const pool = mysql.createPool({
  host: process.env.CONFIG_DB_HOST || 'localhost',
  port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
  user: process.env.CONFIG_DB_USER || 'root',
  password: process.env.CONFIG_DB_PASSWORD || '',
  database: process.env.CONFIG_DB_NAME || 'ai-data-platform',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  charset: 'utf8mb4'
});

// 导出别名，方便其他模块使用
export const db = pool;
export default pool;

/**
 * 初始化数据库表
 */
export async function initAdminTables(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    // 用户表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sys_users (
        id VARCHAR(36) PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(100),
        full_name VARCHAR(100),
        phone VARCHAR(20),
        department VARCHAR(100),
        role VARCHAR(20) DEFAULT 'user',
        status VARCHAR(20) DEFAULT 'active',
        last_login_at TIMESTAMP NULL,
        last_login_ip VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_username (username),
        INDEX idx_status (status),
        INDEX idx_role (role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 角色表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sys_roles (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        code VARCHAR(50) NOT NULL UNIQUE,
        description VARCHAR(255),
        parent_id VARCHAR(36),
        status VARCHAR(20) DEFAULT 'active',
        is_system BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_code (code),
        INDEX idx_parent (parent_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 角色权限关联表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sys_role_permissions (
        role_id VARCHAR(36) NOT NULL,
        permission_code VARCHAR(100) NOT NULL,
        PRIMARY KEY (role_id, permission_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 用户角色关联表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sys_user_roles (
        user_id VARCHAR(36) NOT NULL,
        role_id VARCHAR(36) NOT NULL,
        PRIMARY KEY (user_id, role_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 角色菜单关联表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sys_role_menus (
        role_id VARCHAR(36) NOT NULL,
        menu_id VARCHAR(36) NOT NULL,
        PRIMARY KEY (role_id, menu_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 菜单表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sys_menus (
        id VARCHAR(36) PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        path VARCHAR(255),
        icon VARCHAR(50),
        parent_id VARCHAR(36),
        sort_order INT DEFAULT 0,
        visible BOOLEAN DEFAULT TRUE,
        permission_code VARCHAR(100),
        is_system BOOLEAN DEFAULT FALSE,
        menu_type VARCHAR(20) DEFAULT 'internal',
        external_url VARCHAR(500),
        open_mode VARCHAR(20) DEFAULT 'current',
        module_code VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_parent (parent_id),
        INDEX idx_sort (sort_order),
        INDEX idx_module (module_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // AI配置表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sys_ai_configs (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        model VARCHAR(100) NOT NULL,
        api_key VARCHAR(255) NOT NULL,
        base_url VARCHAR(255),
        embedding_model VARCHAR(100),
        is_default BOOLEAN DEFAULT FALSE,
        status VARCHAR(20) DEFAULT 'active',
        priority INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_provider (provider),
        INDEX idx_default (is_default),
        INDEX idx_priority (priority)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 添加 priority 和 embedding_model 字段（如果不存在）
    try {
      await connection.execute(`
        ALTER TABLE sys_ai_configs ADD COLUMN priority INT DEFAULT 0 AFTER status
      `);
    } catch (e: any) { }

    try {
      await connection.execute(`
        ALTER TABLE sys_ai_configs ADD COLUMN embedding_model VARCHAR(100) AFTER base_url
      `);
    } catch (e: any) { }

    // 系统配置表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sys_system_configs (
        config_key VARCHAR(100) PRIMARY KEY,
        config_value TEXT,
        config_group VARCHAR(50) DEFAULT 'general',
        description VARCHAR(255),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_group (config_group)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 审计日志表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sys_audit_logs (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36),
        username VARCHAR(50),
        action VARCHAR(50) NOT NULL,
        module VARCHAR(50),
        target_type VARCHAR(50),
        target_id VARCHAR(36),
        details JSON,
        ip_address VARCHAR(45),
        user_agent VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_action (action),
        INDEX idx_module (module),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 通知表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sys_notifications (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        type VARCHAR(20) DEFAULT 'info',
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_read (is_read),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 对话历史表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sys_chat_history (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        username VARCHAR(50),
        datasource_id VARCHAR(36) NOT NULL,
        datasource_name VARCHAR(100),
        model_name VARCHAR(50),
        question TEXT NOT NULL,
        answer TEXT,
        sql_query TEXT,
        tokens_used INT DEFAULT 0,
        response_time INT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'success',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_datasource (datasource_id),
        INDEX idx_model (model_name),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 添加 model_name 列（如果不存在）
    try {
      await connection.execute(`ALTER TABLE sys_chat_history ADD COLUMN model_name VARCHAR(50) AFTER datasource_name`);
      await connection.execute(`ALTER TABLE sys_chat_history ADD INDEX idx_model (model_name)`);
    } catch (e) {
      // 列已存在，忽略
    }

    // Schema 分析结果表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sys_schema_analysis (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        datasource_id VARCHAR(36) NOT NULL,
        tables JSON NOT NULL,
        suggested_questions JSON NOT NULL,
        analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        is_user_edited BOOLEAN DEFAULT FALSE,
        UNIQUE KEY unique_user_ds (user_id, datasource_id),
        INDEX idx_datasource (datasource_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 数据源配置表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sys_datasource_config (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(20) NOT NULL,
        config JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ========== 爬虫相关表 ==========

    // 爬虫模板表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS crawler_templates (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        name VARCHAR(100) NOT NULL,
        url VARCHAR(500) NOT NULL,
        department VARCHAR(100),
        data_type VARCHAR(100),
        container_selector VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 为 crawler_templates 添加 department 和 data_type 字段
    try {
      await connection.execute(`ALTER TABLE crawler_templates ADD COLUMN department VARCHAR(100) AFTER url`);
    } catch (e) { }
    try {
      await connection.execute(`ALTER TABLE crawler_templates ADD COLUMN data_type VARCHAR(100) AFTER department`);
    } catch (e) { }

    // 爬虫模板字段表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS crawler_template_fields (
        id VARCHAR(36) PRIMARY KEY,
        template_id VARCHAR(36) NOT NULL,
        field_name VARCHAR(100) NOT NULL,
        field_selector VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_template (template_id),
        FOREIGN KEY (template_id) REFERENCES crawler_templates(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 爬虫定时任务表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS crawler_tasks (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        template_id VARCHAR(36) NOT NULL,
        name VARCHAR(100) NOT NULL,
        frequency VARCHAR(50) NOT NULL,
        next_run_at TIMESTAMP NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_template (template_id),
        FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE,
        FOREIGN KEY (template_id) REFERENCES crawler_templates(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 爬虫抓取批次表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS crawler_results (
        id VARCHAR(36) PRIMARY KEY,
        task_id VARCHAR(36),
        template_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_task (task_id),
        INDEX idx_template (template_id),
        INDEX idx_user (user_id),
        FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 爬虫抓取行表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS crawler_result_rows (
        id VARCHAR(36) PRIMARY KEY,
        result_id VARCHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_result (result_id),
        FOREIGN KEY (result_id) REFERENCES crawler_results(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 爬虫抓取明细条目表 (EAV 模式)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS crawler_result_items (
        id VARCHAR(36) PRIMARY KEY,
        row_id VARCHAR(36) NOT NULL,
        field_name VARCHAR(100) NOT NULL,
        field_value TEXT,
        INDEX idx_row (row_id),
        INDEX idx_field (field_name),
        FOREIGN KEY (row_id) REFERENCES crawler_result_rows(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 初始化默认数据
    await initDefaultData(connection);

    // 始终同步必要的菜单
    await syncSystemMenus(connection);

    // 确保超级管理员拥有所有权限 (*)
    await connection.execute(`
      INSERT IGNORE INTO sys_role_permissions (role_id, permission_code)
      VALUES ('00000000-0000-0000-0000-000000000001', '*')
    `);

    console.log('Admin 数据库表初始化完成');
  } finally {
    connection.release();
  }
}

async function initDefaultData(connection: mysql.PoolConnection): Promise<void> {
  // 检查是否已有角色数据
  const [roles] = await connection.execute('SELECT COUNT(*) as count FROM sys_roles');
  if ((roles as any)[0].count > 0) return;

  // 插入默认角色
  await connection.execute(`
    INSERT INTO sys_roles (id, name, code, description, is_system) VALUES
    ('00000000-0000-0000-0000-000000000001', '超级管理员', 'super_admin', '拥有系统所有权限', TRUE),
    ('00000000-0000-0000-0000-000000000002', '管理员', 'admin', '拥有大部分管理权限', TRUE),
    ('00000000-0000-0000-0000-000000000003', '普通用户', 'user', '普通用户权限', TRUE)
  `);

  // 超级管理员权限
  await connection.execute(`
    INSERT INTO sys_role_permissions (role_id, permission_code) VALUES
    ('00000000-0000-0000-0000-000000000001', '*')
  `);

  // 管理员权限
  const adminPerms = [
    'user:view', 'user:create', 'user:update',
    'role:view', 'menu:view', 'menu:update',
    'datasource:view', 'datasource:create', 'datasource:update',
    'ai:view', 'ai:config', 'system:view'
  ];
  for (const perm of adminPerms) {
    await connection.execute(
      'INSERT INTO sys_role_permissions (role_id, permission_code) VALUES (?, ?)',
      ['00000000-0000-0000-0000-000000000002', perm]
    );
  }

  // 给 admin 用户分配超级管理员角色
  await connection.execute(`
    INSERT IGNORE INTO sys_user_roles (user_id, role_id) VALUES
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001')
  `);
}

/**
 * 同步必要的系统菜单（增量更新 + 权限迁移）
 */
export async function syncSystemMenus(connection: mysql.PoolConnection): Promise<void> {
  const menus = [
    { id: '00000000-0000-0000-0000-000000000001', title: '工作台', path: '/workbench', icon: 'DashboardOutlined', parentId: null, sort: 1 },

    // AI 创新中心
    { id: '00000000-0000-0000-0000-000000000005', title: 'AI 创新中心', path: null, icon: 'RobotOutlined', parentId: null, sort: 2 },
    { id: '00000000-0000-0000-0000-000000000011', title: '智能问答', path: '/ai/chat', icon: 'MessageOutlined', parentId: '00000000-0000-0000-0000-000000000005', sort: 1 },
    { id: '00000000-0000-0000-0000-000000000012', title: '知识中心', path: '/ai/knowledge', icon: 'BookOutlined', parentId: '00000000-0000-0000-0000-000000000005', sort: 2 },
    { id: '00000000-0000-0000-0000-000000000007', title: '使用统计', path: '/ai/stats', icon: 'BarChartOutlined', parentId: '00000000-0000-0000-0000-000000000005', sort: 3 },
    { id: '00000000-0000-0000-0000-000000000008', title: '对话历史', path: '/ai/history', icon: 'HistoryOutlined', parentId: '00000000-0000-0000-0000-000000000005', sort: 4 },

    // 数据资源中心
    { id: '00000000-0000-0000-0000-000000000009', title: '数据资源中心', path: null, icon: 'DatabaseOutlined', parentId: null, sort: 3 },
    { id: '00000000-0000-0000-0000-000000000016', title: '数据源管理', path: '/datasource', icon: 'DatabaseOutlined', parentId: '00000000-0000-0000-0000-000000000009', sort: 1 },
    { id: '00000000-0000-0000-0000-000000000017', title: '数据源审核', path: '/datasource/approval', icon: 'AuditOutlined', parentId: '00000000-0000-0000-0000-000000000009', sort: 2 },

    // 高效办公工具
    { id: '00000000-0000-0000-0000-000000000018', title: '高效办公工具', path: null, icon: 'ToolOutlined', parentId: null, sort: 4 },
    { id: '00000000-0000-0000-0000-000000000014', title: '爬虫管理', path: '/ai/crawler', icon: 'GlobalOutlined', parentId: '00000000-0000-0000-0000-000000000018', sort: 1 },
    { id: '00000000-0000-0000-0000-000000000019', title: '文件工具', path: '/tools/file', icon: 'FileTextOutlined', parentId: '00000000-0000-0000-0000-000000000018', sort: 2 },
    { id: '00000000-0000-0000-0000-000000000020', title: '公文写作', path: '/tools/official-doc', icon: 'EditOutlined', parentId: '00000000-0000-0000-0000-000000000018', sort: 3 },
    { id: '00000000-0000-0000-0000-000000000015', title: 'OCR 识别', path: '/ai/ocr', icon: 'ScanOutlined', parentId: '00000000-0000-0000-0000-000000000018', sort: 4 },

    // 基础系统管理
    { id: '00000000-0000-0000-0000-000000000010', title: '基础系统管理', path: null, icon: 'SettingOutlined', parentId: null, sort: 5 },
    { id: '00000000-0000-0000-0000-000000000002', title: '用户管理', path: '/user', icon: 'UserOutlined', parentId: '00000000-0000-0000-0000-000000000010', sort: 1 },
    { id: '00000000-0000-0000-0000-000000000003', title: '角色管理', path: '/role', icon: 'TeamOutlined', parentId: '00000000-0000-0000-0000-000000000010', sort: 2 },
    { id: '00000000-0000-0000-0000-000000000004', title: '菜单管理', path: '/menu', icon: 'MenuOutlined', parentId: '00000000-0000-0000-0000-000000000010', sort: 3 },
    { id: '00000000-0000-0000-0000-000000000006', title: 'AI 模型配置', path: '/ai/config', icon: 'SettingOutlined', parentId: '00000000-0000-0000-0000-000000000010', sort: 4 },
    { id: '00000000-0000-0000-0000-000000000013', title: '通知中心', path: '/notification', icon: 'BellOutlined', parentId: '00000000-0000-0000-0000-000000000010', sort: 5 }
  ];

  for (const menu of menus) {
    // 1. 查找是否存在具有相同路径或标题的重复菜单（排除自身）
    const [existing] = await connection.execute(
      'SELECT id FROM sys_menus WHERE (path = ? OR title = ?) AND id != ?',
      [menu.path, menu.title, menu.id]
    );

    const duplicates = existing as any[];
    if (duplicates.length > 0) {
      console.log(`[MenuSync] Found ${duplicates.length} duplicates for ${menu.title}, migrating...`);
      for (const dup of duplicates) {
        // 2. 迁移角色权限
        await connection.execute(
          'UPDATE IGNORE sys_role_menus SET menu_id = ? WHERE menu_id = ?',
          [menu.id, dup.id]
        );
        // 3. 迁移子菜单归属
        await connection.execute(
          'UPDATE sys_menus SET parent_id = ? WHERE parent_id = ?',
          [menu.id, dup.id]
        );
        // 4. 删除旧菜单
        await connection.execute('DELETE FROM sys_menus WHERE id = ?', [dup.id]);
        await connection.execute('DELETE FROM sys_role_menus WHERE menu_id = ?', [dup.id]);
      }
    }

    // 5. 插入或更新标准菜单
    await connection.execute(`
      INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, is_system)
      VALUES (?, ?, ?, ?, ?, ?, TRUE)
      ON DUPLICATE KEY UPDATE 
        title = VALUES(title), 
        path = VALUES(path), 
        icon = VALUES(icon), 
        parent_id = VALUES(parent_id), 
        sort_order = VALUES(sort_order)
    `, [menu.id, menu.title, menu.path, menu.icon, menu.parentId, menu.sort]);
  }
}
