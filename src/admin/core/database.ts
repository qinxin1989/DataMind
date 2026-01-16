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

    // 添加 priority 字段（如果不存在）
    try {
      await connection.execute(`
        ALTER TABLE sys_ai_configs ADD COLUMN priority INT DEFAULT 0 AFTER status
      `);
    } catch (e: any) {
      // 字段已存在，忽略错误
    }

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

    // 初始化默认数据
    await initDefaultData(connection);

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

  // 插入默认菜单
  await connection.execute(`
    INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, is_system) VALUES
    ('00000000-0000-0000-0000-000000000001', '仪表盘', '/dashboard', 'DashboardOutlined', NULL, 1, TRUE),
    ('00000000-0000-0000-0000-000000000002', '用户管理', '/user', 'UserOutlined', NULL, 2, TRUE),
    ('00000000-0000-0000-0000-000000000003', '角色管理', '/role', 'TeamOutlined', NULL, 3, TRUE),
    ('00000000-0000-0000-0000-000000000004', '菜单管理', '/menu', 'MenuOutlined', NULL, 4, TRUE),
    ('00000000-0000-0000-0000-000000000005', 'AI管理', NULL, 'RobotOutlined', NULL, 5, TRUE),
    ('00000000-0000-0000-0000-000000000011', 'AI问答', '/ai/chat', 'MessageOutlined', '00000000-0000-0000-0000-000000000005', 0, TRUE),
    ('00000000-0000-0000-0000-000000000012', '知识库', '/ai/knowledge', 'BookOutlined', '00000000-0000-0000-0000-000000000005', 1, TRUE),
    ('00000000-0000-0000-0000-000000000006', 'AI配置', '/ai/config', 'SettingOutlined', '00000000-0000-0000-0000-000000000005', 2, TRUE),
    ('00000000-0000-0000-0000-000000000007', '使用统计', '/ai/stats', 'BarChartOutlined', '00000000-0000-0000-0000-000000000005', 3, TRUE),
    ('00000000-0000-0000-0000-000000000008', '对话历史', '/ai/history', 'HistoryOutlined', '00000000-0000-0000-0000-000000000005', 4, TRUE),
    ('00000000-0000-0000-0000-000000000009', '数据源管理', '/datasource', 'DatabaseOutlined', NULL, 6, TRUE),
    ('00000000-0000-0000-0000-000000000010', '系统管理', '/system', 'SettingOutlined', NULL, 7, TRUE),
    ('00000000-0000-0000-0000-000000000013', '通知中心', '/notification', 'BellOutlined', NULL, 8, TRUE)
  `);
}
