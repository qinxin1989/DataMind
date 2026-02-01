-- 模块化架构系统表创建脚本
-- 创建时间: 2025-01-31
-- 描述: 创建模块注册表、依赖关系、迁移记录和配置管理所需的数据库表

-- 1. 创建模块注册表
CREATE TABLE IF NOT EXISTS sys_modules (
  id VARCHAR(36) PRIMARY KEY COMMENT '模块ID',
  name VARCHAR(100) UNIQUE NOT NULL COMMENT '模块名称（唯一标识）',
  display_name VARCHAR(200) NOT NULL COMMENT '模块显示名称',
  version VARCHAR(20) NOT NULL COMMENT '模块版本',
  description TEXT COMMENT '模块描述',
  author VARCHAR(100) COMMENT '模块作者',
  type VARCHAR(50) COMMENT '模块类型（business/system/tool）',
  category VARCHAR(50) COMMENT '模块分类',
  
  manifest JSON NOT NULL COMMENT '模块清单完整内容',
  
  status ENUM('installed', 'enabled', 'disabled', 'error') DEFAULT 'installed' COMMENT '模块状态',
  error_message TEXT COMMENT '错误信息',
  
  installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '安装时间',
  enabled_at TIMESTAMP NULL COMMENT '启用时间',
  disabled_at TIMESTAMP NULL COMMENT '禁用时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  INDEX idx_name (name),
  INDEX idx_status (status),
  INDEX idx_category (category),
  INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='模块注册表';

-- 2. 创建模块依赖关系表
CREATE TABLE IF NOT EXISTS sys_module_dependencies (
  id VARCHAR(36) PRIMARY KEY COMMENT '依赖关系ID',
  module_name VARCHAR(100) NOT NULL COMMENT '模块名称',
  dependency_name VARCHAR(100) NOT NULL COMMENT '依赖的模块名称',
  version_range VARCHAR(50) COMMENT '版本范围要求',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  
  FOREIGN KEY (module_name) REFERENCES sys_modules(name) ON DELETE CASCADE,
  UNIQUE KEY uk_module_dependency (module_name, dependency_name),
  INDEX idx_module (module_name),
  INDEX idx_dependency (dependency_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='模块依赖关系表';

-- 3. 创建模块迁移记录表
CREATE TABLE IF NOT EXISTS sys_module_migrations (
  id VARCHAR(36) PRIMARY KEY COMMENT '迁移记录ID',
  module_name VARCHAR(100) NOT NULL COMMENT '模块名称',
  version VARCHAR(20) NOT NULL COMMENT '迁移版本号',
  name VARCHAR(200) NOT NULL COMMENT '迁移名称',
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '执行时间',
  execution_time INT COMMENT '执行耗时（毫秒）',
  status ENUM('success', 'failed', 'rolled_back') DEFAULT 'success' COMMENT '执行状态',
  error_message TEXT COMMENT '错误信息',
  
  FOREIGN KEY (module_name) REFERENCES sys_modules(name) ON DELETE CASCADE,
  UNIQUE KEY uk_module_version (module_name, version),
  INDEX idx_module (module_name),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='模块数据库迁移记录表';

-- 4. 创建模块配置表
CREATE TABLE IF NOT EXISTS sys_module_configs (
  id VARCHAR(36) PRIMARY KEY COMMENT '配置ID',
  module_name VARCHAR(100) NOT NULL COMMENT '模块名称',
  config_key VARCHAR(200) NOT NULL COMMENT '配置键',
  config_value TEXT COMMENT '配置值',
  is_encrypted BOOLEAN DEFAULT FALSE COMMENT '是否加密',
  description VARCHAR(500) COMMENT '配置描述',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  FOREIGN KEY (module_name) REFERENCES sys_modules(name) ON DELETE CASCADE,
  UNIQUE KEY uk_module_config (module_name, config_key),
  INDEX idx_module (module_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='模块配置表';

-- 插入初始数据说明
-- 注意：实际的模块数据将在模块安装时动态插入
