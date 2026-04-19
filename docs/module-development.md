# 模块化开发约定

## 目标

DataMind 后续新增功能统一按模块开发，保证：

- 职责清晰：业务逻辑、菜单、权限、配置都跟模块绑定。
- 易扩展：新增功能不需要改动大量核心代码。
- 易测试：模块实现、兼容层、核心框架、平台能力分层验证。

## 目录边界

### 业务模块

- 路径：`modules/<module-name>/`
- 负责：模块清单、后端服务、路由、前端页面、配置、迁移、生命周期钩子

### 测试

- `tests/modules/<module-name>/`: 模块实现测试
- `tests/compat/`: 兼容层测试
- `tests/core/`: 核心框架测试
- `tests/module-system/`、`tests/security/`: 平台层测试
- `tests/admin/`: 尚未完成下沉的场景型遗留测试

### Admin 层

- `src/admin/` 只保留基础设施和兼容层
- `src/admin/modules/*` 不再承载新的真实业务逻辑

## 新模块开发流程

### 1. 创建模块骨架

```bash
npm run module:create -- data-quality-center --display-name 数据质量中心 --type business
```

脚手架会自动生成：

- `modules/data-quality-center/`
- `tests/modules/data-quality-center/service.test.ts`
- `module.json`
- `backend/`、`frontend/`、`config/`、`migrations/`、`hooks/`

### 2. 完善模块清单

重点维护 `modules/<module-name>/module.json`：

- `menus`
- `permissions`
- `config`
- `api.endpoints`
- `database.tables`

前端声明补充约定：

- 已真正收敛到 `modules/<name>/frontend/*` 的模块，`frontend.integration` 使用 `module`
- 仍由 `admin-ui` 静态路由承载的过渡模块，`frontend.integration` 使用 `admin-ui`
- `frontend.entry`、`frontend.routes`、`frontend.components` 里声明的文件必须真实存在，`npm run module:validate -- <name>` 会校验这些路径

### 3. 编写业务代码

优先在模块内保持清晰分层：

- `backend/service.ts`: 业务逻辑
- `backend/routes.ts`: HTTP 接口和权限校验
- `backend/types.ts`: 模块类型定义
- `frontend/`: 模块前端入口、路由、API、页面

### 4. 编写测试

至少补齐：

- 服务层核心行为测试
- 权限/菜单相关测试
- 模块特有的数据边界测试

## 常用命令

```bash
npm run module:create -- <name>
npm run module:validate -- <name>
npm run module:test -- <name>
npm run module:build -- <name>
npm run test:menu-smoke
npm run test:menu-smoke:auto
npm run test:business-smoke
npm run test:business-smoke:auto
```

## 前端验收建议

- 菜单、路由、权限结构调整后，至少执行一次 `npm run test:menu-smoke`
- 本地未手动启动前后端时，直接执行 `npm run test:menu-smoke:auto`
- 涉及统一助手、知识中心、采集助手等前端模块入口时，再补一次 `npm run test:business-smoke`
- 如果本地没起服务，直接执行 `npm run test:business-smoke:auto`
- 冒烟报告和失败截图统一输出到 `.codex-logs/`

## 迁移原则

- 旧的 admin 服务如果只是转发，优先删除并把测试下沉到模块层。
- 旧的 admin 服务如果承担兼容职责，保留薄适配层，但禁止继续堆业务逻辑。
- 新增接口、菜单、权限，优先从模块清单和模块实现出发，不要从 `src/admin/modules/*` 倒推。
