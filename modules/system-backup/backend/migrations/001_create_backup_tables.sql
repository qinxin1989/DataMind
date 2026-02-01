-- 系统备份模块数据库迁移脚本
-- 版本: 1.0.0

-- 系统备份表
CREATE TABLE IF NOT EXISTS system_backups (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  backup_size BIGINT NOT NULL,
  file_count INT NOT NULL,
  backup_path VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL COMMENT 'pending, completed, failed',
  created_by VARCHAR(36) NOT NULL,
  created_at BIGINT NOT NULL,
  completed_at BIGINT,
  error_message TEXT,
  INDEX idx_system_backups_created (created_at),
  INDEX idx_system_backups_status (status),
  INDEX idx_system_backups_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统备份表';
