-- ========================================
-- 检查并添加菜单管理
-- ========================================

-- 1. 检查菜单管理是否存在
SELECT '=== 检查菜单管理是否存在 ===' AS step;
SELECT * FROM sys_menus WHERE id = '00000000-0000-0000-0000-000000000004';

-- 2. 检查基础系统管理下的所有子菜单
SELECT '=== 基础系统管理下的所有子菜单 ===' AS step;
SELECT id, title, path, icon, sort_order, visible, is_system 
FROM sys_menus 
WHERE parent_id = '00000000-0000-0000-0000-000000000010' 
ORDER BY sort_order;

-- 3. 插入或更新菜单管理
SELECT '=== 插入或更新菜单管理 ===' AS step;
INSERT INTO sys_menus (
  id, 
  title, 
  path, 
  icon, 
  parent_id, 
  sort_order, 
  visible, 
  permission_code,
  is_system,
  created_at,
  updated_at
) 
VALUES (
  '00000000-0000-0000-0000-000000000004', 
  '菜单管理', 
  '/menus', 
  'MenuOutlined', 
  '00000000-0000-0000-0000-000000000010', 
  3, 
  TRUE,
  'menu:view',
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON DUPLICATE KEY UPDATE 
  title = VALUES(title),
  path = VALUES(path),
  icon = VALUES(icon),
  parent_id = VALUES(parent_id),
  sort_order = VALUES(sort_order),
  visible = VALUES(visible),
  permission_code = VALUES(permission_code),
  updated_at = CURRENT_TIMESTAMP;

-- 4. 验证插入结果
SELECT '=== 验证菜单管理已添加 ===' AS step;
SELECT id, title, path, icon, parent_id, sort_order, visible, permission_code, is_system 
FROM sys_menus 
WHERE id = '00000000-0000-0000-0000-000000000004';

-- 5. 再次查看基础系统管理下的所有子菜单
SELECT '=== 更新后的基础系统管理子菜单 ===' AS step;
SELECT id, title, path, icon, sort_order, visible, is_system 
FROM sys_menus 
WHERE parent_id = '00000000-0000-0000-0000-000000000010' 
ORDER BY sort_order;
