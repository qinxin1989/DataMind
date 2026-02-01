# 角色管理模块

## 概述

角色管理模块提供完整的角色权限管理功能，包括角色的创建、编辑、删除、权限配置和菜单分配等。

## 功能特性

- ✅ 角色 CRUD 操作
- ✅ 角色列表查询和分页
- ✅ 关键词搜索（名称、编码、描述）
- ✅ 状态筛选（启用/禁用）
- ✅ 批量删除
- ✅ 权限配置
- ✅ 菜单分配
- ✅ 用户角色关联
- ✅ 系统角色保护
- ✅ 权限继承（可选）

## 依赖关系

本模块依赖以下模块：

- `user-management`: 用户管理模块（用于用户角色关联）

## 数据库表

- `sys_roles`: 角色表
- `sys_role_permissions`: 角色权限关联表
- `sys_role_menus`: 角色菜单关联表
- `sys_user_roles`: 用户角色关联表

## API 端点

### 角色管理

- `GET /api/admin/roles` - 获取角色列表（支持分页和搜索）
- `GET /api/admin/roles/:id` - 获取角色详情
- `POST /api/admin/roles` - 创建角色
- `PUT /api/admin/roles/:id` - 更新角色
- `DELETE /api/admin/roles/:id` - 删除角色
- `POST /api/admin/roles/batch/delete` - 批量删除角色

### 权限管理

- `GET /api/admin/roles/permissions/all` - 获取所有权限列表

## 权限定义

- `role:view` - 查看角色
- `role:create` - 创建角色
- `role:update` - 更新角色
- `role:delete` - 删除角色

## 使用示例

### 后端使用

```typescript
import { roleService } from '@/modules/role-management/backend';

// 创建角色
const role = await roleService.createRole({
  name: '编辑员',
  code: 'editor',
  description: '内容编辑人员',
  permissionCodes: ['content:view', 'content:create', 'content:update'],
  status: 'active',
});

// 查询角色
const result = await roleService.queryRoles({
  keyword: '编辑',
  status: 'active',
  page: 1,
  pageSize: 10,
});

// 分配角色给用户
await roleService.assignRolesToUser('user-id', ['role-id-1', 'role-id-2']);
```

### 前端使用

```typescript
import { roleApi } from '@/modules/role-management/frontend/api';

// 获取角色列表
const response = await roleApi.query({
  keyword: '管理员',
  page: 1,
  pageSize: 10,
});

// 创建角色
await roleApi.create({
  name: '审核员',
  code: 'reviewer',
  description: '内容审核人员',
  permissionCodes: ['content:view', 'content:approve'],
});

// 更新角色权限
await roleApi.update('role-id', {
  permissionCodes: ['content:view', 'content:create'],
  menuIds: ['menu-1', 'menu-2'],
});
```

## 配置说明

### 分页配置

```json
{
  "pagination": {
    "defaultPageSize": 10,
    "pageSizeOptions": [10, 20, 50, 100]
  }
}
```

### 权限配置

```json
{
  "permissions": {
    "enableInheritance": true,
    "maxDepth": 3
  }
}
```

### 验证配置

```json
{
  "validation": {
    "codePattern": "^[a-z][a-z0-9_]*$",
    "nameMinLength": 2,
    "nameMaxLength": 50
  }
}
```

## 生命周期钩子

- `beforeInstall`: 安装前检查依赖
- `afterInstall`: 安装后初始化默认角色
- `beforeUninstall`: 卸载前检查使用情况
- `afterUninstall`: 卸载后清理
- `beforeEnable`: 启用前准备
- `afterEnable`: 启用后通知
- `beforeDisable`: 禁用前检查
- `afterDisable`: 禁用后清理

## 注意事项

1. **系统角色保护**: 系统内置角色（`isSystem=true`）不能删除或禁用
2. **使用检查**: 删除角色前会检查是否有用户正在使用
3. **权限继承**: 如果启用权限继承，子角色会继承父角色的权限
4. **编码唯一性**: 角色编码必须唯一，且只能包含小写字母、数字和下划线
5. **依赖关系**: 必须先安装 `user-management` 模块

## 开发指南

### 添加新权限

1. 在 `routes.ts` 的 `/permissions/all` 端点添加新权限代码
2. 在前端 `RoleList.vue` 的 `permissionTree` 中添加权限树节点
3. 更新相关文档

### 扩展角色功能

1. 在 `types.ts` 中定义新的类型
2. 在 `service.ts` 中实现业务逻辑
3. 在 `routes.ts` 中添加 API 端点
4. 在前端添加相应的 UI 和 API 调用

## 测试

运行测试：

```bash
npx vitest run tests/modules/role-management/service.test.ts
```

## 版本历史

- v1.0.0 (2025-01-31)
  - 初始版本
  - 完整的角色 CRUD 功能
  - 权限和菜单配置
  - 用户角色关联

## 许可证

MIT
