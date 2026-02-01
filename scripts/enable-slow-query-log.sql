-- 启用 MySQL 慢查询日志
-- 用于识别执行时间超过 50ms 的查询

-- 启用慢查询日志
SET GLOBAL slow_query_log = 'ON';

-- 设置慢查询阈值为 50ms (0.05秒)
SET GLOBAL long_query_time = 0.05;

-- 记录未使用索引的查询
SET GLOBAL log_queries_not_using_indexes = 'ON';

-- 查看慢查询日志配置
SHOW VARIABLES LIKE 'slow_query%';
SHOW VARIABLES LIKE 'long_query_time';
SHOW VARIABLES LIKE 'log_queries_not_using_indexes';

-- 查看慢查询日志文件位置
SELECT @@slow_query_log_file;
