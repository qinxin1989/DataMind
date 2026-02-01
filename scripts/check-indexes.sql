-- 检查数据库中所有表的索引情况

-- 1. 查看所有表的索引
SELECT 
  TABLE_NAME as '表名',
  INDEX_NAME as '索引名',
  COLUMN_NAME as '列名',
  SEQ_IN_INDEX as '列序号',
  INDEX_TYPE as '索引类型',
  NON_UNIQUE as '是否唯一'
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- 2. 查看没有索引的表
SELECT 
  TABLE_NAME as '表名',
  TABLE_ROWS as '行数'
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME NOT IN (
    SELECT DISTINCT TABLE_NAME 
    FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE()
  )
ORDER BY TABLE_ROWS DESC;

-- 3. 查看索引使用情况 (需要先运行一些查询)
SELECT 
  OBJECT_SCHEMA as '数据库',
  OBJECT_NAME as '表名',
  INDEX_NAME as '索引名',
  COUNT_STAR as '使用次数',
  COUNT_READ as '读取次数',
  COUNT_WRITE as '写入次数'
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE OBJECT_SCHEMA = DATABASE()
ORDER BY COUNT_STAR DESC;

-- 4. 查看未使用的索引
SELECT 
  OBJECT_SCHEMA as '数据库',
  OBJECT_NAME as '表名',
  INDEX_NAME as '索引名'
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE OBJECT_SCHEMA = DATABASE()
  AND INDEX_NAME IS NOT NULL
  AND INDEX_NAME != 'PRIMARY'
  AND COUNT_STAR = 0
ORDER BY OBJECT_NAME, INDEX_NAME;

-- 5. 查看核心表的索引详情
SELECT 
  TABLE_NAME as '表名',
  INDEX_NAME as '索引名',
  GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as '索引列',
  INDEX_TYPE as '索引类型',
  CASE NON_UNIQUE 
    WHEN 0 THEN '唯一索引'
    ELSE '普通索引'
  END as '索引类型'
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'sys_permissions',
    'sys_menus',
    'sys_users',
    'sys_roles',
    'sys_modules',
    'sys_user_roles',
    'sys_role_permissions'
  )
GROUP BY TABLE_NAME, INDEX_NAME, INDEX_TYPE, NON_UNIQUE
ORDER BY TABLE_NAME, INDEX_NAME;
