-- 菜单管理模块数据库迁移
-- 注意: sys_menus 表已经存在于系统中,此迁移文件仅作为文档记录

-- 如果需要创建表,可以使用以下SQL:
/*
CREATE TABLE IF NOT EXISTS sys_menus (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(100) NOT NULL COMMENT '菜单标题',
  path VARCHAR(200) COMMENT '路由路径',
  icon VARCHAR(50) COMMENT '图标',
  parent_id VARCHAR(36) COMMENT '父菜单ID',
  sort_order INT DEFAULT 0 COMMENT '排序',
  visible BOOLEAN DEFAULT TRUE COMMENT '是否可见',
  permission_code VARCHAR(100) COMMENT '权限代码',
  is_system BOOLEAN DEFAULT FALSE COMMENT '是否系统菜单',
  menu_type VARCHAR(20) DEFAULT 'internal' COMMENT '菜单类型: internal/external/iframe',
  external_url VARCHAR(500) COMMENT '外部链接地址',
  open_mode VARCHAR(20) DEFAULT 'current' COMMENT '打开方式: current/blank/iframe',
  module_code VARCHAR(50) COMMENT '模块代码',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_parent_id (parent_id),
  INDEX idx_sort_order (sort_order),
  INDEX idx_visible (visible)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统菜单表';
*/
