-- 审计日志模块数据库迁移脚本
-- 版本: 1.0.0

-- 审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  username VARCHAR(100),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(36),
  details TEXT,
  ip_address VARCHAR(45),
  user_agent VARCHAR(255),
  status VARCHAR(20) NOT NULL COMMENT 'success, failed',
  error_message TEXT,
  created_at BIGINT NOT NULL,
  INDEX idx_audit_logs_user (user_id),
  INDEX idx_audit_logs_action (action),
  INDEX idx_audit_logs_created (created_at),
  INDEX idx_audit_logs_resource (resource_type, resource_id),
  INDEX idx_audit_logs_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计日志表';
