-- 添加 AI 爬虫助手菜单项
-- 添加到 "AI 创新中心" (ID: 00000000-0000-0000-0000-000000000005) 下

INSERT INTO admin_menus (id, title, path, icon, parent_id, sort_order, is_system) VALUES
('ai-crawler-assistant', 'AI爬虫助手', '/ai/crawler-assistant', 'RobotOutlined', '00000000-0000-0000-0000-000000000005', 5, TRUE)
ON DUPLICATE KEY UPDATE
    title = VALUES(title),
    path = VALUES(path),
    icon = VALUES(icon),
    sort_order = VALUES(sort_order);

-- 分配权限给超级管理员和管理员角色
INSERT INTO admin_role_permissions (role_id, permission_code) VALUES
('00000000-0000-0000-0000-000000000001', 'ai:view'),
('00000000-0000-0000-0000-000000000002', 'ai:view')
ON DUPLICATE KEY UPDATE permission_code = VALUES(permission_code);
