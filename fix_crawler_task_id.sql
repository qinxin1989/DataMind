-- 修复爬虫采集记录表 - 添加 task_id 字段
USE `ai-data-platform`;

-- 添加 task_id 字段
ALTER TABLE crawler_results
ADD COLUMN task_id VARCHAR(36) NULL AFTER template_id;

-- 添加索引
ALTER TABLE crawler_results
ADD INDEX idx_task (task_id);

-- 验证
SELECT '✅ task_id 字段已添加' as message;
