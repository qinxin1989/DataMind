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
  database: process.env.CONFIG_DB_NAME || 'datamind',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  charset: 'utf8mb4'
});

// 导出别名，方便其他模块使用
export const db = pool;
export default pool;

/**
 * 通用查询函数
 */
export async function query(sql: string, params?: any[], connection?: mysql.PoolConnection): Promise<any> {
  const conn = connection || await pool.getConnection();
  try {
    const [rows] = await conn.execute(sql, params);
    return rows;
  } finally {
    if (!connection) {
      conn.release();
    }
  }
}

/**
 * 事务执行函数
 */
export async function transaction<T>(callback: (connection: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    // 角色权限关联表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sys_role_permissions (
        role_id VARCHAR(36) NOT NULL,
        permission_code VARCHAR(100) NOT NULL,
        PRIMARY KEY (role_id, permission_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    // 用户角色关联表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sys_user_roles (
        user_id VARCHAR(36) NOT NULL,
        role_id VARCHAR(36) NOT NULL,
        PRIMARY KEY (user_id, role_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    // 角色菜单关联表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sys_role_menus (
        role_id VARCHAR(36) NOT NULL,
        menu_id VARCHAR(36) NOT NULL,
        PRIMARY KEY (role_id, menu_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
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
        module_name VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_parent (parent_id),
        INDEX idx_sort (sort_order),
        INDEX idx_module (module_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    // 添加 model_name 列（如果不存在）
    try {
      await connection.execute(`ALTER TABLE sys_chat_history ADD COLUMN model_name VARCHAR(50) AFTER datasource_name`);
      await connection.execute(`ALTER TABLE sys_chat_history ADD INDEX idx_model (model_name)`);
    } catch (e) {
      // 列已存在，忽略
    }

    // ========== 模块系统表 ==========

    // 模块表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sys_modules (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        display_name VARCHAR(100) NOT NULL,
        version VARCHAR(20) NOT NULL,
        description TEXT,
        author VARCHAR(100),
        type VARCHAR(20),
        category VARCHAR(50),
        manifest JSON NOT NULL,
        status VARCHAR(20) DEFAULT 'installed',
        error_message TEXT,
        installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        enabled_at TIMESTAMP NULL,
        disabled_at TIMESTAMP NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_name (name),
        INDEX idx_status (status),
        INDEX idx_type (type),
        INDEX idx_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    // 模块依赖表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sys_module_dependencies (
        id VARCHAR(36) PRIMARY KEY,
        module_name VARCHAR(100) NOT NULL,
        dependency_name VARCHAR(100) NOT NULL,
        version_range VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_module (module_name),
        INDEX idx_dependency (dependency_name),
        FOREIGN KEY (module_name) REFERENCES sys_modules(name) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    // 模块迁移记录表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sys_module_migrations (
        id VARCHAR(36) PRIMARY KEY,
        module_name VARCHAR(100) NOT NULL,
        migration_name VARCHAR(100) NOT NULL,
        version VARCHAR(20) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_module (module_name),
        INDEX idx_migration (migration_name),
        UNIQUE KEY unique_module_migration (module_name, migration_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    // 模块配置表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sys_module_configs (
        id VARCHAR(36) PRIMARY KEY,
        module_name VARCHAR(100) NOT NULL,
        config_key VARCHAR(100) NOT NULL,
        config_value JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_module (module_name),
        INDEX idx_key (config_key),
        UNIQUE KEY unique_module_config (module_name, config_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    // 权限表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sys_permissions (
        id VARCHAR(36) PRIMARY KEY,
        code VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255),
        category VARCHAR(50),
        module_name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_code (code),
        INDEX idx_module (module_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
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
        pagination_enabled BOOLEAN DEFAULT FALSE,
        pagination_next_selector VARCHAR(255),
        pagination_max_pages INT DEFAULT 1,
        pagination_url_pattern VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    // 为 crawler_templates 添加 department 和 data_type 字段
    try {
      await connection.execute(`ALTER TABLE crawler_templates ADD COLUMN department VARCHAR(100) AFTER url`);
    } catch (e) { }
    try {
      await connection.execute(`ALTER TABLE crawler_templates ADD COLUMN data_type VARCHAR(100) AFTER department`);
    } catch (e) { }
    try {
      await connection.execute(`ALTER TABLE crawler_templates ADD COLUMN pagination_enabled BOOLEAN DEFAULT FALSE`);
      await connection.execute(`ALTER TABLE crawler_templates ADD COLUMN pagination_next_selector VARCHAR(255)`);
      await connection.execute(`ALTER TABLE crawler_templates ADD COLUMN pagination_max_pages INT DEFAULT 1`);
      await connection.execute(`ALTER TABLE crawler_templates ADD COLUMN pagination_url_pattern VARCHAR(500)`);
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    // 爬虫抓取行表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS crawler_result_rows (
        id VARCHAR(36) PRIMARY KEY,
        result_id VARCHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_result (result_id),
        FOREIGN KEY (result_id) REFERENCES crawler_results(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    // 爬虫助手对话历史表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS crawler_assistant_conversations (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        title VARCHAR(255) DEFAULT '新对话',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_updated (updated_at),
        FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    // 爬虫助手消息表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS crawler_assistant_messages (
        id VARCHAR(36) PRIMARY KEY,
        conversation_id VARCHAR(36) NOT NULL,
        role ENUM('user', 'ai') NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'text',
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_conversation_id (conversation_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
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
 * 同步模块化菜单系统
 * 现在菜单由各个模块的 module.json 定义，通过 MenuManager 管理
 */
export async function syncSystemMenus(connection: mysql.PoolConnection): Promise<void> {
  console.log('菜单系统已模块化，由 MenuManager 统一管理');

  // 1. 确保 module_code 存在 (兼容旧表结构)
  try {
    await connection.execute(`
      ALTER TABLE sys_menus 
      ADD COLUMN module_code VARCHAR(50) DEFAULT NULL
    `);
    console.log('已补全 module_code 字段到 sys_menus 表');
  } catch (e: any) {
    // 忽略 Duplicate column 错误
  }

  // 2. 添加 module_name 字段（如果不存在）
  try {
    await connection.execute(`
      ALTER TABLE sys_menus 
      ADD COLUMN module_name VARCHAR(50) DEFAULT NULL AFTER module_code
    `);
    console.log('已添加 module_name 字段到 sys_menus 表');
  } catch (e: any) {
    if (!e.message.includes('Duplicate column')) {
      console.log('尝试带 AFTER 子句添加 module_name 失败，尝试直接添加:', e.message);
      // 如果 AFTER module_code 失败（极少见），尝试直接添加
      try {
        await connection.execute(`
            ALTER TABLE sys_menus 
            ADD COLUMN module_name VARCHAR(50) DEFAULT NULL
          `);
        console.log('已直接添加 module_name 字段到 sys_menus 表');
      } catch (e2: any) {
        if (!e2.message.includes('Duplicate column')) {
          console.log('module_name 字段添加失败:', e2.message);
        }
      }
    }
  }

  // 清理旧的硬编码菜单（保留用户自定义菜单）
  // 注释掉自动删除，避免误删菜单
  try {
    await connection.execute(`
      DELETE FROM sys_menus 
      WHERE is_system = TRUE 
      AND (module_name IS NULL OR module_name = '')
    `);
    console.log('已清理旧的硬编码系统菜单');
  } catch (e: any) {
    if (e.message.includes("is_system")) {
      // if column missing, ignore
      console.log('无法清理旧菜单: is_system 列不存在');
    } else {
      console.log('清理旧菜单时出错:', e.message);
    }
  }

  console.log('现在使用模块化菜单管理');
}
