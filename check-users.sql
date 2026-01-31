-- 检查用户表和admin用户ID
USE `ai-data-platform`;

-- 查看所有用户相关的表
SHOW TABLES LIKE '%user%';

-- 查看 users 表中的 admin 用户
SELECT id, username, email FROM users WHERE username = 'admin';
