-- ============================================
-- AI 爬虫助手完整设置脚本
-- ============================================
-- 使用说明：
-- 1. 在你的数据库管理工具（如 Navicat、DBeaver、phpMyAdmin）中运行此脚本
-- 2. 或者使用命令行：mysql -u root -p ai-data-platform < setup_crawler_assistant.sql
-- ============================================

USE `ai-data-platform`;

-- 1. 添加 description 字段到 crawler_templates 表（如果不存在）
ALTER TABLE crawler_templates
ADD COLUMN IF NOT EXISTS description TEXT AFTER name;

-- 2. 添加 AI 爬虫助手菜单项
INSERT INTO admin_menus (id, title, path, icon, parent_id, sort_order, is_system) VALUES
('ai-crawler-assistant', 'AI爬虫助手', '/ai/crawler-assistant', 'RobotOutlined', '00000000-0000-0000-0000-000000000005', 5, TRUE)
ON DUPLICATE KEY UPDATE
    title = VALUES(title),
    path = VALUES(path),
    icon = VALUES(icon),
    sort_order = VALUES(sort_order);

-- 3. 确保权限已分配（给超级管理员和管理员）
INSERT IGNORE INTO admin_role_permissions (role_id, permission_code) VALUES
('00000000-0000-0000-0000-000000000001', 'ai:view'),
('00000000-0000-0000-0000-000000000002', 'ai:view');

-- 4. 验证菜单是否添加成功
SELECT
    m.id,
    m.title,
    m.path,
    m.icon,
    p.title as parent_title,
    m.sort_order
FROM admin_menus m
LEFT JOIN admin_menus p ON m.parent_id = p.id
WHERE m.id = 'ai-crawler-assistant'
OR m.path = '/ai/crawler-assistant';

-- 完成提示
SELECT 'AI 爬虫助手设置完成！' as message;
SELECT '菜单路径: /ai/crawler-assistant' as info;
SELECT '请刷新页面或重新登录以查看新菜单' as reminder;
