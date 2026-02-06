/**
 * 模块系统类型定义
 */

/**
 * 模块清单接口
 */
export interface ModuleManifest {
  // 基本信息
  name: string;
  displayName: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;

  // 分类信息
  type?: 'business' | 'system' | 'tool';
  category?: string;
  tags?: string[];

  // 依赖关系
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;

  // 后端配置
  backend?: {
    entry: string;
    routes?: {
      prefix: string;
      file: string;
    };
    migrations?: {
      directory: string;
      tableName?: string;
    };
  };

  // 前端配置
  frontend?: {
    entry: string;
    routes?: string;
    components?: Record<string, string>;
  };

  // 菜单配置
  menus?: MenuConfig[];

  // 权限配置
  permissions?: PermissionConfig[];

  // 配置管理
  config?: {
    schema?: string;
    defaults?: string;
  };

  // 生命周期钩子
  hooks?: {
    beforeInstall?: string;
    afterInstall?: string;
    beforeUninstall?: string;
    afterUninstall?: string;
    beforeEnable?: string;
    afterEnable?: string;
    beforeDisable?: string;
    afterDisable?: string;
  };

  // 数据库信息
  database?: {
    tables?: string[];
    version?: string;
  };

  // API 端点
  api?: {
    endpoints?: ApiEndpoint[];
  };

  // 状态信息（运行时）
  enabled?: boolean;
  installed?: boolean;
  installedAt?: string;
  updatedAt?: string;
}

/**
 * 菜单配置
 */
export interface MenuConfig {
  id: string;
  title: string;
  path: string;
  icon?: string;
  parentId?: string;
  sortOrder: number;
  permission?: string;
}

/**
 * 权限配置
 */
export interface PermissionConfig {
  code: string;
  name: string;
  description: string;
  category?: string;
}

/**
 * API 端点配置
 */
export interface ApiEndpoint {
  method: string;
  path: string;
  description: string;
  permission?: string;
}

/**
 * 模块状态
 */
export type ModuleStatus = 'installed' | 'enabled' | 'disabled' | 'error';

/**
 * 模块信息
 */
export interface ModuleInfo {
  manifest: ModuleManifest;
  status: ModuleStatus;
  error?: string;
  loadedAt?: Date;
}

/**
 * 依赖检查结果
 */
export interface DependencyCheckResult {
  satisfied: boolean;
  missing: string[];
  conflicts: Array<{
    module: string;
    required: string;
    installed: string;
  }>;
}

/**
 * 依赖树节点
 */
export interface DependencyTreeNode {
  name: string;
  version: string;
  dependencies: DependencyTreeNode[];
}

/**
 * 依赖树
 */
export type DependencyTree = DependencyTreeNode;

/**
 * 模块数据库记录
 */
export interface ModuleRecord {
  id: string;
  name: string;
  display_name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  type?: string;
  category?: string;
  manifest: string; // JSON string
  status: ModuleStatus;
  error_message?: string;
  installed_at: Date;
  enabled_at?: Date;
  disabled_at?: Date;
  updated_at: Date;
}

/**
 * 模块钩子函数
 */
export interface ModuleHooks {
  beforeInstall?: () => Promise<void>;
  afterInstall?: () => Promise<void>;
  beforeUninstall?: () => Promise<void>;
  afterUninstall?: () => Promise<void>;
  beforeEnable?: () => Promise<void>;
  afterEnable?: () => Promise<void>;
  beforeDisable?: () => Promise<void>;
  afterDisable?: () => Promise<void>;
}

/**
 * 模块依赖记录
 */
export interface ModuleDependencyRecord {
  id: string;
  module_name: string;
  dependency_name: string;
  version_range?: string;
  created_at: Date;
}
