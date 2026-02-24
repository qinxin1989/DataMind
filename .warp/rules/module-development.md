# 模块开发规范

DataMind 使用自研的模块系统，所有业务功能以独立模块形式存放在 `modules/` 目录下。

## 模块目录结构
```
modules/<module-name>/
├── module.json              → 模块清单（必需）
├── README.md                → 模块说明
├── backend/
│   ├── index.ts             → 后端入口，导出初始化函数和服务
│   ├── routes.ts            → Express 路由定义
│   ├── service.ts           → 业务逻辑服务类
│   ├── types.ts             → TypeScript 类型定义
│   └── hooks/               → 生命周期钩子（可选）
│       ├── afterEnable.ts
│       ├── afterDisable.ts
│       ├── afterInstall.ts
│       ├── afterUninstall.ts
│       ├── beforeEnable.ts
│       ├── beforeDisable.ts
│       ├── beforeInstall.ts
│       └── beforeUninstall.ts
├── frontend/
│   ├── index.ts             → 前端入口，导出 routes 数组
│   ├── api/index.ts          → API 调用封装
│   └── views/*.vue          → Vue 3 页面组件
└── config/                  → 模块配置（可选）
    ├── default.json
    └── schema.json
```

## module.json 规范
必须包含以下字段：
- `name`: 模块唯一标识（英文，kebab-case）
- `displayName`: 中文显示名
- `version`: 语义化版本号
- `description`: 模块描述
- `type`: `"system"` 或 `"business"`
- `category`: 分类标签
- `backend.entry`: 后端入口文件路径
- `backend.routes.prefix`: API 路由前缀
- `menus`: 菜单配置数组
- `permissions`: 权限声明数组
- `enabled` / `installed`: 状态标记

## 后端模块入口规范
```typescript
// modules/<name>/backend/index.ts
export function initXxxModule(options?: { pool: Pool }) {
  const service = new XxxService();
  const routes = createXxxRoutes(service);
  return { service, routes, name: '<name>', version: '1.0.0' };
}
```

## 前端模块入口规范
```typescript
// modules/<name>/frontend/index.ts
import XxxView from './views/Xxx.vue';
export default {
  routes: [
    {
      path: '/system/<name>',
      name: 'XxxView',
      component: XxxView,
      meta: { title: '中文标题', permission: '<name>:view' },
    },
  ],
};
```

## 模块注册
模块会被 `ModuleScanner` 自动扫描并通过 `LifecycleManager` 按依赖顺序启用。路由桥接在 `src/index.ts` 中通过懒加载 `import()` 动态注册。

## 现有模块列表
ai-config, ai-crawler-assistant, ai-qa, ai-stats, approval, audit-log, auth, crawler-management, crawler-template-config, dashboard, datasource-management, efficiency-tools, file-tools, menu-management, monitoring, notification, ocr-service, official-doc, rag-service, role-management, skills-service, system-backup, system-config, user-management
