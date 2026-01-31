-- 同步前端与数据库菜单名称及图标
UPDATE sys_menus SET title = '智能问答', icon = 'MessageOutlined' WHERE id = '00000000-0000-0000-0000-000000000011';
UPDATE sys_menus SET title = '知识中心', icon = 'BookOutlined' WHERE id = '00000000-0000-0000-0000-000000000012';
UPDATE sys_menus SET title = '对话历史', icon = 'HistoryOutlined' WHERE id = '00000000-0000-0000-0000-000000000008';

-- 插入缺失的 AI 相关菜单
INSERT IGNORE INTO sys_menus (id, title, path, icon, parent_id, sort_order, is_system) VALUES
('00000000-0000-0000-0000-000000000015', 'OCR识别', '/ai/ocr', 'ScanOutlined', '00000000-0000-0000-0000-000000000005', 2, TRUE);

-- 重组数据管理菜单
-- 1. 将原有的数据源管理 (009) 改名为父菜单 "数据管理"
UPDATE sys_menus SET title = '数据管理', path = NULL, sort_order = 6 WHERE id = '00000000-0000-0000-0000-000000000009';

-- 2. 插入子菜单
INSERT IGNORE INTO sys_menus (id, title, path, icon, parent_id, sort_order, is_system) VALUES
('00000000-0000-0000-0000-000000000016', '数据源管理', '/datasource', 'DatabaseOutlined', '00000000-0000-0000-0000-000000000009', 0, TRUE),
('00000000-0000-0000-0000-000000000017', '数据源审核', '/datasource/approval', 'AuditOutlined', '00000000-0000-0000-0000-000000000009', 1, TRUE);

-- 数据采集中心菜单结构（使用固定ID）
-- 注意：爬虫管理菜单已移至数据采集中心下，不再属于 AI 服务
INSERT IGNORE INTO sys_menus (id, title, path, icon, parent_id, sort_order, is_system, visible) VALUES
('00000000-0000-0000-0000-000000000021', '数据采集中心', NULL, 'CloudDownloadOutlined', NULL, 4, TRUE, TRUE),
('00000000-0000-0000-0000-000000000022', 'AI爬虫助手', '/ai/crawler-assistant', 'RobotOutlined', '00000000-0000-0000-0000-000000000021', 1, TRUE, TRUE),
('00000000-0000-0000-0000-000000000023', '采集模板配置', '/ai/crawler-template-config', 'SettingOutlined', '00000000-0000-0000-0000-000000000021', 2, TRUE, TRUE),
('00000000-0000-0000-0000-000000000014', '爬虫管理', '/ai/crawler', 'DatabaseOutlined', '00000000-0000-0000-0000-000000000021', 3, TRUE, TRUE);

-- 删除其他位置的重复爬虫菜单
DELETE FROM sys_menus 
WHERE (title IN ('爬虫管理', 'AI爬虫助手', '采集模板配置')
OR path IN ('/ai/crawler', '/ai/crawler-assistant', '/ai/crawler-template-config'))
AND id NOT IN ('00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000023');
