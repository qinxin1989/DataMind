-- 创建数据库
CREATE DATABASE IF NOT EXISTS `ai-data-platform` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `ai-data-platform`;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(100),
  full_name VARCHAR(255),
  role VARCHAR(20) DEFAULT 'user',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 数据源配置表（添加 user_id 用于数据隔离）
CREATE TABLE IF NOT EXISTS datasource_config (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL,
  config JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 数据源权限表
CREATE TABLE IF NOT EXISTS datasource_permissions (
  id VARCHAR(36) PRIMARY KEY,
  datasource_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  permission VARCHAR(20) NOT NULL,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_permission (datasource_id, user_id, permission),
  FOREIGN KEY (datasource_id) REFERENCES datasource_config(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 聊天历史表（添加 user_id）
CREATE TABLE IF NOT EXISTS chat_history (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  datasource_id VARCHAR(36) NOT NULL,
  messages MEDIUMTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_datasource (datasource_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (datasource_id) REFERENCES datasource_config(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Schema 分析结果表（添加 user_id）
CREATE TABLE IF NOT EXISTS schema_analysis (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  datasource_id VARCHAR(36) NOT NULL,
  tables JSON NOT NULL,
  suggested_questions JSON NOT NULL,
  analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_user_edited BOOLEAN DEFAULT FALSE,
  UNIQUE KEY unique_analysis (user_id, datasource_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (datasource_id) REFERENCES datasource_config(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== Admin 框架表结构 ==========

-- 角色表
CREATE TABLE IF NOT EXISTS admin_roles (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 权限表
CREATE TABLE IF NOT EXISTS admin_permissions (
  id VARCHAR(36) PRIMARY KEY,
  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  type VARCHAR(20) DEFAULT 'api',
  module VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_module (module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 角色权限关联表
CREATE TABLE IF NOT EXISTS admin_role_permissions (
  role_id VARCHAR(36) NOT NULL,
  permission_code VARCHAR(100) NOT NULL,
  PRIMARY KEY (role_id, permission_code),
  FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 用户角色关联表
CREATE TABLE IF NOT EXISTS admin_user_roles (
  user_id VARCHAR(36) NOT NULL,
  role_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 菜单表
CREATE TABLE IF NOT EXISTS admin_menus (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  path VARCHAR(255),
  icon VARCHAR(50),
  parent_id VARCHAR(36),
  sort_order INT DEFAULT 0,
  visible BOOLEAN DEFAULT TRUE,
  permission_code VARCHAR(100),
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_parent (parent_id),
  INDEX idx_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- AI配置表
CREATE TABLE IF NOT EXISTS admin_ai_configs (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  api_key VARCHAR(255) NOT NULL,
  base_url VARCHAR(255),
  is_default BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_provider (provider),
  INDEX idx_default (is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 系统配置表
CREATE TABLE IF NOT EXISTS admin_system_configs (
  config_key VARCHAR(100) PRIMARY KEY,
  config_value TEXT,
  config_group VARCHAR(50) DEFAULT 'general',
  description VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_group (config_group)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 审计日志表
CREATE TABLE IF NOT EXISTS admin_audit_logs (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 通知表
CREATE TABLE IF NOT EXISTS admin_notifications (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  type VARCHAR(20) DEFAULT 'info',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_read (is_read),
  INDEX idx_created (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 知识库分类表
CREATE TABLE IF NOT EXISTS knowledge_categories (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_name (name),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 初始化数据 ==========

-- 插入默认管理员账号
-- 用户名: admin  密码: admin123
INSERT INTO users (id, username, password, email, full_name, role, status) VALUES
('00000000-0000-0000-0000-000000000001', 'admin', '$2b$10$VOv/v3Xz.6xWLjEP.YNVneQNZqVC5ONlMLahta8yx7dEFlG.rDYiS', 'admin@example.com', '系统管理员', 'admin', 'active')
ON DUPLICATE KEY UPDATE username = username;

-- 插入默认角色
INSERT INTO admin_roles (id, name, code, description, is_system) VALUES
('00000000-0000-0000-0000-000000000001', '超级管理员', 'super_admin', '拥有系统所有权限', TRUE),
('00000000-0000-0000-0000-000000000002', '管理员', 'admin', '拥有大部分管理权限', TRUE),
('00000000-0000-0000-0000-000000000003', '普通用户', 'user', '普通用户权限', TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 超级管理员拥有所有权限
INSERT INTO admin_role_permissions (role_id, permission_code) VALUES
('00000000-0000-0000-0000-000000000001', '*')
ON DUPLICATE KEY UPDATE permission_code = VALUES(permission_code);

-- 管理员权限
INSERT INTO admin_role_permissions (role_id, permission_code) VALUES
('00000000-0000-0000-0000-000000000002', 'user:view'),
('00000000-0000-0000-0000-000000000002', 'user:create'),
('00000000-0000-0000-0000-000000000002', 'user:update'),
('00000000-0000-0000-0000-000000000002', 'role:view'),
('00000000-0000-0000-0000-000000000002', 'menu:view'),
('00000000-0000-0000-0000-000000000002', 'menu:update'),
('00000000-0000-0000-0000-000000000002', 'datasource:view'),
('00000000-0000-0000-0000-000000000002', 'datasource:create'),
('00000000-0000-0000-0000-000000000002', 'datasource:update'),
('00000000-0000-0000-0000-000000000002', 'ai:view'),
('00000000-0000-0000-0000-000000000002', 'ai:config'),
('00000000-0000-0000-0000-000000000002', 'system:view')
ON DUPLICATE KEY UPDATE permission_code = VALUES(permission_code);

-- 给 admin 用户分配超级管理员角色
INSERT INTO admin_user_roles (user_id, role_id) VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001')
ON DUPLICATE KEY UPDATE role_id = VALUES(role_id);

-- 插入默认菜单
INSERT INTO admin_menus (id, title, path, icon, parent_id, sort_order, is_system) VALUES
('00000000-0000-0000-0000-000000000001', '仪表盘', '/dashboard', 'DashboardOutlined', NULL, 1, TRUE),
('00000000-0000-0000-0000-000000000002', '用户管理', '/users', 'UserOutlined', NULL, 2, TRUE),
('00000000-0000-0000-0000-000000000003', '角色管理', '/roles', 'TeamOutlined', NULL, 3, TRUE),
('00000000-0000-0000-0000-000000000004', '菜单管理', '/menus', 'MenuOutlined', NULL, 4, TRUE),
('00000000-0000-0000-0000-000000000005', 'AI管理', NULL, 'RobotOutlined', NULL, 5, TRUE),
('00000000-0000-0000-0000-000000000006', 'AI配置', '/ai/config', 'SettingOutlined', '00000000-0000-0000-0000-000000000005', 1, TRUE),
('00000000-0000-0000-0000-000000000007', '使用统计', '/ai/stats', 'BarChartOutlined', '00000000-0000-0000-0000-000000000005', 2, TRUE),
('00000000-0000-0000-0000-000000000008', '对话历史', '/ai/history', 'HistoryOutlined', '00000000-0000-0000-0000-000000000005', 3, TRUE),
('00000000-0000-0000-0000-000000000009', '数据源管理', '/datasources', 'DatabaseOutlined', NULL, 6, TRUE),
('00000000-0000-0000-0000-000000000010', '系统管理', '/system', 'SettingOutlined', NULL, 7, TRUE)
ON DUPLICATE KEY UPDATE title = VALUES(title);
