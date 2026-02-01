-- 系统配置模块数据库迁移脚本
-- 版本: 1.0.0

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_configs (
  id VARCHAR(36) PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  value_type VARCHAR(20) NOT NULL COMMENT 'string, number, boolean, json',
  description VARCHAR(255),
  config_group VARCHAR(50) NOT NULL,
  is_editable BOOLEAN DEFAULT TRUE,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_system_configs_group (config_group),
  INDEX idx_system_configs_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统配置表';

-- 插入默认配置
INSERT INTO system_configs (id, config_key, config_value, value_type, description, config_group, is_editable, created_at, updated_at) VALUES
(UUID(), 'site.name', 'AI 数据平台', 'string', '站点名称', 'site', TRUE, UNIX_TIMESTAMP() * 1000, UNIX_TIMESTAMP() * 1000),
(UUID(), 'site.logo', '/logo.png', 'string', '站点 Logo', 'site', TRUE, UNIX_TIMESTAMP() * 1000, UNIX_TIMESTAMP() * 1000),
(UUID(), 'site.description', '智能数据分析平台', 'string', '站点描述', 'site', TRUE, UNIX_TIMESTAMP() * 1000, UNIX_TIMESTAMP() * 1000),
(UUID(), 'security.sessionTimeout', '3600', 'number', '会话超时时间(秒)', 'security', TRUE, UNIX_TIMESTAMP() * 1000, UNIX_TIMESTAMP() * 1000),
(UUID(), 'security.maxLoginAttempts', '5', 'number', '最大登录尝试次数', 'security', TRUE, UNIX_TIMESTAMP() * 1000, UNIX_TIMESTAMP() * 1000),
(UUID(), 'security.passwordMinLength', '8', 'number', '密码最小长度', 'security', TRUE, UNIX_TIMESTAMP() * 1000, UNIX_TIMESTAMP() * 1000),
(UUID(), 'upload.maxFileSize', '10485760', 'number', '最大上传文件大小(字节)', 'upload', TRUE, UNIX_TIMESTAMP() * 1000, UNIX_TIMESTAMP() * 1000),
(UUID(), 'upload.allowedTypes', '["csv","xlsx","json"]', 'json', '允许的文件类型', 'upload', TRUE, UNIX_TIMESTAMP() * 1000, UNIX_TIMESTAMP() * 1000),
(UUID(), 'ai.defaultProvider', 'qwen', 'string', '默认 AI 提供商', 'ai', TRUE, UNIX_TIMESTAMP() * 1000, UNIX_TIMESTAMP() * 1000),
(UUID(), 'ai.maxTokensPerRequest', '4096', 'number', '每次请求最大 Token 数', 'ai', TRUE, UNIX_TIMESTAMP() * 1000, UNIX_TIMESTAMP() * 1000)
ON DUPLICATE KEY UPDATE config_value=VALUES(config_value);
