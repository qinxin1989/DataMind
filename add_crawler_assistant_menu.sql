-- 添加 AI 爬虫助手菜单项
-- 父菜单：AI 管理 (ID 需要根据实际情况调整)

-- 首先查找 AI 管理菜单的 ID
-- SELECT id FROM sys_menus WHERE path = '/ai' OR name = 'AI管理';

-- 插入 AI 爬虫助手菜单（假设 AI 管理的 ID 是 'ai-menu-id'，请根据实际情况替换）
INSERT INTO sys_menus (
    id,
    parent_id,
    name,
    path,
    component,
    icon,
    type,
    permission,
    sort_order,
    visible,
    status,
    created_at,
    updated_at
) VALUES (
    'ai-crawler-assistant',
    'ai-management',  -- 请替换为实际的 AI 管理菜单 ID
    'AI爬虫助手',
    '/ai/crawler-assistant',
    'ai/crawler-assistant',
    'RobotOutlined',
    'menu',
    'ai:view',
    60,
    true,
    'active',
    NOW(),
    NOW()
) ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    path = VALUES(path),
    component = VALUES(component),
    icon = VALUES(icon),
    sort_order = VALUES(sort_order),
    updated_at = NOW();
