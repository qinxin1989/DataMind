-- 为crawler_templates表添加fields列以支持JSON存储
-- 这样可以更方便地管理字段配置

USE `ai-data-platform`;

-- 检查是否已存在fields列
SET @col_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'ai-data-platform'
    AND TABLE_NAME = 'crawler_templates'
    AND COLUMN_NAME = 'fields'
);

-- 如果不存在则添加
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE crawler_templates ADD COLUMN fields JSON AFTER container_selector',
  'SELECT "fields column already exists" as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 添加其他缺失的列
ALTER TABLE crawler_templates
  ADD COLUMN IF NOT EXISTS department VARCHAR(255) AFTER name,
  ADD COLUMN IF NOT EXISTS data_type VARCHAR(100) AFTER department,
  ADD COLUMN IF NOT EXISTS pagination_enabled BOOLEAN DEFAULT FALSE AFTER fields,
  ADD COLUMN IF NOT EXISTS pagination_next_selector TEXT AFTER pagination_enabled,
  ADD COLUMN IF NOT EXISTS pagination_max_pages INT DEFAULT 50 AFTER pagination_next_selector,
  ADD COLUMN IF NOT EXISTS created_by INT AFTER pagination_max_pages;

-- 修改id列类型为INT AUTO_INCREMENT（如果需要）
-- 注意：这会影响现有数据，请谨慎操作
-- ALTER TABLE crawler_templates MODIFY COLUMN id INT AUTO_INCREMENT;

SELECT '✅ 迁移完成：已添加fields列和其他配置列' as message;
