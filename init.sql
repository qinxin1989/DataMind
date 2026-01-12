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

-- 插入默认管理员账号
-- 用户名: admin  密码: admin123
INSERT INTO users (id, username, password, email, full_name, role, status) VALUES
('00000000-0000-0000-0000-000000000001', 'admin', '$2b$10$VOv/v3Xz.6xWLjEP.YNVneQNZqVC5ONlMLahta8yx7dEFlG.rDYiS', 'admin@example.com', '系统管理员', 'admin', 'active')
ON DUPLICATE KEY UPDATE username = username;
