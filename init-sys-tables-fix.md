# Init.sql 表名修正指南

## 已修改的表

✅ `users` → `sys_users` (第7行)

## 还需要修改的表

### 1. admin_menus → sys_menus

在第123行附近，找到：
```sql
CREATE TABLE IF NOT EXISTS admin_menus (
```
改为：
```sql
CREATE TABLE IF NOT EXISTS sys_menus (
```

### 2. admin_ai_configs → sys_ai_configs

在第140行附近，找到：
```sql
CREATE TABLE IF NOT EXISTS admin_ai_configs (
```
改为：
```sql
CREATE TABLE IF NOT EXISTS sys_ai_configs (
```

## 所有外键引用

将所有 `REFERENCES users(` 改为 `REFERENCES sys_users(`
将所有 `REFERENCES admin_menus(` 改为 `REFERENCES sys_menus(`
将所有 `REFERENCES admin_ai_configs(` 改为 `REFERENCES sys_ai_configs(`

## 数据插入语句

在第7-14行，找到：
```sql
('00000000-0000-0000-0000-000000000001', 'admin', '$2b$10$VOv/v3Xz.6xWLjEP.YNVneQNZqVC5ONlMLahta8yx7dEFlG.rDYiS', 'admin@example.com', '系统管理员', 'admin', 'active')
```

将 admin 改为对应的 sys_users 表：
```sql
('00000000-0000-0000-0000-000000000001', 'admin', '$2b$10$VOv/v3Xz.6xWLjEP.YNVneQNZqVC5ONlMLahta8yx7dEFlG.rDYiS', 'admin@example.com', '系统管理员', 'admin', 'active')
```

## 验证

修改完成后，运行以下SQL验证：

```sql
USE `ai-data-platform`;

-- 查看所有表
SHOW TABLES;

-- 检查关键表
SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'ai-data-platform'
AND TABLE_NAME IN ('sys_users', 'sys_menus', 'sys_ai_configs');
```
