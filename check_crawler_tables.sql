USE `ai-data-platform`;

-- 检查所有 crawler 相关表的字段
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_KEY
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'ai-data-platform'
  AND TABLE_NAME LIKE 'crawler%'
ORDER BY TABLE_NAME, ORDINAL_POSITION;
