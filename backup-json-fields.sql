-- JSON字段备份脚本
-- 在确认迁移成功后，可以选择性地删除原JSON字段

-- 备份原始数据（可选）
CREATE TABLE IF NOT EXISTS datasource_config_backup AS SELECT * FROM datasource_config;
CREATE TABLE IF NOT EXISTS schema_analysis_backup AS SELECT * FROM schema_analysis;
CREATE TABLE IF NOT EXISTS sys_audit_logs_backup AS SELECT * FROM sys_audit_logs;
CREATE TABLE IF NOT EXISTS chat_history_backup AS SELECT * FROM chat_history;

-- 删除JSON字段（谨慎操作！）
-- ALTER TABLE datasource_config DROP COLUMN config;
-- ALTER TABLE schema_analysis DROP COLUMN tables, DROP COLUMN suggested_questions;
-- ALTER TABLE sys_audit_logs DROP COLUMN details;
-- ALTER TABLE chat_history DROP COLUMN messages;

-- 如果需要恢复，可以使用备份表
-- INSERT INTO datasource_config SELECT * FROM datasource_config_backup;
