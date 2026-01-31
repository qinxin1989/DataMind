-- 修复爬虫管理菜单位置
-- 创建"数据采集中心"菜单，并将爬虫管理移动到该菜单下

-- 1. 创建数据采集中心菜单（如果不存在）
INSERT IGNORE INTO sys_menus (id, title, path, icon, parent_id, sort_order, is_system) 
VALUES ('00000000-0000-0000-0000-000000000021', '数据采集中心', NULL, 'CloudDownloadOutlined', NULL, 4, TRUE);

-- 2. 更新其他顶级菜单的排序
UPDATE sys_menus SET sort_order = 5 WHERE id = '00000000-0000-0000-0000-000000000018';  -- 高效办公工具
UPDATE sys_menus SET sort_order = 6 WHERE id = '00000000-0000-0000-0000-000000000010';  -- 基础系统管理

-- 3. 将爬虫管理移动到数据采集中心下
UPDATE sys_menus 
SET 
  parent_id = '00000000-0000-0000-0000-000000000021',  -- 数据采集中心
  sort_order = 1
WHERE id = '00000000-0000-0000-0000-000000000014';  -- 爬虫管理

-- 验证更新结果
SELECT 
  m.id,
  m.title,
  m.path,
  COALESCE(p.title, '顶级菜单') as parent_title,
  m.sort_order
FROM sys_menus m
LEFT JOIN sys_menus p ON m.parent_id = p.id
WHERE m.id IN (
  '00000000-0000-0000-0000-000000000021',  -- 数据采集中心
  '00000000-0000-0000-0000-000000000014'   -- 爬虫管理
)
OR m.parent_id = '00000000-0000-0000-0000-000000000021'
ORDER BY m.parent_id, m.sort_order;
