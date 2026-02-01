# 模块迁移指南

## 概述

本指南基于示例模块（example），提供了将现有功能迁移到模块化架构的详细步骤和最佳实践。

## 迁移前准备

### 1. 分析现有代码

在开始迁移之前，需要分析现有代码：

- [ ] 识别功能边界
- [ ] 列出所有路由
- [ ] 列出所有数据库表
- [ ] 列出所有权限
- [ ] 列出所有菜单项
- [ ] 识别依赖关系
- [ ] 识别配置项

### 2. 规划模块结构

根据分析结果，规划模块：

- [ ] 确定模块名称（kebab-case）
- [ ] 确定模块类型（core/business/tool）
- [ ] 确定模块分类
- [ ] 列出依赖模块
- [ ] 设计数据库迁移策略

## 迁移步骤

### 步骤 1: 创建模块目录结构

```bash
modules/
└── {module-name}/
    ├── module.json
    ├── README.md
    ├── backend/
    │   ├── index.ts
    │   ├── types.ts
    │   ├── service.ts
    │   ├── routes.ts
    │   ├── hooks/
    │   └── migrations/
    ├── frontend/
    │   ├── index.ts
    │   ├── routes.ts
    │   ├── api/
    │   ├── views/
    │   └── components/
    └── config/
        ├── default.json
        └── schema.json
```

### 步骤 2: 创建 module.json

参考示例模块的 `module.json`，填写以下信息：

```json
{
  "name": "your-module",
  "displayName": "模块显示名称",
  "version": "1.0.0",
  "description": "模块描述",
  "author": "Your Team",
  "license": "MIT",
  
  "type": "business",
  "category": "system",
  "tags": ["tag1", "tag2"],
  
  "dependencies": {
    "other-module": "^1.0.0"
  },
  
  "backend": {
    "entry": "./backend/index.ts",
    "routes": {
      "prefix": "/your-module",
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
    "components": {}
  },
  
  "menus": [],
  "permissions": [],
  "config": {
    "schema": "./config/schema.json",
    "defaults": "./config/default.json"
  },
  "hooks": {},
  "database": {
    "tables": [],
    "version": "1.0.0"
  },
  "api": {
    "endpoints": []
  }
}
```

### 步骤 3: 迁移类型定义

创建 `backend/types.ts`，定义所有类型：

```typescript
// 实体类型
export interface YourEntity {
  id: string;
  // ... 其他字段
  created_at: Date;
  updated_at: Date;
}

// DTO 类型
export interface CreateYourEntityDto {
  // ... 创建所需字段
}

export interface UpdateYourEntityDto {
  // ... 更新所需字段（可选）
}

// 查询类型
export interface YourEntityListQuery {
  page?: number;
  pageSize?: number;
  // ... 其他查询参数
}

// 响应类型
export interface YourEntityListResponse {
  items: YourEntity[];
  total: number;
  page: number;
  pageSize: number;
}
```

### 步骤 4: 迁移业务逻辑

创建 `backend/service.ts`，迁移业务逻辑：

```typescript
import type { Pool } from 'mysql2/promise';
import type { YourEntity, CreateYourEntityDto } from './types';

export class YourService {
  constructor(private db: Pool) {}

  async getList(query: YourEntityListQuery): Promise<YourEntityListResponse> {
    // 实现列表查询
  }

  async getById(id: string): Promise<YourEntity | null> {
    // 实现详情查询
  }

  async create(data: CreateYourEntityDto): Promise<YourEntity> {
    // 实现创建
  }

  async update(id: string, data: UpdateYourEntityDto): Promise<YourEntity> {
    // 实现更新
  }

  async delete(id: string): Promise<void> {
    // 实现删除
  }
}
```

**迁移要点**:
- 将数据库操作集中到 Service 层
- 使用 TypeScript 类型
- 统一错误处理
- 添加事务支持

### 步骤 5: 迁移路由

创建 `backend/routes.ts`，迁移路由：

```typescript
import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import { YourService } from './service';

export function createYourRoutes(db: Pool): Router {
  const router = Router();
  const service = new YourService(db);

  // GET /your-module
  router.get('/', async (req, res) => {
    try {
      const result = await service.getList(req.query);
      res.json({ code: 200, message: 'success', data: result });
    } catch (error: any) {
      res.status(500).json({ code: 500, message: error.message });
    }
  });

  // 其他路由...

  return router;
}
```

**迁移要点**:
- 使用统一的响应格式
- 添加错误处理
- 添加权限检查中间件
- 添加参数验证

### 步骤 6: 创建数据库迁移

创建 `backend/migrations/001_initial.sql`：

```sql
-- 创建表
CREATE TABLE IF NOT EXISTS your_table (
  id VARCHAR(36) PRIMARY KEY,
  -- ... 其他字段
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_field (field)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

创建 `backend/migrations/rollback/001_initial.sql`：

```sql
-- 回滚：删除表
DROP TABLE IF EXISTS your_table;
```

**迁移要点**:
- 如果表已存在，使用 `IF NOT EXISTS`
- 为常用查询字段添加索引
- 使用 utf8mb4 字符集
- 提供回滚脚本

### 步骤 7: 实现生命周期钩子

创建 `backend/hooks/` 目录下的钩子文件：

```typescript
// beforeInstall.ts
export async function beforeInstall(): Promise<void> {
  console.log('[YourModule] Running beforeInstall hook...');
  // 安装前检查
}

// afterInstall.ts
export async function afterInstall(): Promise<void> {
  console.log('[YourModule] Running afterInstall hook...');
  // 安装后初始化
}

// 其他钩子...
```

**常用钩子场景**:
- `beforeInstall`: 检查依赖、验证环境
- `afterInstall`: 创建默认数据、初始化配置
- `beforeEnable`: 检查配置、验证数据
- `afterEnable`: 启动定时任务、注册事件
- `beforeDisable`: 停止定时任务、清理缓存
- `afterDisable`: 记录日志
- `beforeUninstall`: 备份数据、检查依赖
- `afterUninstall`: 清理文件、清理缓存

### 步骤 8: 创建后端入口

创建 `backend/index.ts`：

```typescript
import type { Pool } from 'mysql2/promise';
import { createYourRoutes } from './routes';

export interface YourModuleOptions {
  db: Pool;
}

export function initYourModule(options: YourModuleOptions) {
  const { db } = options;

  return {
    routes: createYourRoutes(db),
    name: 'your-module',
    version: '1.0.0'
  };
}

export * from './types';
export * from './service';
```

### 步骤 9: 迁移前端 API

创建 `frontend/api/index.ts`：

```typescript
import axios from 'axios';
import type { YourEntity, CreateYourEntityDto } from '../../backend/types';

const API_BASE = '/api/your-module';

export const yourApi = {
  async getList(query?: any): Promise<any> {
    const { data } = await axios.get(API_BASE, { params: query });
    return data.data;
  },

  async getById(id: string): Promise<YourEntity> {
    const { data } = await axios.get(`${API_BASE}/${id}`);
    return data.data;
  },

  async create(dto: CreateYourEntityDto): Promise<YourEntity> {
    const { data } = await axios.post(API_BASE, dto);
    return data.data;
  },

  async update(id: string, dto: any): Promise<YourEntity> {
    const { data } = await axios.put(`${API_BASE}/${id}`, dto);
    return data.data;
  },

  async delete(id: string): Promise<void> {
    await axios.delete(`${API_BASE}/${id}`);
  }
};
```

### 步骤 10: 迁移前端页面

创建 `frontend/views/` 下的页面组件：

```vue
<template>
  <div class="your-module">
    <a-card title="标题">
      <!-- 搜索栏 -->
      <div class="search-bar">
        <!-- 搜索组件 -->
      </div>

      <!-- 表格 -->
      <a-table
        :columns="columns"
        :data-source="dataSource"
        :loading="loading"
        :pagination="pagination"
        @change="handleTableChange"
      >
        <!-- 自定义列 -->
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { yourApi } from '../api';

// 实现逻辑
</script>
```

**迁移要点**:
- 使用 Composition API
- 使用 TypeScript
- 统一错误处理
- 添加加载状态

### 步骤 11: 配置前端路由

创建 `frontend/routes.ts`：

```typescript
import type { RouteRecordRaw } from 'vue-router';

export const yourRoutes: RouteRecordRaw[] = [
  {
    path: '/your-module',
    name: 'YourModule',
    component: () => import('./views/YourList.vue'),
    meta: {
      title: '模块标题',
      permission: 'your:view',
      icon: 'IconName'
    }
  }
];
```

### 步骤 12: 创建前端入口

创建 `frontend/index.ts`：

```typescript
import { yourRoutes } from './routes';

export function initYourFrontend() {
  return {
    routes: yourRoutes,
    name: 'your-module',
    version: '1.0.0'
  };
}

export { yourRoutes };
export * from './api';
```

### 步骤 13: 配置模块

创建 `config/default.json`：

```json
{
  "setting1": "value1",
  "setting2": 100
}
```

创建 `config/schema.json`：

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "setting1": {
      "type": "string",
      "description": "设置1的描述"
    },
    "setting2": {
      "type": "number",
      "minimum": 0,
      "description": "设置2的描述"
    }
  },
  "required": ["setting1"]
}
```

### 步骤 14: 编写文档

创建 `README.md`，包含：

- 模块概述
- 功能特性
- 目录结构
- 安装指南
- 使用说明
- API 文档
- 配置说明
- 开发指南
- 常见问题

参考示例模块的 README.md。

### 步骤 15: 编写测试

创建 `tests/modules/your-module/` 目录：

```typescript
// service.test.ts
import { describe, it, expect } from 'vitest';
import { YourService } from '../../../modules/your-module/backend/service';

describe('YourService', () => {
  it('should work', () => {
    // 测试逻辑
  });
});
```

**测试要点**:
- 测试所有 Service 方法
- 测试边界情况
- 测试错误处理
- Mock 数据库调用

### 步骤 16: 验证模块

使用模块扫描器验证：

```typescript
import { moduleScanner } from '@/module-system';

const result = await moduleScanner.scan('modules');
const yourModule = result.modules.find(m => m.name === 'your-module');

console.log('Validation:', result.errors);
```

## 迁移检查清单

### 结构检查
- [ ] 目录结构符合标准
- [ ] module.json 格式正确
- [ ] 所有必需文件存在

### 后端检查
- [ ] 类型定义完整
- [ ] Service 层实现完整
- [ ] 路由配置正确
- [ ] 数据库迁移脚本
- [ ] 生命周期钩子
- [ ] 错误处理

### 前端检查
- [ ] API 封装完整
- [ ] 页面组件实现
- [ ] 路由配置正确
- [ ] 类型安全
- [ ] 错误处理

### 配置检查
- [ ] 默认配置
- [ ] 配置 Schema
- [ ] 配置文档

### 文档检查
- [ ] README.md
- [ ] API 文档
- [ ] 代码注释

### 测试检查
- [ ] 单元测试
- [ ] 集成测试
- [ ] 测试通过

## 常见问题

### Q: 如何处理现有数据？

A: 有两种策略：

1. **保留现有表**: 在迁移脚本中使用 `IF NOT EXISTS`
2. **迁移数据**: 创建新表，编写数据迁移脚本

### Q: 如何处理模块间依赖？

A: 在 `module.json` 中声明依赖：

```json
{
  "dependencies": {
    "other-module": "^1.0.0"
  }
}
```

### Q: 如何处理共享代码？

A: 有几种方式：

1. 创建 `common` 模块
2. 使用 npm 包
3. 使用服务注册机制

### Q: 如何测试模块？

A: 使用生命周期管理器：

```typescript
import { createLifecycleManager } from '@/module-system';

const lifecycleManager = createLifecycleManager(db);
await lifecycleManager.install('your-module');
await lifecycleManager.enable('your-module');

// 测试功能...

await lifecycleManager.disable('your-module');
await lifecycleManager.uninstall('your-module');
```

### Q: 如何处理配置迁移？

A: 在 `afterInstall` 钩子中：

```typescript
export async function afterInstall(): Promise<void> {
  // 读取旧配置
  const oldConfig = await readOldConfig();
  
  // 转换为新格式
  const newConfig = transformConfig(oldConfig);
  
  // 保存新配置
  await configManager.updateConfig('your-module', newConfig);
}
```

## 最佳实践

### 1. 模块命名
- 使用 kebab-case
- 名称要有意义
- 避免过长

### 2. 版本管理
- 遵循 semver
- 记录 CHANGELOG
- 标记破坏性变更

### 3. 依赖管理
- 最小化依赖
- 明确版本范围
- 避免循环依赖

### 4. 错误处理
- 统一错误格式
- 详细错误信息
- 记录错误日志

### 5. 性能优化
- 使用索引
- 实现缓存
- 懒加载

### 6. 安全性
- 验证输入
- 权限检查
- SQL 注入防护

### 7. 测试
- 高测试覆盖
- 测试边界情况
- 集成测试

### 8. 文档
- 保持更新
- 详细说明
- 提供示例

## 参考资源

- [示例模块](../../../modules/example/)
- [设计文档](./design.md)
- [开发指南](./module-development-guide.md)
- [API 文档](./api-documentation.md)

## 总结

模块迁移是一个系统性的工作，需要：

1. 充分分析现有代码
2. 遵循标准结构
3. 保持代码质量
4. 编写充分测试
5. 完善文档

参考示例模块，按照本指南的步骤进行迁移，可以确保迁移的质量和一致性。

