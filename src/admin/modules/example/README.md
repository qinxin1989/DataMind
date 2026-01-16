# 示例模块

这是一个示例模块，展示如何在模块化后台管理框架中添加新功能模块。

## 模块结构

```
src/admin/modules/example/
├── README.md           # 模块说明文档
├── exampleService.ts   # 业务逻辑服务
└── routes.ts           # API 路由定义
```

## 创建新模块步骤

### 1. 创建模块目录

```bash
mkdir src/admin/modules/your-module
```

### 2. 创建服务文件

```typescript
// src/admin/modules/your-module/yourService.ts

export class YourService {
  // 实现业务逻辑
  async getData(): Promise<any[]> {
    return [];
  }
}

export const yourService = new YourService();
```

### 3. 创建路由文件

```typescript
// src/admin/modules/your-module/routes.ts

import { Router, Request, Response } from 'express';
import { yourService } from './yourService';
import { requirePermission } from '../../middleware/permission';
import type { ApiResponse } from '../../types';

const router = Router();

function success<T>(data: T): ApiResponse<T> {
  return { success: true, data, timestamp: Date.now() };
}

router.get('/', requirePermission('your-module:view'), async (req: Request, res: Response) => {
  const data = await yourService.getData();
  res.json(success(data));
});

export default router;
```

### 4. 注册路由

在 `src/admin/index.ts` 中添加：

```typescript
import yourModuleRoutes from './modules/your-module/routes';

// 在 createAdminRouter 函数中添加
router.use('/your-module', yourModuleRoutes);
```

### 5. 添加权限

在权限服务中注册新模块的权限：

```typescript
// 权限编码格式: module:action
// 例如: your-module:view, your-module:create, your-module:update, your-module:delete
```

### 6. 编写测试

```typescript
// tests/admin/yourService.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { YourService } from '../../src/admin/modules/your-module/yourService';

describe('YourService', () => {
  let service: YourService;

  beforeEach(() => {
    service = new YourService();
  });

  it('should return data', async () => {
    const data = await service.getData();
    expect(Array.isArray(data)).toBe(true);
  });
});
```

## 最佳实践

1. **服务层分离**: 将业务逻辑放在 Service 类中，路由只负责请求处理
2. **权限控制**: 使用 `requirePermission` 中间件保护 API
3. **类型安全**: 使用 TypeScript 类型定义
4. **错误处理**: 统一使用 ApiResponse 格式返回
5. **测试覆盖**: 为每个服务编写单元测试

## API 响应格式

```typescript
// 成功响应
{
  success: true,
  data: any,
  timestamp: number
}

// 错误响应
{
  success: false,
  error: {
    code: string,
    message: string
  },
  timestamp: number
}
```

## 权限编码规范

- 格式: `module:action`
- 常用 action: `view`, `create`, `update`, `delete`, `export`, `import`
- 示例: `user:view`, `menu:create`, `ai:config`
