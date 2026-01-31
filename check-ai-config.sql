-- ============================================
-- 检查 AI 配置表
-- ============================================

USE `ai-data-platform`;

-- 1. 查看AI配置表名
SHOW TABLES LIKE '%ai_config%';

-- 2. 查看AI配置数据
SELECT * FROM admin_ai_configs LIMIT 5;

-- 或者
SELECT * FROM sys_ai_configs LIMIT 5;

-- 3. 检查是否有默认配置
SELECT * FROM admin_ai_configs WHERE is_default = TRUE;

-- 或者
SELECT * FROM sys_ai_configs WHERE is_default = TRUE;
