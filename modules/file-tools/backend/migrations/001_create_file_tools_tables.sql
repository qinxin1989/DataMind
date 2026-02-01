-- 文件工具模块数据库迁移脚本
-- 版本: 1.0.0
-- 创建时间: 2026-02-01

-- 文件转换历史表
CREATE TABLE IF NOT EXISTS file_conversion_history (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  source_format VARCHAR(20) NOT NULL,
  target_format VARCHAR(20) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  result_filename VARCHAR(255),
  file_size BIGINT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_file_conversion_user ON file_conversion_history(user_id);
CREATE INDEX IF NOT EXISTS idx_file_conversion_status ON file_conversion_history(status);
CREATE INDEX IF NOT EXISTS idx_file_conversion_created ON file_conversion_history(created_at);

-- 插入初始数据（如果需要）
-- INSERT INTO file_conversion_history ...
