-- 性能优化索引迁移脚本
-- 创建时间: 2026-02-01
-- 目的: 为高频查询添加必要的索引,提升查询性能
-- 基于: Task 24.2 数据库查询优化分析

USE `datamind`;

-- ========================================
-- 1. sys_permissions 表索引优化
-- ========================================

-- 检查是否已存在索引,避免重复创建
-- 已有索引: id (PRIMARY), code (UNIQUE), idx_code, idx_module

-- 添加 parent_id 索引 (用于权限树查询)
CREATE INDEX IF NOT EXISTS idx_permissions_parent_id ON sys_permissions(parent_id);

-- 添加 status 索引 (用于过滤活动权限)
-- 注意: sys_permissions 表当前没有 status 字段,如果需要添加:
-- ALTER TABLE sys_permissions ADD COLUMN status VARCHAR(20) DEFAULT 'active';
-- CREATE INDEX idx_permissions_status ON sys_permissions(status);

-- 添加 type 索引 (用于按类型查询权限)
CREATE INDEX IF NOT EXISTS idx_permissions_type ON sys_permissions(type);

-- ========================================
-- 2. sys_menus 表索引优化
-- ========================================

-- 已有索引: id (PRIMARY), idx_parent (parent_id), idx_sort (sort_order)

-- 添加 path 索引 (用于路由匹配)
CREATE INDEX IF NOT EXISTS idx_menus_path ON sys_menus(path);

-- 添加 visible 索引 (用于过滤可见菜单)
CREATE INDEX IF NOT EXISTS idx_menus_visible ON sys_menus(visible);

-- 添加 permission_code 索引 (用于权限关联查询)
CREATE INDEX IF NOT EXISTS idx_menus_permission ON sys_menus(permission_code);

-- 添加组合索引 (parent_id + sort_order) 用于菜单树排序查询
CREATE INDEX IF NOT EXISTS idx_menus_parent_sort ON sys_menus(parent_id, sort_order);

-- ========================================
-- 3. sys_users 表索引优化
-- ========================================

-- 已有索引: id (PRIMARY), username (UNIQUE), idx_username, idx_role

-- 添加 email 索引 (用于邮箱查询和验证)
CREATE INDEX IF NOT EXISTS idx_users_email ON sys_users(email);

-- 添加 status 索引 (用于过滤活动用户)
CREATE INDEX IF NOT EXISTS idx_users_status ON sys_users(status);

-- 添加 created_at 索引 (用于时间范围查询和排序)
CREATE INDEX IF NOT EXISTS idx_users_created_at ON sys_users(created_at);

-- 添加组合索引 (status + created_at) 用于活动用户列表查询
CREATE INDEX IF NOT EXISTS idx_users_status_created ON sys_users(status, created_at);

-- ========================================
-- 4. sys_roles 表索引优化
-- ========================================

-- 已有索引: id (PRIMARY), code (UNIQUE), idx_code, idx_parent

-- 添加 status 索引 (用于过滤活动角色)
CREATE INDEX IF NOT EXISTS idx_roles_status ON sys_roles(status);

-- 添加 is_system 索引 (用于区分系统角色和自定义角色)
CREATE INDEX IF NOT EXISTS idx_roles_is_system ON sys_roles(is_system);

-- 添加组合索引 (status + is_system) 用于角色列表查询
CREATE INDEX IF NOT EXISTS idx_roles_status_system ON sys_roles(status, is_system);

-- ========================================
-- 5. sys_modules 表索引优化
-- ========================================

-- 已有索引: id (PRIMARY), name (UNIQUE), idx_name, idx_status, idx_category, idx_type

-- 添加 enabled_at 索引 (用于按启用时间排序)
CREATE INDEX IF NOT EXISTS idx_modules_enabled_at ON sys_modules(enabled_at);

-- 添加组合索引 (status + category) 用于分类模块查询
CREATE INDEX IF NOT EXISTS idx_modules_status_category ON sys_modules(status, category);

-- 添加组合索引 (type + status) 用于按类型查询模块
CREATE INDEX IF NOT EXISTS idx_modules_type_status ON sys_modules(type, status);

-- ========================================
-- 6. sys_user_roles 表索引优化
-- ========================================

-- 已有索引: (user_id, role_id) PRIMARY KEY, FOREIGN KEYs

-- 添加 role_id 索引 (用于反向查询:某角色有哪些用户)
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON sys_user_roles(role_id);

-- ========================================
-- 7. sys_role_permissions 表索引优化
-- ========================================

-- 已有索引: (role_id, permission_code) PRIMARY KEY, FOREIGN KEY

-- 添加 permission_code 索引 (用于反向查询:某权限被哪些角色使用)
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON sys_role_permissions(permission_code);

-- ========================================
-- 8. sys_audit_logs 表索引优化
-- ========================================

-- 已有索引: id (PRIMARY), idx_user, idx_action, idx_module, idx_created

-- 添加组合索引 (user_id + created_at) 用于用户操作历史查询
CREATE INDEX IF NOT EXISTS idx_audit_user_created ON sys_audit_logs(user_id, created_at);

-- 添加组合索引 (module + action + created_at) 用于模块操作统计
CREATE INDEX IF NOT EXISTS idx_audit_module_action_created ON sys_audit_logs(module, action, created_at);

-- 添加 target_type 和 target_id 索引 (用于查询特定对象的操作记录)
CREATE INDEX IF NOT EXISTS idx_audit_target_type ON sys_audit_logs(target_type);
CREATE INDEX IF NOT EXISTS idx_audit_target_id ON sys_audit_logs(target_id);

-- ========================================
-- 9. sys_notifications 表索引优化
-- ========================================

-- 已有索引: id (PRIMARY), idx_user, idx_read, idx_created, FOREIGN KEY

-- 添加组合索引 (user_id + is_read + created_at) 用于未读通知查询
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON sys_notifications(user_id, is_read, created_at);

-- 添加 type 索引 (用于按类型查询通知)
CREATE INDEX IF NOT EXISTS idx_notifications_type ON sys_notifications(type);

-- ========================================
-- 10. datasource_config 表索引优化
-- ========================================

-- 已有索引: id (PRIMARY), idx_user, FOREIGN KEY

-- 添加 type 索引 (用于按数据源类型查询)
CREATE INDEX IF NOT EXISTS idx_datasource_type ON datasource_config(type);

-- 添加 name 索引 (用于按名称搜索)
CREATE INDEX IF NOT EXISTS idx_datasource_name ON datasource_config(name);

-- 添加组合索引 (user_id + type) 用于用户数据源列表查询
CREATE INDEX IF NOT EXISTS idx_datasource_user_type ON datasource_config(user_id, type);

-- ========================================
-- 11. chat_history 表索引优化
-- ========================================

-- 已有索引: id (PRIMARY), idx_user, idx_datasource, FOREIGN KEYs

-- 添加组合索引 (user_id + datasource_id + created_at) 用于聊天历史查询
CREATE INDEX IF NOT EXISTS idx_chat_user_ds_created ON chat_history(user_id, datasource_id, created_at);

-- 添加 updated_at 索引 (用于查询最近更新的对话)
CREATE INDEX IF NOT EXISTS idx_chat_updated_at ON chat_history(updated_at);

-- ========================================
-- 12. sys_module_dependencies 表索引优化
-- ========================================

-- 已有索引: id (PRIMARY), uk_module_dependency (UNIQUE), idx_module, idx_dependency, FOREIGN KEY

-- 添加组合索引 (dependency_name + module_name) 用于反向依赖查询
CREATE INDEX IF NOT EXISTS idx_dependencies_dep_module ON sys_module_dependencies(dependency_name, module_name);

-- ========================================
-- 13. sys_module_migrations 表索引优化
-- ========================================

-- 已有索引: id (PRIMARY), uk_module_version (UNIQUE), idx_module, idx_status, FOREIGN KEY

-- 添加组合索引 (module_name + executed_at) 用于迁移历史查询
CREATE INDEX IF NOT EXISTS idx_migrations_module_executed ON sys_module_migrations(module_name, executed_at);

-- 添加组合索引 (status + executed_at) 用于失败迁移查询
CREATE INDEX IF NOT EXISTS idx_migrations_status_executed ON sys_module_migrations(status, executed_at);

-- ========================================
-- 14. sys_module_configs 表索引优化
-- ========================================

-- 已有索引: id (PRIMARY), uk_module_config (UNIQUE), idx_module, FOREIGN KEY

-- 添加 is_encrypted 索引 (用于查询加密配置)
CREATE INDEX IF NOT EXISTS idx_module_configs_encrypted ON sys_module_configs(is_encrypted);

-- 添加组合索引 (module_name + is_encrypted) 用于模块配置查询
CREATE INDEX IF NOT EXISTS idx_module_configs_module_encrypted ON sys_module_configs(module_name, is_encrypted);

-- ========================================
-- 验证索引创建结果
-- ========================================

-- 查看所有新增的索引
SELECT 
  TABLE_NAME as '表名',
  INDEX_NAME as '索引名',
  GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as '索引列',
  INDEX_TYPE as '索引类型'
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND INDEX_NAME LIKE 'idx_%'
GROUP BY TABLE_NAME, INDEX_NAME, INDEX_TYPE
ORDER BY TABLE_NAME, INDEX_NAME;

-- 统计每个表的索引数量
SELECT 
  TABLE_NAME as '表名',
  COUNT(DISTINCT INDEX_NAME) as '索引数量'
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
GROUP BY TABLE_NAME
ORDER BY COUNT(DISTINCT INDEX_NAME) DESC;
