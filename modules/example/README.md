# 示例模块 (Example Module)

## 概述

这是一个简单的示例模块，展示了模块化架构的基本用法。它实现了一个完整的 CRUD 功能，包括：

- 创建、读取、更新、删除示例项
- 列表查询和分页
- 状态管理
- 批量操作

## 功能特性

- ✅ 完整的 CRUD 操作
- ✅ 列表查询和分页
- ✅ 关键词搜索
- ✅ 状态筛选
- ✅ 批量删除
- ✅ 权限控制
- ✅ 生命周期钩子
- ✅ 数据库迁移
- ✅ 配置管理

## 目录结构

```
example/
├── module.json                 # 模块清单
├── README.md                   # 本文档
├── backend/                    # 后端代码
│   ├── index.ts               # 后端入口
│   ├── routes.ts              # 路由定义
│   ├── service.ts             # 业务逻辑
│   ├── types.ts               # 类型定义
│   ├── hooks/                 # 生命周期钩子
│   │   ├── beforeInstall.ts
│   │   ├── afterInstall.ts
│   │   ├── beforeEnable.ts
│   │   ├── afterEnable.ts
│   │   ├── beforeDisable.ts
│   │   ├── afterDisable.ts
│   │   ├── beforeUninstall.ts
│   │   └── afterUninstall.ts
│   └── migrations/            # 数据库迁移
│       ├── 001_initial.sql
│       └── rollback/
│           └── 001_initial.sql
├── frontend/                   # 前端代码
│   ├── index.ts               # 前端入口
│   ├── routes.ts              # 路由配置
│   ├── api/                   # API 调用
│   │   └── index.ts
│   ├── views/                 # 页面组件
│   │   └── ExampleList.vue
│   └── components/            # 可复用组件
│       └── ExampleForm.vue
└── config/                     # 配置文件
    ├── default.json           # 默认配置
    └── schema.json            # 配置 Schema
```

## 安装

### 使用生命周期管理器

```typescript
import { createLifecycleManager } from '@/module-system';

const lifecycleManager = createLifecycleManager(db);

// 安装模块
await lifecycleManager.install('example');

// 启用模块
await lifecycleManager.enable('example');
```

### 手动安装

1. 复制模块到 `modules/example` 目录
2. 执行数据库迁移：
   ```bash
   mysql -u root -p database_name < modules/example/backend/migrations/001_initial.sql
   ```
3. 注册模块到系统

## 使用

### 后端 API

#### 获取列表

```http
GET /api/example?page=1&pageSize=10&status=active&keyword=test
```

#### 创建示例

```http
POST /api/example
Content-Type: application/json

{
  "title": "示例标题",
  "description": "示例描述",
  "status": "active"
}
```

#### 更新示例

```http
PUT /api/example/:id
Content-Type: application/json

{
  "title": "更新后的标题",
  "status": "inactive"
}
```

#### 删除示例

```http
DELETE /api/example/:id
```

#### 批量删除

```http
POST /api/example/batch-delete
Content-Type: application/json

{
  "ids": ["id1", "id2", "id3"]
}
```

### 前端使用

```typescript
import { exampleApi } from '@/modules/example/frontend/api';

// 获取列表
const result = await exampleApi.getList({
  page: 1,
  pageSize: 10,
  status: 'active'
});

// 创建
const item = await exampleApi.create({
  title: '新示例',
  description: '描述',
  status: 'active'
});

// 更新
await exampleApi.update('id', {
  title: '更新后的标题'
});

// 删除
await exampleApi.delete('id');
```

## 权限

模块定义了以下权限：

- `example:view` - 查看示例
- `example:create` - 创建示例
- `example:update` - 更新示例
- `example:delete` - 删除示例

## 配置

模块支持以下配置项：

```json
{
  "pageSize": 10,
  "enableCache": true,
  "cacheExpiration": 3600,
  "maxItemsPerUser": 100
}
```

### 配置说明

- `pageSize`: 每页显示的记录数（1-100）
- `enableCache`: 是否启用缓存
- `cacheExpiration`: 缓存过期时间（秒）
- `maxItemsPerUser`: 每个用户最多可创建的记录数

## 生命周期钩子

模块实现了完整的生命周期钩子：

- `beforeInstall` - 安装前执行
- `afterInstall` - 安装后执行
- `beforeEnable` - 启用前执行
- `afterEnable` - 启用后执行
- `beforeDisable` - 禁用前执行
- `afterDisable` - 禁用后执行
- `beforeUninstall` - 卸载前执行
- `afterUninstall` - 卸载后执行

## 数据库

### 表结构

```sql
CREATE TABLE example_items (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);
```

## 开发指南

### 添加新功能

1. 在 `backend/service.ts` 中添加业务逻辑
2. 在 `backend/routes.ts` 中添加路由
3. 在 `frontend/api/index.ts` 中添加 API 调用
4. 在前端组件中使用新功能

### 添加数据库迁移

1. 创建新的迁移文件：`002_add_field.sql`
2. 创建对应的回滚文件：`rollback/002_add_field.sql`
3. 更新 `module.json` 中的数据库版本

### 添加权限

1. 在 `module.json` 的 `permissions` 数组中添加新权限
2. 在路由中使用权限检查中间件
3. 在前端组件中根据权限显示/隐藏功能

## 测试

```bash
# 运行测试
npm test modules/example

# 运行测试并生成覆盖率报告
npm test modules/example -- --coverage
```

## 卸载

```typescript
import { createLifecycleManager } from '@/module-system';

const lifecycleManager = createLifecycleManager(db);

// 禁用模块
await lifecycleManager.disable('example');

// 卸载模块
await lifecycleManager.uninstall('example');
```

## 常见问题

### Q: 如何修改默认配置？

A: 使用配置管理器：

```typescript
import { configManager } from '@/module-system';

await configManager.updateConfig('example', {
  pageSize: 20,
  enableCache: false
});
```

### Q: 如何添加自定义验证？

A: 在 `backend/routes.ts` 中添加验证中间件：

```typescript
router.post('/', validateMiddleware, async (req, res) => {
  // ...
});
```

### Q: 如何处理模块间依赖？

A: 在 `module.json` 中声明依赖：

```json
{
  "dependencies": {
    "other-module": "^1.0.0"
  }
}
```

## 许可证

MIT

## 作者

System Team

## 版本历史

- 1.0.0 (2025-01-31)
  - 初始版本
  - 实现基本 CRUD 功能
  - 添加生命周期钩子
  - 添加配置管理
