# 菜单管理模块

## 概述

菜单管理模块提供系统菜单的完整管理功能,支持树形结构、拖拽排序、权限控制等特性。

## 功能特性

- ✅ 菜单CRUD操作
- ✅ 树形结构展示
- ✅ 拖拽排序
- ✅ 可见性控制
- ✅ 权限代码绑定
- ✅ 支持内部路由、外部链接、iframe嵌入
- ✅ 系统菜单保护
- ✅ 批量操作

## 技术栈

- **后端**: TypeScript + Express + MySQL
- **前端**: Vue 3 + Ant Design Vue + TypeScript

## 目录结构

```
menu-management/
├── module.json           # 模块清单
├── README.md            # 模块文档
├── backend/             # 后端代码
│   ├── index.ts        # 后端入口
│   ├── types.ts        # 类型定义
│   ├── service.ts      # 业务逻辑
│   ├── routes.ts       # API路由
│   ├── hooks/          # 生命周期钩子
│   └── migrations/     # 数据库迁移
├── frontend/           # 前端代码
│   ├── index.ts       # 前端入口
│   ├── routes.ts      # 路由配置
│   ├── api/           # API封装
│   └── views/         # 页面组件
└── config/            # 配置文件
    ├── default.json   # 默认配置
    └── schema.json    # 配置schema
```

## API接口

### 菜单查询

- `GET /api/menus` - 获取所有菜单
- `GET /api/menus/tree` - 获取菜单树
- `GET /api/menus/user/:userId` - 获取用户菜单树
- `GET /api/menus/:id` - 获取菜单详情

### 菜单操作

- `POST /api/menus` - 创建菜单
- `PUT /api/menus/:id` - 更新菜单
- `DELETE /api/menus/:id` - 删除菜单
- `POST /api/menus/batch/delete` - 批量删除菜单

### 其他操作

- `PUT /api/menus/:id/visibility` - 切换菜单可见性
- `POST /api/menus/sort` - 更新菜单排序

## 数据模型

### Menu

```typescript
interface Menu {
  id: string;                    // 菜单ID
  title: string;                 // 菜单标题
  path?: string;                 // 路由路径
  icon?: string;                 // 图标
  parentId?: string;             // 父菜单ID
  sortOrder: number;             // 排序
  visible: boolean;              // 是否可见
  permissionCode?: string;       // 权限代码
  isSystem: boolean;             // 是否系统菜单
  menuType: 'internal' | 'external' | 'iframe';  // 菜单类型
  externalUrl?: string;          // 外部链接
  openMode: 'current' | 'blank' | 'iframe';      // 打开方式
  moduleCode?: string;           // 模块代码
  createdAt: number;             // 创建时间
  updatedAt: number;             // 更新时间
  children?: Menu[];             // 子菜单
}
```

## 配置说明

### 配置项

- `maxMenuDepth`: 最大菜单层级深度 (默认: 3)
- `defaultVisible`: 新建菜单默认是否可见 (默认: true)
- `enableDragSort`: 是否启用拖拽排序 (默认: true)
- `cacheMenuTree`: 是否缓存菜单树 (默认: true)
- `cacheTTL`: 缓存过期时间(秒) (默认: 300)

### 配置示例

```json
{
  "maxMenuDepth": 3,
  "defaultVisible": true,
  "enableDragSort": true,
  "cacheMenuTree": true,
  "cacheTTL": 300
}
```

## 权限要求

- `menu:view` - 查看菜单
- `menu:create` - 创建菜单
- `menu:update` - 更新菜单
- `menu:delete` - 删除菜单

## 依赖模块

- `role-management` - 角色管理模块(用于权限控制)

## 使用示例

### 后端使用

```typescript
import { menuService } from '@modules/menu-management';

// 获取菜单树
const menuTree = await menuService.getMenuTree();

// 创建菜单
const menu = await menuService.createMenu({
  title: '系统管理',
  path: '/system',
  icon: 'SettingOutlined',
  order: 100,
});

// 更新菜单
await menuService.updateMenu(menu.id, {
  title: '系统设置',
});

// 删除菜单
await menuService.deleteMenu(menu.id);
```

### 前端使用

```typescript
import { menuApi } from '@modules/menu-management';

// 获取菜单树
const res = await menuApi.getTree();
if (res.success) {
  console.log(res.data);
}

// 创建菜单
await menuApi.create({
  title: '用户管理',
  path: '/users',
  icon: 'UserOutlined',
});
```

## 开发指南

### 添加新功能

1. 在 `backend/service.ts` 中添加业务逻辑
2. 在 `backend/routes.ts` 中添加API路由
3. 在 `frontend/api/index.ts` 中添加API封装
4. 在前端组件中使用新功能

### 测试

```bash
# 运行测试
npx vitest run tests/modules/menu-management/service.test.ts
```

## 注意事项

1. 系统菜单不能删除
2. 删除父菜单会同时删除所有子菜单
3. 菜单排序值越小越靠前
4. 建议菜单层级不超过3层

## 更新日志

### v1.0.0 (2024-01-31)

- ✅ 初始版本发布
- ✅ 实现基础CRUD功能
- ✅ 支持树形结构
- ✅ 支持权限控制
- ✅ 支持多种菜单类型

## 许可证

MIT
