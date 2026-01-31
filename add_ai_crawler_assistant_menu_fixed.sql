-- ============================================
-- 添加 AI 爬虫助手到菜单（修正版）
-- ============================================

USE `ai-data-platform`;

-- 删除可能存在的旧菜单（如果有）
DELETE FROM admin_menus WHERE id = 'ai-crawler-assistant';
DELETE FROM admin_menus WHERE path = '/ai/crawler-assistant';

-- 添加 AI 爬虫助手菜单到"AI 创新中心"下
INSERT INTO admin_menus (id, title, path, icon, parent_id, sort_order, is_system, visible) VALUES
('ai-crawler-assistant', 'AI爬虫助手', '/ai/crawler-assistant', 'RobotOutlined', '00000000-0000-0000-0000-000000000005', 5, TRUE, TRUE);

-- 验证是否添加成功
SELECT
    m.id,
    m.title,
    m.path,
    m.parent_id,
    p.title as parent_title,
    m.sort_order,
    m.visible
FROM admin_menus m
LEFT JOIN admin_menus p ON m.parent_id = p.id
WHERE m.id = 'ai-crawler-assistant'
OR m.path = '/ai/crawler-assistant';

-- 查看所有 AI 创新中心下的菜单
SELECT
    id,
    title,
    path,
    sort_order,
    visible
FROM admin_menus
WHERE parent_id = '00000000-0000-0000-0000-000000000005'
ORDER BY sort_order;

SELECT '✅ 菜单添加完成！请刷新页面或重新登录查看。' as message;
