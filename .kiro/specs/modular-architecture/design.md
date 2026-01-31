# 设计文档：模块化架构重构

## 概述

本文档描述模块化架构的详细设计，包括模块结构、注册机制、生命周期管理、路由系统等核心组件的实现方案。

## 架构设计

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      应用层 (Application)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  前端应用     │  │  后端应用     │  │  CLI 工具     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   模块管理层 (Module Layer)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 模块注册表    │  │ 模块加载器    │  │ 生命周期管理  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 路由管理器    │  │ 菜单管理器    │  │ 权限管理器    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    模块层 (Modules)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 用户管理模块  │  │ AI 服务模块   │  │ 数据源模块    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 角色管理模块  │  │ 工具模块      │  │ ...更多模块   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   基础设施层 (Infrastructure)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 数据库连接池  │  │ 缓存服务      │  │ 日志服务      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## 模块结构设计

### 标准模块目录结构

```
modules/
└── {module-name}/                    # 模块根目录（kebab-case）
    ├── module.json                   # 模块清单文件（必需）
    ├── README.md                     # 模块文档
    ├── CHANGELOG.md                  # 版本变更日志
    │
    ├── backend/                      # 后端代码
    │   ├── index.ts                  # 后端入口
    │   ├── routes.ts                 # 路由定义
    │   ├── service.ts                # 业务逻辑
    │   ├── types.ts                  # 类型定义
    │   ├── middleware/               # 中间件
    │   └── migrations/               # 数据库迁移
    │       ├── 001_initial.sql
    │       ├── 002_add_field.sql
    │       └── rollback/
    │           ├── 001_initial.sql
    │           └── 002_add_field.sql
    │
    ├── frontend/                     # 前端代码
    │   ├── index.ts                  # 前端入口
    │   ├── routes.ts                 # 路由配置
    │   ├── views/                    # 页面组件
    │   ├── components/               # 可复用组件
    │   ├── stores/                   # 状态管理
    │   ├── api/                      # API 调用
    │   └── assets/                   # 静态资源
    │
    ├── config/                       # 配置文件
    │   ├── default.json              # 默认配置
    │   ├── development.json          # 开发环境配置
    │   └── production.json           # 生产环境配置
    │
    ├── permissions/                  # 权限定义
    │   └── permissions.json
    │
    ├── tests/                        # 测试文件
    │   ├── backend/
    │   └── frontend/
    │
    └── docs/                         # 文档
        ├── api.md                    # API 文档
        └── user-guide.md             # 用户指南
```

### 模块清单文件 (module.json)

```json
{
  "name": "user-management",
  "displayName": "用户管理",
  "version": "1.0.0",
  "description": "用户账户管理模块，包含用户CRUD、审核、权限分配等功能",
  "author": "Your Team",
  "license": "MIT",
  
  "type": "business",
  "category": "system",
  "tags": ["user", "auth", "management"],
  
  "dependencies": {
    "role-management": "^1.0.0",
    "audit-log": "^1.0.0"
  },
  
  "peerDependencies": {
    "node": ">=18.0.0",
    "vue": "^3.0.0"
  },
  
  "backend": {
    "entry": "./backend/index.ts",
    "routes": {
      "prefix": "/users",
      "file": "./backend/routes.ts"
    },
    "migrations": {
      "directory": "./backend/migrations",
      "tableName": "module_migrations"
    }
  },
  
  "frontend": {
    "entry": "./frontend/index.ts",
    "routes": "./frontend/routes.ts",
    "components": {
      "UserList": "./frontend/views/UserList.vue",
      "UserForm": "./frontend/views/UserForm.vue"
    }
  },
  
  "menus": [
    {
      "id": "user-management-menu",
      "title": "用户管理",
      "path": "/user",
      "icon": "UserOutlined",
      "parentId": "system-management",
      "sortOrder": 1,
      "permission": "user:view"
    }
  ],
  
  "permissions": [
    {
      "code": "user:view",
      "name": "查看用户",
      "description": "查看用户列表和详情"
    },
    {
      "code": "user:create",
      "name": "创建用户",
      "description": "创建新用户"
    },
    {
      "code": "user:update",
      "name": "更新用户",
      "description": "更新用户信息"
    },
    {
      "code": "user:delete",
      "name": "删除用户",
      "description": "删除用户"
    }
  ],
  
  "config": {
    "schema": "./config/schema.json",
    "defaults": "./config/default.json"
  },
  
  "hooks": {
    "beforeInstall": "./backend/hooks/beforeInstall.ts",
    "afterInstall": "./backend/hooks/afterInstall.ts",
    "beforeUninstall": "./backend/hooks/beforeUninstall.ts",
    "afterUninstall": "./backend/hooks/afterUninstall.ts",
    "beforeEnable": "./backend/hooks/beforeEnable.ts",
    "afterEnable": "./backend/hooks/afterEnable.ts",
    "beforeDisable": "./backend/hooks/beforeDisable.ts",
    "afterDisable": "./backend/hooks/afterDisable.ts"
  },
  
  "database": {
    "tables": ["sys_users", "sys_user_profiles"],
    "version": "1.0.0"
  },
  
  "api": {
    "endpoints": [
      {
        "method": "GET",
        "path": "/users",
        "description": "获取用户列表",
        "permission": "user:view"
      },
      {
        "method": "POST",
        "path": "/users",
        "description": "创建用户",
        "permission": "user:create"
      }
    ]
  },
  
  "enabled": true,
  "installed": true,
  "installedAt": "2025-01-31T00:00:00.000Z",
  "updatedAt": "2025-01-31T00:00:00.000Z"
}
```

## 核心组件设计

### 1. 模块注册表 (ModuleRegistry)

**职责**: 管理所有模块的注册信息和状态

**接口设计**:

```typescript
interface IModuleRegistry {
  // 注册模块
  register(manifest: ModuleManifest): Promise<void>;
  
  // 注销模块
  unregister(moduleName: string): Promise<void>;
  
  // 获取模块信息
  getModule(moduleName: string): ModuleInfo | null;
  
  // 获取所有模块
  getAllModules(): ModuleInfo[];
  
  // 获取已启用的模块
  getEnabledModules(): ModuleInfo[];
  
  // 检查模块是否存在
  hasModule(moduleName: string): boolean;
  
  // 检查依赖关系
  checkDependencies(moduleName: string): DependencyCheckResult;
  
  // 获取依赖树
  getDependencyTree(moduleName: string): DependencyTree;
}

interface ModuleInfo {
  manifest: ModuleManifest;
  status: 'installed' | 'enabled' | 'disabled' | 'error';
  error?: string;
  loadedAt?: Date;
}
```

**数据库表设计**:

```sql
CREATE TABLE sys_modules (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  version VARCHAR(20) NOT NULL,
  description TEXT,
  author VARCHAR(100),
  type VARCHAR(50),
  category VARCHAR(50),
  
  manifest JSON NOT NULL,
  
  status ENUM('installed', 'enabled', 'disabled', 'error') DEFAULT 'installed',
  error_message TEXT,
  
  installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  enabled_at TIMESTAMP NULL,
  disabled_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_name (name),
  INDEX idx_status (status),
  INDEX idx_category (category)
);

CREATE TABLE sys_module_dependencies (
  id VARCHAR(36) PRIMARY KEY,
  module_name VARCHAR(100) NOT NULL,
  dependency_name VARCHAR(100) NOT NULL,
  version_range VARCHAR(50),
  
  FOREIGN KEY (module_name) REFERENCES sys_modules(name) ON DELETE CASCADE,
  UNIQUE KEY uk_module_dependency (module_name, dependency_name)
);
```

### 2. 模块加载器 (ModuleLoader)

**职责**: 动态加载和卸载模块

**接口设计**:

```typescript
interface IModuleLoader {
  // 加载模块
  load(moduleName: string): Promise<LoadedModule>;
  
  // 卸载模块
  unload(moduleName: string): Promise<void>;
  
  // 重新加载模块
  reload(moduleName: string): Promise<LoadedModule>;
  
  // 扫描模块目录
  scan(directory: string): Promise<ModuleManifest[]>;
}

interface LoadedModule {
  name: string;
  backend?: {
    routes: Router;
    service: any;
  };
  frontend?: {
    routes: RouteConfig[];
    components: Record<string, Component>;
  };
}
```

**实现要点**:

1. **后端模块加载**: 使用 `require()` 或 `import()` 动态加载
2. **前端模块加载**: 使用 Vue 的 `defineAsyncComponent` 和动态路由
3. **热重载**: 监听文件变化，自动重新加载模块
4. **错误隔离**: 模块加载失败不影响其他模块

### 3. 路由管理器 (RouteManager)

**职责**: 管理模块的路由注册和注销

**后端路由管理**:

```typescript
interface IBackendRouteManager {
  // 注册模块路由
  registerRoutes(moduleName: string, router: Router): void;
  
  // 注销模块路由
  unregisterRoutes(moduleName: string): void;
  
  // 获取所有路由
  getAllRoutes(): RouteInfo[];
  
  // 检查路由冲突
  checkConflict(path: string): boolean;
}

// 使用示例
const app = express();
const routeManager = new BackendRouteManager(app);

// 模块加载时
const moduleRouter = express.Router();
moduleRouter.get('/list', handler);
routeManager.registerRoutes('user-management', moduleRouter);

// 模块卸载时
routeManager.unregisterRoutes('user-management');
```

**前端路由管理**:

```typescript
interface IFrontendRouteManager {
  // 注册模块路由
  registerRoutes(moduleName: string, routes: RouteConfig[]): void;
  
  // 注销模块路由
  unregisterRoutes(moduleName: string): void;
  
  // 获取所有路由
  getAllRoutes(): RouteRecordRaw[];
  
  // 动态添加路由到 Vue Router
  addToRouter(router: Router): void;
}

// 使用示例
const routeManager = new FrontendRouteManager();

// 模块路由定义
const userRoutes = [
  {
    path: '/user',
    name: 'UserManagement',
    component: () => import('./views/UserList.vue'),
    meta: { title: '用户管理', permission: 'user:view' }
  }
];

routeManager.registerRoutes('user-management', userRoutes);
routeManager.addToRouter(vueRouter);
```

### 4. 菜单管理器 (MenuManager)

**职责**: 管理模块的菜单注册和显示

**接口设计**:

```typescript
interface IMenuManager {
  // 注册模块菜单
  registerMenus(moduleName: string, menus: MenuConfig[]): Promise<void>;
  
  // 注销模块菜单
  unregisterMenus(moduleName: string): Promise<void>;
  
  // 获取用户可见菜单
  getUserMenus(userId: string): Promise<MenuItem[]>;
  
  // 更新菜单状态
  updateMenuStatus(menuId: string, visible: boolean): Promise<void>;
}

interface MenuConfig {
  id: string;
  title: string;
  path: string;
  icon?: string;
  parentId?: string;
  sortOrder: number;
  permission?: string;
}
```

**实现策略**:

1. 模块启用时，自动创建菜单项到 `sys_menus` 表
2. 模块禁用时，设置菜单 `visible = false`
3. 模块卸载时，删除相关菜单项
4. 支持菜单的层级关系和排序

### 5. 数据库迁移管理器 (MigrationManager)

**职责**: 管理模块的数据库版本和迁移

**接口设计**:

```typescript
interface IMigrationManager {
  // 执行迁移
  migrate(moduleName: string, targetVersion?: string): Promise<void>;
  
  // 回滚迁移
  rollback(moduleName: string, targetVersion: string): Promise<void>;
  
  // 获取当前版本
  getCurrentVersion(moduleName: string): Promise<string>;
  
  // 获取待执行的迁移
  getPendingMigrations(moduleName: string): Promise<Migration[]>;
}

interface Migration {
  version: string;
  name: string;
  up: string;    // SQL 文件路径
  down: string;  // 回滚 SQL 文件路径
}
```

**数据库表设计**:

```sql
CREATE TABLE sys_module_migrations (
  id VARCHAR(36) PRIMARY KEY,
  module_name VARCHAR(100) NOT NULL,
  version VARCHAR(20) NOT NULL,
  name VARCHAR(200) NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  execution_time INT,
  
  FOREIGN KEY (module_name) REFERENCES sys_modules(name) ON DELETE CASCADE,
  UNIQUE KEY uk_module_version (module_name, version),
  INDEX idx_module (module_name)
);
```

**迁移文件命名规范**:

```
migrations/
├── 001_initial_schema.sql
├── 002_add_user_profile.sql
├── 003_add_indexes.sql
└── rollback/
    ├── 001_initial_schema.sql
    ├── 002_add_user_profile.sql
    └── 003_add_indexes.sql
```

### 6. 权限管理器 (PermissionManager)

**职责**: 管理模块的权限注册和检查

**接口设计**:

```typescript
interface IPermissionManager {
  // 注册模块权限
  registerPermissions(moduleName: string, permissions: PermissionConfig[]): Promise<void>;
  
  // 注销模块权限
  unregisterPermissions(moduleName: string): Promise<void>;
  
  // 检查用户权限
  checkPermission(userId: string, permission: string): Promise<boolean>;
  
  // 获取用户所有权限
  getUserPermissions(userId: string): Promise<string[]>;
}

interface PermissionConfig {
  code: string;
  name: string;
  description: string;
  category?: string;
}
```

### 7. 配置管理器 (ConfigManager)

**职责**: 管理模块的配置

**接口设计**:

```typescript
interface IConfigManager {
  // 获取模块配置
  getConfig(moduleName: string): Promise<any>;
  
  // 更新模块配置
  updateConfig(moduleName: string, config: any): Promise<void>;
  
  // 重置为默认配置
  resetConfig(moduleName: string): Promise<void>;
  
  // 验证配置
  validateConfig(moduleName: string, config: any): Promise<ValidationResult>;
}
```

**数据库表设计**:

```sql
CREATE TABLE sys_module_configs (
  id VARCHAR(36) PRIMARY KEY,
  module_name VARCHAR(100) NOT NULL,
  config_key VARCHAR(200) NOT NULL,
  config_value TEXT,
  is_encrypted BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (module_name) REFERENCES sys_modules(name) ON DELETE CASCADE,
  UNIQUE KEY uk_module_config (module_name, config_key)
);
```

## 模块生命周期

### 生命周期状态图

```
[未安装] 
    ↓ install
[已安装/禁用] 
    ↓ enable
[已启用] 
    ↓ disable
[已安装/禁用]
    ↓ uninstall
[未安装]
```

### 生命周期钩子

```typescript
interface ModuleHooks {
  // 安装前
  beforeInstall?: () => Promise<void>;
  // 安装后
  afterInstall?: () => Promise<void>;
  
  // 启用前
  beforeEnable?: () => Promise<void>;
  // 启用后
  afterEnable?: () => Promise<void>;
  
  // 禁用前
  beforeDisable?: () => Promise<void>;
  // 禁用后
  afterDisable?: () => Promise<void>;
  
  // 卸载前
  beforeUninstall?: () => Promise<void>;
  // 卸载后
  afterUninstall?: () => Promise<void>;
}
```

### 生命周期操作流程

**安装模块**:
1. 验证模块清单
2. 检查依赖关系
3. 执行 `beforeInstall` 钩子
4. 复制模块文件到 modules 目录
5. 注册模块到注册表
6. 执行数据库迁移
7. 注册权限
8. 执行 `afterInstall` 钩子
9. 更新模块状态为 `installed`

**启用模块**:
1. 检查模块是否已安装
2. 检查依赖模块是否已启用
3. 执行 `beforeEnable` 钩子
4. 加载模块代码
5. 注册后端路由
6. 注册前端路由
7. 创建菜单项
8. 执行 `afterEnable` 钩子
9. 更新模块状态为 `enabled`

**禁用模块**:
1. 检查是否有其他模块依赖
2. 执行 `beforeDisable` 钩子
3. 注销后端路由
4. 注销前端路由
5. 隐藏菜单项
6. 卸载模块代码
7. 执行 `afterDisable` 钩子
8. 更新模块状态为 `disabled`

**卸载模块**:
1. 确保模块已禁用
2. 检查是否有其他模块依赖
3. 执行 `beforeUninstall` 钩子
4. 回滚数据库迁移（可选）
5. 删除权限
6. 删除菜单
7. 从注册表注销
8. 删除模块文件（可选，保留配置）
9. 执行 `afterUninstall` 钩子

## 模块通信机制

### 事件总线

```typescript
interface IModuleEventBus {
  // 发布事件
  emit(event: string, data: any): void;
  
  // 订阅事件
  on(event: string, handler: (data: any) => void): void;
  
  // 取消订阅
  off(event: string, handler: (data: any) => void): void;
}

// 使用示例
// 模块 A 发布事件
eventBus.emit('user:created', { userId: '123', username: 'john' });

// 模块 B 订阅事件
eventBus.on('user:created', (data) => {
  console.log('New user created:', data);
  // 执行相关逻辑
});
```

### 服务注册

```typescript
interface IServiceRegistry {
  // 注册服务
  register(serviceName: string, service: any): void;
  
  // 获取服务
  get<T>(serviceName: string): T;
  
  // 检查服务是否存在
  has(serviceName: string): boolean;
}

// 使用示例
// 模块 A 注册服务
serviceRegistry.register('userService', new UserService());

// 模块 B 使用服务
const userService = serviceRegistry.get<UserService>('userService');
const user = await userService.getUser('123');
```

## 错误处理

### 错误类型

```typescript
class ModuleError extends Error {
  constructor(
    public code: string,
    public moduleName: string,
    message: string
  ) {
    super(message);
  }
}

// 错误代码
enum ModuleErrorCode {
  MODULE_NOT_FOUND = 'MODULE_NOT_FOUND',
  DEPENDENCY_NOT_MET = 'DEPENDENCY_NOT_MET',
  MIGRATION_FAILED = 'MIGRATION_FAILED',
  HOOK_FAILED = 'HOOK_FAILED',
  ROUTE_CONFLICT = 'ROUTE_CONFLICT',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
}
```

### 错误恢复策略

1. **模块加载失败**: 标记模块状态为 `error`，记录错误信息，不影响其他模块
2. **迁移失败**: 自动回滚已执行的迁移，恢复到之前的版本
3. **钩子失败**: 记录错误日志，继续执行后续步骤（可配置是否中断）
4. **路由冲突**: 拒绝注册，提示用户解决冲突

## 性能优化

### 懒加载

1. **按需加载**: 只加载已启用的模块
2. **延迟加载**: 首次访问时才加载模块代码
3. **代码分割**: 前端模块使用动态 import

### 缓存策略

1. **模块清单缓存**: 缓存已解析的 module.json
2. **路由缓存**: 缓存已注册的路由信息
3. **权限缓存**: 缓存用户权限，减少数据库查询

### 并发控制

1. **模块加载队列**: 控制同时加载的模块数量
2. **数据库连接池**: 复用数据库连接
3. **异步操作**: 使用 Promise.all 并行执行独立操作

## 安全考虑

### 代码安全

1. **代码签名**: 验证模块代码的完整性
2. **沙箱隔离**: 限制模块的系统访问权限
3. **依赖扫描**: 检查模块依赖的安全漏洞

### 权限隔离

1. **最小权限原则**: 模块只能访问声明的权限
2. **API 访问控制**: 验证模块间的 API 调用权限
3. **数据隔离**: 模块只能访问自己的数据表

### 配置安全

1. **敏感信息加密**: 加密存储 API 密钥等敏感配置
2. **配置验证**: 验证配置的合法性
3. **审计日志**: 记录配置的修改历史

## 测试策略

### 单元测试

- 测试每个核心组件的功能
- 模拟模块加载和卸载
- 测试依赖关系检查

### 集成测试

- 测试模块的完整生命周期
- 测试模块间通信
- 测试数据库迁移

### 端到端测试

- 测试模块的安装和启用流程
- 测试前端路由和菜单显示
- 测试权限控制

## 监控和日志

### 监控指标

- 模块加载时间
- 模块启用/禁用次数
- 模块错误率
- API 调用次数和响应时间

### 日志记录

```typescript
interface ModuleLogger {
  info(moduleName: string, message: string, data?: any): void;
  warn(moduleName: string, message: string, data?: any): void;
  error(moduleName: string, message: string, error?: Error): void;
  debug(moduleName: string, message: string, data?: any): void;
}
```

## 文档要求

每个模块必须包含：

1. **README.md**: 模块概述、安装说明、使用指南
2. **API.md**: API 接口文档
3. **CHANGELOG.md**: 版本变更记录
4. **用户指南**: 面向最终用户的使用文档
5. **开发指南**: 面向开发者的扩展文档
