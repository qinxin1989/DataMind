-- 更新数据采集中心的图标
UPDATE sys_menus 
SET icon = 'FileSearchOutlined' 
WHERE id = 'data-collection';

-- 验证更新
SELECT id, title, icon FROM sys_menus WHERE id = 'data-collection';
