-- 公文模板表
CREATE TABLE IF NOT EXISTS official_doc_templates (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  style VARCHAR(20) DEFAULT 'formal',
  is_system TINYINT(1) DEFAULT 0,
  is_public TINYINT(1) DEFAULT 0,
  description TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_type (type),
  INDEX idx_user_id (user_id),
  INDEX idx_is_system (is_system),
  INDEX idx_is_public (is_public)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='公文模板表';

-- 公文生成历史表
CREATE TABLE IF NOT EXISTS official_doc_history (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  template_id VARCHAR(36),
  type VARCHAR(50) NOT NULL,
  style VARCHAR(20) NOT NULL,
  points TEXT NOT NULL,
  result TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,
  error_message TEXT,
  created_at BIGINT NOT NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='公文生成历史表';
