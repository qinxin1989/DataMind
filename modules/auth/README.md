# 用户认证模块

## 模块概述

用户认证模块，提供登录、注册、密码管理和用户审核功能。

## 功能特性

### 1. 认证功能
- 用户登录/注册
- JWT Token 认证
- 密码修改
- 会话管理

### 2. 用户管理（管理员）
- 查看所有用户
- 审核待审用户
- 创建/更新/删除用户
- 用户状态管理

## 目录结构

```
auth/
├── module.json           # 模块配置
├── README.md             # 说明文档
├── backend/
│   ├── index.ts          # 模块入口
│   ├── routes.ts         # API 路由（旧）
│   ├── types.ts          # 类型定义
│   ├── authService.ts    # 认证服务
│   └── middleware.ts     # 认证中间件
└── frontend/
    └── views/            # Vue 组件
```

## API 接口

### 公开接口
| 方法 | 路径 | 描述 |
|-----|------|------|
| POST | /auth/login | 用户登录 |
| POST | /auth/register | 用户注册（待审核） |

### 需要认证
| 方法 | 路径 | 描述 |
|-----|------|------|
| GET | /auth/me | 获取当前用户信息 |
| POST | /auth/change-password | 修改密码 |

### 管理员接口
| 方法 | 路径 | 描述 |
|-----|------|------|
| GET | /auth/users | 获取所有用户 |
| GET | /auth/users/pending | 获取待审核用户 |
| POST | /auth/users | 创建用户 |
| POST | /auth/users/:id/approve | 审核通过 |
| POST | /auth/users/:id/reject | 拒绝注册 |
| PUT | /auth/users/:id | 更新用户 |
| DELETE | /auth/users/:id | 删除用户 |

## 使用示例

```typescript
import { initAuthModule } from './modules/auth/backend';

// 初始化模块
const authModule = initAuthModule({
  pool,
  jwtSecret: 'your-secret-key',
  jwtExpiresIn: '7d'
});

// 使用路由
app.use('/api/auth', authModule.routes);

// 在其他路由中使用认证中间件
app.use('/api/protected', authModule.authMiddleware, protectedRoutes);

// 管理员专用路由
app.use('/api/admin', authModule.authMiddleware, authModule.requireAdmin, adminRoutes);
```

## 用户状态

| 状态 | 说明 |
|------|------|
| pending | 待审核（新注册用户） |
| active | 已激活 |
| inactive | 已禁用 |
| rejected | 已拒绝 |

## 用户角色

| 角色 | 说明 |
|------|------|
| admin | 管理员 |
| user | 普通用户 |
| guest | 访客 |
