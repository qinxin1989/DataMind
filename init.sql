-- 设置环境
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 创建数据库
CREATE DATABASE IF NOT EXISTS `datamind` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE `datamind`;

-- ========================================
-- 核心表结构
-- ========================================

-- 用户表
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
  INDEX idx_role (role),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 角色权限关联表
CREATE TABLE IF NOT EXISTS sys_role_permissions (
  role_id VARCHAR(36) NOT NULL,
  permission_code VARCHAR(100) NOT NULL,
  PRIMARY KEY (role_id, permission_code),
  FOREIGN KEY (role_id) REFERENCES sys_roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 用户角色关联表
CREATE TABLE IF NOT EXISTS sys_user_roles (
  user_id VARCHAR(36) NOT NULL,
  role_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES sys_roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- AI配置表
CREATE TABLE IF NOT EXISTS sys_ai_configs (
  id VARCHAR(36) PRIMARY KEY COMMENT '配置ID (UUID)',
  name VARCHAR(255) NOT NULL COMMENT '配置名称',
  provider VARCHAR(100) NOT NULL COMMENT '提供商',
  model VARCHAR(255) NOT NULL COMMENT '模型名称',
  embedding_model VARCHAR(255) COMMENT '嵌入模型',
  api_key TEXT COMMENT 'API密钥（加密存储）',
  base_url VARCHAR(500) COMMENT 'API基础URL',
  is_default BOOLEAN DEFAULT FALSE COMMENT '是否为默认配置',
  status ENUM('active', 'inactive') DEFAULT 'inactive' COMMENT '状态',
  priority INT DEFAULT 0 COMMENT '优先级（数字越小优先级越高）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_provider (provider),
  INDEX idx_status (status),
  INDEX idx_priority (priority),
  INDEX idx_is_default (is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI配置表';

-- 系统配置表
CREATE TABLE IF NOT EXISTS sys_system_configs (
  config_key VARCHAR(100) PRIMARY KEY,
  config_value TEXT,
  config_group VARCHAR(50) DEFAULT 'general',
  description VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_group (config_group)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 数据源配置表
CREATE TABLE IF NOT EXISTS datasource_configs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL,
  config JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 数据源权限表
CREATE TABLE IF NOT EXISTS datasource_permissions (
  id VARCHAR(36) PRIMARY KEY,
  datasource_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  permission VARCHAR(20) NOT NULL,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_permission (datasource_id, user_id, permission),
  FOREIGN KEY (datasource_id) REFERENCES datasource_configs(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 审批记录表
CREATE TABLE IF NOT EXISTS approval_records (
  id VARCHAR(36) PRIMARY KEY,
  datasource_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  approver_id VARCHAR(36),
  approved_at TIMESTAMP NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_datasource (datasource_id),
  INDEX idx_user (user_id),
  INDEX idx_status (status),
  FOREIGN KEY (datasource_id) REFERENCES datasource_configs(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 聊天历史表
CREATE TABLE IF NOT EXISTS chat_history (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  datasource_id VARCHAR(36),
  title VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_datasource (datasource_id),
  FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 聊天消息表
CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR(36) PRIMARY KEY,
  chat_id VARCHAR(36) NOT NULL,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_chat (chat_id),
  FOREIGN KEY (chat_id) REFERENCES chat_history(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 知识库文档表
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id VARCHAR(36) PRIMARY KEY,
  category_id VARCHAR(36),
  user_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  file_path VARCHAR(500),
  file_type VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category_id),
  INDEX idx_user (user_id),
  FOREIGN KEY (category_id) REFERENCES knowledge_categories(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 知识库文档块表
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id VARCHAR(36) PRIMARY KEY,
  document_id VARCHAR(36) NOT NULL,
  content TEXT NOT NULL,
  embedding JSON,
  chunk_index INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_document (document_id),
  FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 爬虫模板字段表
CREATE TABLE IF NOT EXISTS crawler_template_fields (
  id VARCHAR(36) PRIMARY KEY,
  template_id VARCHAR(36) NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  field_selector VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_template (template_id),
  FOREIGN KEY (template_id) REFERENCES crawler_templates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 爬虫定时任务表
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 爬虫抓取行表
CREATE TABLE IF NOT EXISTS crawler_result_rows (
  id VARCHAR(36) PRIMARY KEY,
  result_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_result (result_id),
  FOREIGN KEY (result_id) REFERENCES crawler_results(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 爬虫抓取明细条目表
CREATE TABLE IF NOT EXISTS crawler_result_items (
  id VARCHAR(36) PRIMARY KEY,
  row_id VARCHAR(36) NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  field_value TEXT,
  INDEX idx_row (row_id),
  INDEX idx_field (field_name),
  FOREIGN KEY (row_id) REFERENCES crawler_result_rows(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- AI爬虫助手对话表
CREATE TABLE IF NOT EXISTS crawler_assistant_conversations (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  title VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- AI爬虫助手消息表
CREATE TABLE IF NOT EXISTS crawler_assistant_messages (
  id VARCHAR(36) PRIMARY KEY,
  conversation_id VARCHAR(36) NOT NULL,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_conversation (conversation_id),
  FOREIGN KEY (conversation_id) REFERENCES crawler_assistant_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Schema分析表
CREATE TABLE IF NOT EXISTS schema_analysis (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  datasource_id VARCHAR(36) NOT NULL,
  analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_user_edited BOOLEAN DEFAULT FALSE,
  UNIQUE KEY unique_analysis (user_id, datasource_id),
  FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE,
  INDEX idx_datasource (datasource_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Schema表信息
CREATE TABLE IF NOT EXISTS schema_tables (
  id VARCHAR(36) PRIMARY KEY,
  analysis_id VARCHAR(36) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_analysis (analysis_id),
  FOREIGN KEY (analysis_id) REFERENCES schema_analysis(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Schema列信息
CREATE TABLE IF NOT EXISTS schema_columns (
  id VARCHAR(36) PRIMARY KEY,
  table_id VARCHAR(36) NOT NULL,
  column_name VARCHAR(100) NOT NULL,
  data_type VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_table (table_id),
  FOREIGN KEY (table_id) REFERENCES schema_tables(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Schema推荐问题
CREATE TABLE IF NOT EXISTS schema_questions (
  id VARCHAR(36) PRIMARY KEY,
  analysis_id VARCHAR(36) NOT NULL,
  question TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_analysis (analysis_id),
  FOREIGN KEY (analysis_id) REFERENCES schema_analysis(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ========================================
-- 模块化系统表
-- ========================================

-- 模块主表
CREATE TABLE IF NOT EXISTS sys_modules (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  version VARCHAR(20) NOT NULL,
  description TEXT,
  author VARCHAR(100),
  license VARCHAR(50),
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
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 模块依赖关系表
CREATE TABLE IF NOT EXISTS sys_module_dependencies (
  id VARCHAR(36) PRIMARY KEY,
  module_name VARCHAR(100) NOT NULL,
  dependency_name VARCHAR(100) NOT NULL,
  version_range VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_module (module_name),
  FOREIGN KEY (module_name) REFERENCES sys_modules(name) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 模块迁移记录表
CREATE TABLE IF NOT EXISTS sys_module_migrations (
  id VARCHAR(36) PRIMARY KEY,
  module_name VARCHAR(100) NOT NULL,
  migration_name VARCHAR(100) NOT NULL,
  version VARCHAR(20) NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  execution_time INT DEFAULT 0,
  INDEX idx_module (module_name),
  UNIQUE KEY unique_module_migration (module_name, migration_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 模块配置表
CREATE TABLE IF NOT EXISTS sys_module_configs (
  id VARCHAR(36) PRIMARY KEY,
  module_name VARCHAR(100) NOT NULL,
  config_key VARCHAR(100) NOT NULL,
  config_value JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_module (module_name),
  UNIQUE KEY unique_module_config (module_name, config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 角色与菜单关联表 (动态菜单支持)
CREATE TABLE IF NOT EXISTS sys_role_menus (
  role_id VARCHAR(36) NOT NULL,
  menu_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (role_id, menu_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 模块标签表
CREATE TABLE IF NOT EXISTS sys_module_tags (
  id VARCHAR(36) PRIMARY KEY,
  module_name VARCHAR(100) NOT NULL,
  tag VARCHAR(50) NOT NULL,
  INDEX idx_module (module_name),
  FOREIGN KEY (module_name) REFERENCES sys_modules(name) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 模块权限表
CREATE TABLE IF NOT EXISTS sys_module_permissions (
  id VARCHAR(36) PRIMARY KEY,
  module_name VARCHAR(100) NOT NULL,
  code VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  INDEX idx_module (module_name),
  UNIQUE KEY unique_module_permission (module_name, code),
  FOREIGN KEY (module_name) REFERENCES sys_modules(name) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 模块菜单表
CREATE TABLE IF NOT EXISTS sys_module_menus (
  id VARCHAR(36) PRIMARY KEY,
  module_name VARCHAR(100) NOT NULL,
  menu_id VARCHAR(100) NOT NULL,
  title VARCHAR(100) NOT NULL,
  path VARCHAR(255) NOT NULL,
  icon VARCHAR(100),
  parent_id VARCHAR(100),
  sort_order INT DEFAULT 0,
  permission_code VARCHAR(100),
  INDEX idx_module (module_name),
  FOREIGN KEY (module_name) REFERENCES sys_modules(name) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 模块后端配置表
CREATE TABLE IF NOT EXISTS sys_module_backend (
  module_name VARCHAR(100) PRIMARY KEY,
  entry_file VARCHAR(255) NOT NULL,
  routes_prefix VARCHAR(100),
  routes_file VARCHAR(255),
  FOREIGN KEY (module_name) REFERENCES sys_modules(name) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 模块前端配置表
CREATE TABLE IF NOT EXISTS sys_module_frontend (
  module_name VARCHAR(100) PRIMARY KEY,
  entry_file VARCHAR(255) NOT NULL,
  routes_file VARCHAR(255),
  FOREIGN KEY (module_name) REFERENCES sys_modules(name) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 模块API端点表
CREATE TABLE IF NOT EXISTS sys_module_api_endpoints (
  id VARCHAR(36) PRIMARY KEY,
  module_name VARCHAR(100) NOT NULL,
  method VARCHAR(10) NOT NULL,
  path VARCHAR(255) NOT NULL,
  description TEXT,
  permission_code VARCHAR(100),
  INDEX idx_module (module_name),
  FOREIGN KEY (module_name) REFERENCES sys_modules(name) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ========================================
-- 知识图谱增强表
-- ========================================

-- 知识实体表
CREATE TABLE IF NOT EXISTS knowledge_entities (
  id VARCHAR(36) PRIMARY KEY,
  knowledge_base_id VARCHAR(36),
  type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  name_cn VARCHAR(255),
  description TEXT,
  properties JSON,
  source_document_id VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_type (type),
  INDEX idx_name (name),
  INDEX idx_source_document (source_document_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 知识关系表
CREATE TABLE IF NOT EXISTS knowledge_relations (
  id VARCHAR(36) PRIMARY KEY,
  knowledge_base_id VARCHAR(36),
  type VARCHAR(50) NOT NULL,
  source_id VARCHAR(36) NOT NULL,
  target_id VARCHAR(36) NOT NULL,
  properties JSON,
  weight DECIMAL(5,4) DEFAULT 1.0,
  source_document_id VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_source_id (source_id),
  INDEX idx_target_id (target_id),
  INDEX idx_type (type),
  FOREIGN KEY (source_id) REFERENCES knowledge_entities(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES knowledge_entities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ========================================
-- 优化与归一化分表 (JSON 转表结构)
-- ========================================

-- 审计日志详情分表
CREATE TABLE IF NOT EXISTS audit_log_details (
  id VARCHAR(36) PRIMARY KEY,
  audit_log_id VARCHAR(36) NOT NULL,
  detail_key VARCHAR(100) NOT NULL,
  detail_value TEXT,
  detail_type VARCHAR(20) DEFAULT 'string',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_log (audit_log_id),
  INDEX idx_key (detail_key),
  FOREIGN KEY (audit_log_id) REFERENCES sys_audit_logs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 数据源配置详情
CREATE TABLE IF NOT EXISTS datasource_configs_details (
  id VARCHAR(36) PRIMARY KEY,
  datasource_id VARCHAR(36) NOT NULL,
  config_key VARCHAR(100) NOT NULL,
  config_value TEXT,
  config_type VARCHAR(20) DEFAULT 'string',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_datasource (datasource_id),
  FOREIGN KEY (datasource_id) REFERENCES datasource_configs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Schema 表结构详情表
CREATE TABLE IF NOT EXISTS schema_tables_ext (
  id VARCHAR(36) PRIMARY KEY,
  analysis_id VARCHAR(36) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  table_name_cn VARCHAR(100),
  table_comment VARCHAR(500),
  row_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_analysis (analysis_id),
  FOREIGN KEY (analysis_id) REFERENCES schema_analysis(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 系统级对话统计历史表
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
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ========================================
-- 初始化默认数据
-- ========================================

-- 插入默认管理员账号 (用户名: admin, 密码: admin123)
INSERT INTO sys_users (id, username, password_hash, email, full_name, role, status) VALUES
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

-- 给 admin 用户分配超级管理员角色
INSERT INTO sys_user_roles (user_id, role_id) VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001')
ON DUPLICATE KEY UPDATE role_id = VALUES(role_id);

-- ========================================
-- 初始化菜单
-- ========================================

-- 一级菜单
INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, visible, permission_code, is_system) VALUES
('ai-center', 'AI创新中心', '/ai', 'RobotOutlined', NULL, 100, 1, '*', 0),
('data-center', '数据资源中心', '/data', 'DatabaseOutlined', NULL, 200, 1, '*', 0),
('data-collection', '数据采集中心', '/collection', 'FileSearchOutlined', NULL, 300, 1, '*', 0),
('tools-center', '工具箱', '/tools', 'ToolOutlined', NULL, 500, 1, '*', 0),
('system-management', '系统基础管理', '/system', 'SettingOutlined', NULL, 700, 1, '*', 0)
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- 二级菜单 - AI创新中心
INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, visible, permission_code, is_system) VALUES
('ai-stats-menu', 'AI统计', '/ai/stats', 'BarChartOutlined', 'ai-center', 1, 1, 'ai:view', 0),
('ai-qa-main', 'AI智能问答', '/ai/chat', 'QuestionCircleOutlined', 'ai-center', 30, 1, 'ai-qa:view', 0),
('knowledge-base', '知识库管理', '/ai/knowledge', 'BookOutlined', 'ai-center', 31, 1, 'ai-qa:knowledge:view', 0),
('ai-history', '对话历史记录', '/ai/history', 'HistoryOutlined', 'ai-center', 32, 1, 'ai:view', 0)
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- 二级菜单 - 数据资源中心
INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, visible, permission_code, is_system) VALUES
('datasource-management-menu', '数据源管理', '/datasource', 'DatabaseOutlined', 'data-center', 1, 1, 'datasource:view', 0),
('datasource-approval-menu', '数据源审核', '/datasource/approval', 'AuditOutlined', 'data-center', 2, 1, 'datasource:approve', 0)
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- 二级菜单 - 数据采集中心
INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, visible, permission_code, is_system) VALUES
('ai-crawler-assistant', 'AI 爬虫助手', '/ai/crawler-assistant', 'RobotOutlined', 'data-collection', 1, 1, 'ai:view', 0),
('crawler-template-config', '采集模板配置', '/ai/crawler-template-config', 'SettingOutlined', 'data-collection', 2, 1, 'crawler_template_view', 0),
('crawler-management-main', '爬虫管理', '/ai/crawler', 'DatabaseOutlined', 'data-collection', 3, 1, 'crawler:view', 0)
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- 二级菜单 - 工具箱
INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, visible, permission_code, is_system) VALUES
('file-tools-main', '文件工具', '/tools/file', 'FileTextOutlined', 'tools-center', 100, 1, 'file-tools:view', 0),
('efficiency-tools-main', '效率工具', '/tools/efficiency', 'ThunderboltOutlined', 'tools-center', 110, 1, 'efficiency-tools:view', 0),
('official-doc-main', '公文写作', '/tools/official-doc', 'FileTextOutlined', 'tools-center', 120, 1, 'official-doc:view', 0),
('ocr-service-main', 'OCR 识别', '/ai/ocr', 'ScanOutlined', 'tools-center', 130, 1, 'ocr:view', 0)
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- 二级菜单 - 系统基础管理
INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, visible, permission_code, is_system) VALUES
('user-management-menu', '用户管理', '/system/users', 'UserOutlined', 'system-management', 1, 1, 'user:view', 0),
('role-management-menu', '角色管理', '/system/roles', 'TeamOutlined', 'system-management', 2, 1, 'role:view', 0),
('menu-management-menu', '菜单管理', '/system/menus', 'MenuOutlined', 'system-management', 3, 1, 'menu:view', 0),
('ai-config-main', 'AI 模型配置', '/ai/config', 'SettingOutlined', 'system-management', 4, 1, 'ai:view', 0),
('system-config-main', '系统配置', '/system/config', 'SettingOutlined', 'system-management', 900, 1, 'system-config:view', 0),
('system-status', '系统状态', '/system/status', 'DashboardOutlined', 'system-management', 901, 1, 'system-config:view', 0),
('audit-log-main', '审计日志', '/system/audit', 'FileSearchOutlined', 'system-management', 902, 1, 'audit:view', 0),
('system-backup-main', '备份恢复', '/system/backup', 'CloudServerOutlined', 'system-management', 903, 1, 'system-backup:view', 0),
('notification-main', '通知中心', '/notification', 'BellOutlined', 'system-management', 904, 1, 'notification:view', 0),
('dashboard-main', '大屏管理', '/dashboard/list', 'FundOutlined', 'system-management', 905, 1, 'dashboard:view', 0)
ON DUPLICATE KEY UPDATE title = VALUES(title);

SET FOREIGN_KEY_CHECKS = 1;


