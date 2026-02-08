-- ============================================
-- 爬虫相关表创建脚本
-- ============================================
-- 使用说明：
-- 在你的数据库管理工具中运行此脚本以创建爬虫相关表
-- ============================================

USE `datamind`;

-- 1. 爬虫模板表
CREATE TABLE IF NOT EXISTS crawler_templates (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  url VARCHAR(500) NOT NULL,
  container_selector VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. 爬虫模板字段表
CREATE TABLE IF NOT EXISTS crawler_template_fields (
  id VARCHAR(36) PRIMARY KEY,
  template_id VARCHAR(36) NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  field_selector VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_template (template_id),
  FOREIGN KEY (template_id) REFERENCES crawler_templates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. 爬虫定时任务表
CREATE TABLE IF NOT EXISTS crawler_tasks (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  template_id VARCHAR(36),
  name VARCHAR(100) NOT NULL,
  frequency VARCHAR(50) NOT NULL,
  next_run_at TIMESTAMP NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_template (template_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES crawler_templates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. 爬虫抓取批次表
CREATE TABLE IF NOT EXISTS crawler_results (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  template_id VARCHAR(36),
  status VARCHAR(20) DEFAULT 'completed',
  row_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_template (template_id),
  INDEX idx_created (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES crawler_templates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. 爬虫数据行表
CREATE TABLE IF NOT EXISTS crawler_result_rows (
  id VARCHAR(36) PRIMARY KEY,
  result_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_result (result_id),
  FOREIGN KEY (result_id) REFERENCES crawler_results(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. 爬虫数据项表（EAV 模式）
CREATE TABLE IF NOT EXISTS crawler_result_items (
  id VARCHAR(36) PRIMARY KEY,
  row_id VARCHAR(36) NOT NULL,
  field_name VARCHAR(100) NOT NULL,
  field_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_row (row_id),
  FOREIGN KEY (row_id) REFERENCES crawler_result_rows(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 验证表是否创建成功
SELECT
    TABLE_NAME,
    TABLE_ROWS,
    CREATE_TIME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'datamind'
AND TABLE_NAME LIKE 'crawler%'
ORDER BY TABLE_NAME;

SELECT '✅ 爬虫表创建完成！' as message;
