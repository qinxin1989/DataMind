-- 创建数据库
CREATE DATABASE IF NOT EXISTS `ai-data-platform` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `ai-data-platform`;

-- 用户表
CREATE TABLE IF NOT EXISTS sys_users (
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
  FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
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
  FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
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
  FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE,
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
  FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE,
  FOREIGN KEY (datasource_id) REFERENCES datasource_config(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== Admin 框架表结构 ==========

-- 角色表
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 权限表
CREATE TABLE IF NOT EXISTS sys_permissions (
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
CREATE TABLE IF NOT EXISTS sys_role_permissions (
  role_id VARCHAR(36) NOT NULL,
  permission_code VARCHAR(100) NOT NULL,
  PRIMARY KEY (role_id, permission_code),
  FOREIGN KEY (role_id) REFERENCES sys_roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 用户角色关联表
CREATE TABLE IF NOT EXISTS sys_user_roles (
  user_id VARCHAR(36) NOT NULL,
  role_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES sys_roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 菜单表
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_parent (parent_id),
  INDEX idx_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- AI配置表
CREATE TABLE IF NOT EXISTS sys_ai_configs (
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
CREATE TABLE IF NOT EXISTS sys_system_configs (
  config_key VARCHAR(100) PRIMARY KEY,
  config_value TEXT,
  config_group VARCHAR(50) DEFAULT 'general',
  description VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_group (config_group)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 审计日志表
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 通知表
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
  INDEX idx_created (created_at),
  FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
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
  FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 爬虫相关表 ==========

-- 爬虫模板表
CREATE TABLE IF NOT EXISTS crawler_templates (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  url VARCHAR(500) NOT NULL,
  container_selector VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 爬虫模板字段表
CREATE TABLE IF NOT EXISTS crawler_template_fields (
  id VARCHAR(36) PRIMARY KEY,
  template_id VARCHAR(36) NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  field_selector VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_template (template_id),
  FOREIGN KEY (template_id) REFERENCES crawler_templates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 爬虫定时任务表
CREATE TABLE IF NOT EXISTS crawler_tasks (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  template_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  frequency VARCHAR(50) NOT NULL, -- 'daily', 'hourly', 'minutely', or cron
  next_run_at TIMESTAMP NULL,
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'paused'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_template (template_id),
  FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES crawler_templates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 爬虫抓取批次表
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 爬虫抓取行表
CREATE TABLE IF NOT EXISTS crawler_result_rows (
  id VARCHAR(36) PRIMARY KEY,
  result_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_result (result_id),
  FOREIGN KEY (result_id) REFERENCES crawler_results(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 爬虫抓取明细条目表 (EAV 模式)
CREATE TABLE IF NOT EXISTS crawler_result_items (
  id VARCHAR(36) PRIMARY KEY,
  row_id VARCHAR(36) NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  field_value TEXT,
  INDEX idx_row (row_id),
  INDEX idx_field (field_name),
  FOREIGN KEY (row_id) REFERENCES crawler_result_rows(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ========== 初始化数据 ==========

-- 插入默认管理员账号
-- 用户名: admin  密码: admin123
INSERT INTO sys_users (id, username, password, email, full_name, role, status) VALUES
('00000000-0000-0000-0000-000000000001', 'admin', '$2b$10$VOv/v3Xz.6xWLjEP.YNVneQNZqVC5ONlMLahta8yx7dEFlG.rDYiS', 'admin@example.com', '系统管理员', 'admin', 'active')
ON DUPLICATE KEY UPDATE username = username;

-- 插入默认角色
INSERT INTO sys_roles (id, name, code, description, is_system) VALUES
('00000000-0000-0000-0000-000000000001', '超级管理员', 'super_admin', '拥有系统所有权限', TRUE),
('00000000-0000-0000-0000-000000000002', '管理员', 'admin', '拥有大部分管理权限', TRUE),
('00000000-0000-0000-0000-000000000003', '普通用户', 'user', '普通用户权限', TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 超级管理员拥有所有权限
INSERT INTO sys_role_permissions (role_id, permission_code) VALUES
('00000000-0000-0000-0000-000000000001', '*')
ON DUPLICATE KEY UPDATE permission_code = VALUES(permission_code);

-- 管理员权限
INSERT INTO sys_role_permissions (role_id, permission_code) VALUES
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
INSERT INTO sys_user_roles (user_id, role_id) VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001')
ON DUPLICATE KEY UPDATE role_id = VALUES(role_id);

-- 插入默认菜单
INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, is_system) VALUES
('00000000-0000-0000-0000-000000000001', '工作台', '/workbench', 'DashboardOutlined', NULL, 1, TRUE),
-- AI 创新中心
('00000000-0000-0000-0000-000000000005', 'AI 创新中心', NULL, 'RobotOutlined', NULL, 2, TRUE),
('00000000-0000-0000-0000-000000000011', '智能问答', '/ai/chat', 'MessageOutlined', '00000000-0000-0000-0000-000000000005', 1, TRUE),
('00000000-0000-0000-0000-000000000012', '知识中心', '/ai/knowledge', 'BookOutlined', '00000000-0000-0000-0000-000000000005', 2, TRUE),
('00000000-0000-0000-0000-000000000007', '使用统计', '/ai/stats', 'BarChartOutlined', '00000000-0000-0000-0000-000000000005', 3, TRUE),
('00000000-0000-0000-0000-000000000008', '对话历史', '/ai/history', 'HistoryOutlined', '00000000-0000-0000-0000-000000000005', 4, TRUE),
-- 数据资源中心
('00000000-0000-0000-0000-000000000009', '数据资源中心', NULL, 'DatabaseOutlined', NULL, 3, TRUE),
('00000000-0000-0000-0000-000000000016', '数据源管理', '/datasource', 'DatabaseOutlined', '00000000-0000-0000-0000-000000000009', 1, TRUE),
('00000000-0000-0000-0000-000000000017', '数据源审核', '/datasource/approval', 'AuditOutlined', '00000000-0000-0000-0000-000000000009', 2, TRUE),
-- 高效办公工具
('00000000-0000-0000-0000-000000000018', '高效办公工具', NULL, 'ToolOutlined', NULL, 4, TRUE),
('00000000-0000-0000-0000-000000000014', '爬虫管理', '/ai/crawler', 'GlobalOutlined', '00000000-0000-0000-0000-000000000018', 1, TRUE),
('00000000-0000-0000-0000-000000000019', '文件工具', '/tools/file', 'FileTextOutlined', '00000000-0000-0000-0000-000000000018', 2, TRUE),
('00000000-0000-0000-0000-000000000020', '公文写作', '/tools/official-doc', 'EditOutlined', '00000000-0000-0000-0000-000000000018', 3, TRUE),
('00000000-0000-0000-0000-000000000015', 'OCR 识别', '/ai/ocr', 'ScanOutlined', '00000000-0000-0000-0000-000000000018', 4, TRUE),
-- 基础系统管理
('00000000-0000-0000-0000-000000000010', '基础系统管理', NULL, 'SettingOutlined', NULL, 5, TRUE),
('00000000-0000-0000-0000-000000000002', '用户管理', '/users', 'UserOutlined', '00000000-0000-0000-0000-000000000010', 1, TRUE),
('00000000-0000-0000-0000-000000000003', '角色管理', '/roles', 'TeamOutlined', '00000000-0000-0000-0000-000000000010', 2, TRUE),
('00000000-0000-0000-0000-000000000004', '菜单管理', '/menus', 'MenuOutlined', '00000000-0000-0000-0000-000000000010', 3, TRUE),
('00000000-0000-0000-0000-000000000006', 'AI 模型配置', '/ai/config', 'SettingOutlined', '00000000-0000-0000-0000-000000000010', 4, TRUE),
('00000000-0000-0000-0000-000000000013', '通知中心', '/notification', 'BellOutlined', '00000000-0000-0000-0000-000000000010', 5, TRUE)
ON DUPLICATE KEY UPDATE title = VALUES(title);
