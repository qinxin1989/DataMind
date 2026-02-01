-- 角色管理模块数据库迁移
-- 版本: 1.0.0
-- 描述: 创建角色相关表

-- 角色表（如果不存在）
CREATE TABLE IF NOT EXISTS sys_roles (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT '角色名称',
  code VARCHAR(50) NOT NULL UNIQUE COMMENT '角色编码',
  description TEXT COMMENT '角色描述',
  parent_id VARCHAR(36) COMMENT '父角色ID',
  status ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态',
  is_system BOOLEAN DEFAULT FALSE COMMENT '是否系统内置',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_status (status),
  INDEX idx_parent_id (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色表';

-- 角色权限关联表
CREATE TABLE IF NOT EXISTS sys_role_permissions (
  role_id VARCHAR(36) NOT NULL COMMENT '角色ID',
  permission_code VARCHAR(100) NOT NULL COMMENT '权限代码',
  PRIMARY KEY (role_id, permission_code),
  INDEX idx_role_id (role_id),
  INDEX idx_permission_code (permission_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色权限关联表';

-- 角色菜单关联表
CREATE TABLE IF NOT EXISTS sys_role_menus (
  role_id VARCHAR(36) NOT NULL COMMENT '角色ID',
  menu_id VARCHAR(36) NOT NULL COMMENT '菜单ID',
  PRIMARY KEY (role_id, menu_id),
  INDEX idx_role_id (role_id),
  INDEX idx_menu_id (menu_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色菜单关联表';

-- 用户角色关联表（如果不存在）
CREATE TABLE IF NOT EXISTS sys_user_roles (
  user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
  role_id VARCHAR(36) NOT NULL COMMENT '角色ID',
  PRIMARY KEY (user_id, role_id),
  INDEX idx_user_id (user_id),
  INDEX idx_role_id (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户角色关联表';
