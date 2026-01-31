-- ============================================
-- 简化修复脚本 - 只处理必要部分
-- ============================================

USE `ai-data-platform`;

-- ========== 第一步：检查现有表 ==========

SELECT '========== 现有菜单表 ==========' as '';
SELECT TABLE_NAME, TABLE_ROWS
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'ai-data-platform'
AND TABLE_NAME LIKE '%menu%';

SELECT '========== 现有用户表 ==========' as '';
SELECT TABLE_NAME, TABLE_ROWS
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'ai-data-platform'
AND TABLE_NAME LIKE '%user%';


-- ========== 第二步：查看 sys_menus 表结构 ==========

SELECT '========== sys_menus 表结构 ==========' as '';
DESCRIBE sys_menus;


-- ========== 第三步：查看现有菜单数据 ==========

SELECT '========== 现有菜单 ==========' as '';
SELECT id, title, path, parent_id, sort_order
FROM sys_menus
ORDER BY parent_id, sort_order
LIMIT 20;


-- ========== 第四步：查找 AI 创新中心菜单 ==========

SELECT '========== AI 创新中心 ==========' as '';
SELECT id, title, path
FROM sys_menus
WHERE title LIKE '%AI%' OR title LIKE '%创新%'
ORDER BY title;


-- ========== 第五步：查找 admin 用户 ==========

SELECT '========== Admin 用户 ==========' as '';
SELECT id, username FROM users WHERE username = 'admin';

-- 如果没有 admin 用户，显示所有用户
SELECT '========== 所有用户 ==========' as '';
SELECT id, username FROM users LIMIT 10;
