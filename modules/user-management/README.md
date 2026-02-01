# 用户管理模块

## 概述

用户管理模块提供完整的用户账户管理功能，包括用户的创建、查询、更新、删除，以及状态管理、密码管理等功能。

## 功能特性

- ✅ 用户 CRUD 操作
- ✅ 用户列表查询和分页
- ✅ 关键词搜索（用户名、邮箱、姓名）
- ✅ 状态筛选和管理
- ✅ 角色管理
- ✅ 批量操作（批量禁用、批量删除）
- ✅ 密码重置
- ✅ 登录记录
- ✅ 权限控制

## 安装

```bash
# 使用 CLI 工具安装
npm run module install user-management

# 或手动安装
npm run module:install -- --name user-management
```

## 配置

模块配置文件位于 `config/default.json`：

```json
{
  "passwordMinLength": 6,
  "passwordRequireUppercase": false,
  "passwordRequireNumber": false,
  "passwordRequireSpecialChar": false,
  "maxLoginAttempts": 5,
  "lockoutDuration": 1800,
  "sessionTimeout": 3600
}
```

## API 端点

### 用户查询

- `GET /api/users` - 获取用户列表
- `GET /api/users/:id` - 获取用户详情

### 用户管理

- `POST /api/users` - 创建用户
- `PUT /api/users/:id` - 更新用户
- `DELETE /api/users/:id` - 删除用户

### 状态管理

- `PUT /api/users/:id/status` - 更新用户状态
- `POST /api/users/batch/status` - 批量更新状态
- `POST /api/users/batch/delete` - 批量删除

### 密码管理

- `POST /api/users/:id/reset-password` - 重置密码

## 权限

模块定义了以下权限：

- `user:view` - 查看用户
- `user:create` - 创建用户
- `user:update` - 更新用户
- `user:delete` - 删除用户

## 数据库表

模块使用以下数据库表：

- `sys_users` - 用户信息表
- `sys_user_roles` - 用户角色关联表

## 前端路由

- `/user` - 用户管理页面

## 开发

### 后端开发

```typescript
import { userService } from './backend/service';

// 创建用户
const user = await userService.createUser({
  username: 'john',
  password: 'password123',
  email: 'john@example.com',
  role: 'user',
});

// 查询用户
const users = await userService.queryUsers({
  keyword: 'john',
  page: 1,
  pageSize: 10,
});
```

### 前端开发

```typescript
import { userApi } from './frontend/api';

// 获取用户列表
const result = await userApi.getList({
  keyword: 'john',
  page: 1,
  pageSize: 10,
});

// 创建用户
await userApi.create({
  username: 'john',
  password: 'password123',
  email: 'john@example.com',
});
```

## 测试

```bash
# 运行测试
npm test modules/user-management

# 运行特定测试
npm test modules/user-management/tests/service.test.ts
```

## 生命周期钩子

模块实现了完整的生命周期钩子：

- `beforeInstall` - 安装前
- `afterInstall` - 安装后
- `beforeEnable` - 启用前
- `afterEnable` - 启用后
- `beforeDisable` - 禁用前
- `afterDisable` - 禁用后
- `beforeUninstall` - 卸载前
- `afterUninstall` - 卸载后

## 依赖

- bcrypt - 密码加密
- uuid - ID 生成
- mysql2 - 数据库连接

## 版本历史

### 1.0.0 (2025-01-31)

- 初始版本
- 完整的用户 CRUD 功能
- 状态管理和密码管理
- 批量操作支持

## 许可证

MIT
