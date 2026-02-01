-- 模块化架构系统表回滚脚本
-- 创建时间: 2025-01-31
-- 描述: 删除模块系统相关的所有数据库表
-- 警告: 此操作将删除所有模块数据，请谨慎执行！

-- 按照依赖关系的逆序删除表

-- 1. 删除模块配置表
DROP TABLE IF EXISTS sys_module_configs;

-- 2. 删除模块迁移记录表
DROP TABLE IF EXISTS sys_module_migrations;

-- 3. 删除模块依赖关系表
DROP TABLE IF EXISTS sys_module_dependencies;

-- 4. 删除模块注册表
DROP TABLE IF EXISTS sys_modules;
