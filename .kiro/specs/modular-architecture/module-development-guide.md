# 模块开发指南

## 快速开始

### 使用 CLI 创建模块

```bash
# 安装 CLI 工具
npm install -g @your-platform/module-cli

# 创建新模块
module-cli create user-management

# 进入模块目录
cd modules/user-management

# 安装依赖
npm install

# 开发模式
npm run dev

# 构建模块
npm run build

# 测试模块
npm test
```

### 手动创建模块

1. 在 `modules/` 目录下创建模块文件夹
2. 创建 `module.json` 清单文件
3. 按照标准结构组织代码
4. 实现必要的接口和钩子

## 模块清单配置

### 基本信息

```json
{
  "name": "user-management",
  "displayName": "用户管理",
  "version": "1.0.0",
  "description": "用户账户管理模块",
  "author": "Your Team",
  "license": "MIT"
}
```

### 依赖声明

```json
{
  "dependencies": {
    "role-management": "^1.0.0",
    "audit-log": "^1.0.0"
  },
  "peerDependencies": {
    "node": ">=18.0.0",
    "vue": "^3.0.0"
  }
}
```

版本范围语法：
- `1.0.0` - 精确版本
- `^1.0.0` - 兼容版本（1.x.x）
- `~1.0.0` - 补丁版本（1.0.x）
- `>=1.0.0` - 大于等于
- `1.0.0 - 2.0.0` - 范围

## 后端开发

### 路由定义

```typescript
// backend/routes.ts
import { Router } from 'express';
import { UserService } from './service';
import { authMiddleware, requirePermission } from '@/middleware';

export function createRoutes(service: UserService): Router {
  const router = Router();

  // 获取用户列表
  router.get(
    '/list',
    authMiddleware,
    requirePermission('user:view'),
    async (req, res) => {
      try {
        const users = await service.getUsers(req.query);
        res.json({ success: true, data: users });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  );

  // 创建用户
  router.post(
    '/',
    authMiddleware,
    requirePermission('user:create'),
    async (req, res) => {
      try {
        const user = await service.createUser(req.body);
        res.json({ success: true, data: user });
      } catch (error) {
        res.status(400).json({ success: false, error: error.message });
      }
    }
  );

  return router;
}
```

### 服务层实现

```typescript
// backend/service.ts
import { pool } from '@/core/database';
import { ModuleLogger } from '@/core/logger';

export class UserService {
  private logger: ModuleLogger;

  constructor() {
    this.logger = new ModuleLogger('user-management');
  }

  async getUsers(query: any) {
    this.logger.info('Getting users', { query });
    
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM sys_users WHERE status = ?',
        [query.status || 'active']
      );
      return rows;
    } finally {
      connection.release();
    }
  }

  async createUser(data: any) {
    this.logger.info('Creating user', { username: data.username });
    
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      const [result] = await connection.execute(
        'INSERT INTO sys_users (username, email) VALUES (?, ?)',
        [data.username, data.email]
      );
      
      await connection.commit();
      return { id: result.insertId, ...data };
    } catch (error) {
      await connection.rollback();
      this.logger.error('Failed to create user', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}
```

### 模块入口

```typescript
// backend/index.ts
import { UserService } from './service';
import { createRoutes } from './routes';

export default {
  // 模块初始化
  async initialize(context: ModuleContext) {
    const service = new UserService();
    const routes = createRoutes(service);
    
    // 注册服务到全局
    context.serviceRegistry.register('userService', service);
    
    return {
      routes,
      service
    };
  },
  
  // 模块销毁
  async destroy(context: ModuleContext) {
    context.serviceRegistry.unregister('userService');
  }
};
```

### 数据库迁移

```sql
-- backend/migrations/001_initial_schema.sql
CREATE TABLE IF NOT EXISTS sys_users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  status ENUM('active', 'inactive', 'pending') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_username (username),
  INDEX idx_email (email),
  INDEX idx_status (status)
);

-- backend/migrations/rollback/001_initial_schema.sql
DROP TABLE IF EXISTS sys_users;
```

## 前端开发

### 路由配置

```typescript
// frontend/routes.ts
import type { RouteRecordRaw } from 'vue-router';

export const routes: RouteRecordRaw[] = [
  {
    path: '/user',
    name: 'UserManagement',
    component: () => import('./views/UserList.vue'),
    meta: {
      title: '用户管理',
      icon: 'UserOutlined',
      permission: 'user:view'
    },
    children: [
      {
        path: 'create',
        name: 'UserCreate',
        component: () => import('./views/UserForm.vue'),
        meta: {
          title: '创建用户',
          permission: 'user:create'
        }
      },
      {
        path: ':id/edit',
        name: 'UserEdit',
        component: () => import('./views/UserForm.vue'),
        meta: {
          title: '编辑用户',
          permission: 'user:update'
        }
      }
    ]
  }
];
```

### 页面组件

```vue
<!-- frontend/views/UserList.vue -->
<template>
  <div class="user-list">
    <a-card title="用户列表">
      <template #extra>
        <a-button type="primary" @click="handleCreate">
          <PlusOutlined /> 新建用户
        </a-button>
      </template>
      
      <a-table
        :columns="columns"
        :data-source="users"
        :loading="loading"
        :pagination="pagination"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'action'">
            <a-space>
              <a-button size="small" @click="handleEdit(record)">
                编辑
              </a-button>
              <a-popconfirm
                title="确定删除吗？"
                @confirm="handleDelete(record)"
              >
                <a-button size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { PlusOutlined } from '@ant-design/icons-vue';
import { userApi } from '../api';

const router = useRouter();
const loading = ref(false);
const users = ref([]);
const pagination = ref({
  current: 1,
  pageSize: 10,
  total: 0
});

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id' },
  { title: '用户名', dataIndex: 'username', key: 'username' },
  { title: '邮箱', dataIndex: 'email', key: 'email' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '操作', key: 'action' }
];

const fetchUsers = async () => {
  loading.value = true;
  try {
    const { data } = await userApi.getUsers({
      page: pagination.value.current,
      pageSize: pagination.value.pageSize
    });
    users.value = data.list;
    pagination.value.total = data.total;
  } catch (error) {
    message.error('获取用户列表失败');
  } finally {
    loading.value = false;
  }
};

const handleCreate = () => {
  router.push({ name: 'UserCreate' });
};

const handleEdit = (record: any) => {
  router.push({ name: 'UserEdit', params: { id: record.id } });
};

const handleDelete = async (record: any) => {
  try {
    await userApi.deleteUser(record.id);
    message.success('删除成功');
    fetchUsers();
  } catch (error) {
    message.error('删除失败');
  }
};

const handleTableChange = (pag: any) => {
  pagination.value = pag;
  fetchUsers();
};

onMounted(() => {
  fetchUsers();
});
</script>
```

### API 封装

```typescript
// frontend/api/index.ts
import request from '@/utils/request';

export const userApi = {
  getUsers(params: any) {
    return request.get('/admin/users/list', { params });
  },
  
  getUser(id: string) {
    return request.get(`/admin/users/${id}`);
  },
  
  createUser(data: any) {
    return request.post('/admin/users', data);
  },
  
  updateUser(id: string, data: any) {
    return request.put(`/admin/users/${id}`, data);
  },
  
  deleteUser(id: string) {
    return request.delete(`/admin/users/${id}`);
  }
};
```

### 状态管理

```typescript
// frontend/stores/user.ts
import { defineStore } from 'pinia';
import { userApi } from '../api';

export const useUserStore = defineStore('user', {
  state: () => ({
    users: [],
    currentUser: null,
    loading: false
  }),
  
  actions: {
    async fetchUsers() {
      this.loading = true;
      try {
        const { data } = await userApi.getUsers({});
        this.users = data.list;
      } finally {
        this.loading = false;
      }
    },
    
    async fetchUser(id: string) {
      const { data } = await userApi.getUser(id);
      this.currentUser = data;
    }
  }
});
```

## 生命周期钩子

### 安装钩子

```typescript
// backend/hooks/beforeInstall.ts
export default async function beforeInstall(context: HookContext) {
  // 检查系统要求
  const nodeVersion = process.version;
  if (nodeVersion < 'v18.0.0') {
    throw new Error('需要 Node.js 18.0.0 或更高版本');
  }
  
  // 检查依赖模块
  const requiredModules = ['role-management', 'audit-log'];
  for (const moduleName of requiredModules) {
    if (!context.moduleRegistry.hasModule(moduleName)) {
      throw new Error(`缺少依赖模块: ${moduleName}`);
    }
  }
  
  context.logger.info('安装前检查通过');
}

// backend/hooks/afterInstall.ts
export default async function afterInstall(context: HookContext) {
  // 初始化默认数据
  const connection = await context.database.getConnection();
  try {
    await connection.execute(`
      INSERT INTO sys_users (id, username, email, password_hash, status)
      VALUES ('admin', 'admin', 'admin@example.com', 'hashed', 'active')
      ON DUPLICATE KEY UPDATE username = username
    `);
    
    context.logger.info('默认管理员账户已创建');
  } finally {
    connection.release();
  }
}
```

### 启用/禁用钩子

```typescript
// backend/hooks/beforeEnable.ts
export default async function beforeEnable(context: HookContext) {
  // 检查配置
  const config = await context.configManager.getConfig('user-management');
  if (!config.emailService) {
    context.logger.warn('未配置邮件服务，部分功能可能不可用');
  }
}

// backend/hooks/afterDisable.ts
export default async function afterDisable(context: HookContext) {
  // 清理缓存
  await context.cache.clear('user:*');
  context.logger.info('用户缓存已清理');
}
```

## 权限定义

```json
{
  "permissions": [
    {
      "code": "user:view",
      "name": "查看用户",
      "description": "查看用户列表和详情",
      "category": "用户管理"
    },
    {
      "code": "user:create",
      "name": "创建用户",
      "description": "创建新用户账户",
      "category": "用户管理"
    },
    {
      "code": "user:update",
      "name": "更新用户",
      "description": "更新用户信息",
      "category": "用户管理"
    },
    {
      "code": "user:delete",
      "name": "删除用户",
      "description": "删除用户账户",
      "category": "用户管理"
    },
    {
      "code": "user:approve",
      "name": "审核用户",
      "description": "审核待审核的用户",
      "category": "用户管理"
    }
  ]
}
```

## 配置管理

### 配置 Schema

```json
// config/schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "emailService": {
      "type": "object",
      "properties": {
        "enabled": { "type": "boolean" },
        "host": { "type": "string" },
        "port": { "type": "number" },
        "secure": { "type": "boolean" }
      },
      "required": ["enabled", "host", "port"]
    },
    "passwordPolicy": {
      "type": "object",
      "properties": {
        "minLength": { "type": "number", "minimum": 6 },
        "requireUppercase": { "type": "boolean" },
        "requireNumber": { "type": "boolean" },
        "requireSpecialChar": { "type": "boolean" }
      }
    }
  }
}
```

### 默认配置

```json
// config/default.json
{
  "emailService": {
    "enabled": false,
    "host": "smtp.example.com",
    "port": 587,
    "secure": true
  },
  "passwordPolicy": {
    "minLength": 8,
    "requireUppercase": true,
    "requireNumber": true,
    "requireSpecialChar": false
  },
  "sessionTimeout": 3600,
  "maxLoginAttempts": 5
}
```

## 测试

### 后端单元测试

```typescript
// tests/backend/service.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UserService } from '../../backend/service';
import { pool } from '@/core/database';

describe('UserService', () => {
  let service: UserService;
  let connection: any;

  beforeEach(async () => {
    service = new UserService();
    connection = await pool.getConnection();
    await connection.execute('START TRANSACTION');
  });

  afterEach(async () => {
    await connection.execute('ROLLBACK');
    connection.release();
  });

  it('should create user', async () => {
    const userData = {
      username: 'testuser',
      email: 'test@example.com'
    };
    
    const user = await service.createUser(userData);
    
    expect(user).toHaveProperty('id');
    expect(user.username).toBe(userData.username);
    expect(user.email).toBe(userData.email);
  });

  it('should get users', async () => {
    const users = await service.getUsers({ status: 'active' });
    
    expect(Array.isArray(users)).toBe(true);
  });
});
```

### 前端组件测试

```typescript
// tests/frontend/UserList.test.ts
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import UserList from '../../frontend/views/UserList.vue';
import { userApi } from '../../frontend/api';

vi.mock('../../frontend/api', () => ({
  userApi: {
    getUsers: vi.fn(() => Promise.resolve({
      data: {
        list: [
          { id: '1', username: 'user1', email: 'user1@example.com' }
        ],
        total: 1
      }
    }))
  }
}));

describe('UserList', () => {
  it('should render user list', async () => {
    const wrapper = mount(UserList);
    
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(wrapper.find('.user-list').exists()).toBe(true);
    expect(userApi.getUsers).toHaveBeenCalled();
  });
});
```

## 打包和发布

### 构建脚本

```json
// package.json
{
  "scripts": {
    "build": "npm run build:backend && npm run build:frontend",
    "build:backend": "tsc -p tsconfig.backend.json",
    "build:frontend": "vite build",
    "test": "vitest",
    "lint": "eslint . --ext .ts,.vue",
    "format": "prettier --write \"**/*.{ts,vue,json,md}\""
  }
}
```

### 打包配置

```typescript
// build.config.ts
export default {
  entry: {
    backend: './backend/index.ts',
    frontend: './frontend/index.ts'
  },
  output: {
    dir: 'dist',
    format: 'esm'
  },
  external: [
    'express',
    'vue',
    'vue-router',
    'pinia'
  ]
};
```

## 最佳实践

### 代码规范

1. 使用 TypeScript 进行类型检查
2. 遵循 ESLint 规则
3. 使用 Prettier 格式化代码
4. 编写清晰的注释和文档

### 错误处理

```typescript
// 统一的错误处理
class ModuleError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ModuleError';
  }
}

// 使用示例
try {
  await service.createUser(data);
} catch (error) {
  if (error.code === 'ER_DUP_ENTRY') {
    throw new ModuleError(
      'USER_EXISTS',
      '用户名已存在',
      { username: data.username }
    );
  }
  throw error;
}
```

### 日志记录

```typescript
// 使用模块日志记录器
this.logger.info('User created', { userId: user.id });
this.logger.warn('Email service not configured');
this.logger.error('Failed to create user', error);
this.logger.debug('Query params', { params });
```

### 性能优化

1. 使用数据库连接池
2. 实现查询结果缓存
3. 使用分页加载大量数据
4. 前端组件懒加载
5. 优化数据库索引

### 安全考虑

1. 验证所有用户输入
2. 使用参数化查询防止 SQL 注入
3. 实现权限检查
4. 加密敏感数据
5. 记录审计日志

## 常见问题

### Q: 如何调试模块？

A: 使用开发模式启动应用，模块会自动热重载：

```bash
npm run dev
```

### Q: 如何处理模块依赖？

A: 在 module.json 中声明依赖，系统会自动检查：

```json
{
  "dependencies": {
    "other-module": "^1.0.0"
  }
}
```

### Q: 如何共享代码？

A: 使用服务注册机制或事件总线：

```typescript
// 注册服务
context.serviceRegistry.register('myService', service);

// 使用服务
const service = context.serviceRegistry.get('myService');
```

### Q: 如何处理数据库迁移失败？

A: 系统会自动回滚，检查迁移脚本的 SQL 语法和数据库状态。

## 参考资源

- [模块 API 文档](./api-reference.md)
- [核心服务文档](./core-services.md)
- [示例模块](../examples/)
- [常见问题](./faq.md)
