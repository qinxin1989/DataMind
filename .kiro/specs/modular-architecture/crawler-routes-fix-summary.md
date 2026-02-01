# 爬虫模块路由修复总结

## 修复日期
2026-02-01

## 问题描述
三个爬虫模块的路由配置不一致:
- `ai-crawler-assistant`: 使用 `/admin/ai` 前缀 ✅
- `crawler-template-config`: 路由路径包含 `/api/crawler/*` ❌
- `crawler-management`: 路由路径包含 `/skills/crawler/*` ❌
- 所有模块都设置为 `"enabled": false` ❌

## 修复方案
统一所有爬虫模块使用 `/admin/ai` 前缀,路由路径统一为 `/crawler/*` 格式。

## 修复内容

### 1. crawler-management 模块

#### 文件: `modules/crawler-management/backend/routes.ts`
- 更新所有路由路径从 `/skills/crawler/*` 改为 `/crawler/*`
- 更新 `/skills/execute` 改为 `/execute`
- 共修改 9 个路由

#### 文件: `modules/crawler-management/module.json`
- 添加 `backend.routes.prefix: "/admin/ai"`
- 更新 `routes.backend` 数组中的所有路径
- 设置 `"enabled": true`

### 2. crawler-template-config 模块

#### 文件: `modules/crawler-template-config/backend/routes.ts`
- 更新所有路由路径从 `/api/crawler/*` 改为 `/crawler/*`
- 共修改 10 个路由

#### 文件: `modules/crawler-template-config/module.json`
- 添加 `backend.routes.prefix: "/admin/ai"`
- 更新 `routes.backend` 数组中的所有路径
- 设置 `"enabled": true`

### 3. ai-crawler-assistant 模块

#### 文件: `modules/ai-crawler-assistant/module.json`
- 已有正确的 `backend.routes.prefix: "/admin/ai"` 配置
- 路由文件中已使用 `/crawler/*` 路径
- 设置 `"enabled": true`

## 最终路由配置

所有三个爬虫模块现在统一使用以下路由格式:

```
前缀: /admin/ai
路径: /crawler/*
完整路由: /admin/ai/crawler/*
```

### crawler-management 路由列表
```
GET    /admin/ai/crawler/templates
POST   /admin/ai/crawler/templates
DELETE /admin/ai/crawler/templates/:id
GET    /admin/ai/crawler/tasks
POST   /admin/ai/crawler/tasks/:id/toggle
GET    /admin/ai/crawler/results
GET    /admin/ai/crawler/results/:id
DELETE /admin/ai/crawler/results/:id
POST   /admin/ai/execute
```

### crawler-template-config 路由列表
```
GET    /admin/ai/crawler/templates
GET    /admin/ai/crawler/templates/:id
POST   /admin/ai/crawler/templates
PUT    /admin/ai/crawler/templates/:id
DELETE /admin/ai/crawler/templates/:id
POST   /admin/ai/crawler/templates/test
POST   /admin/ai/crawler/preview
POST   /admin/ai/crawler/validate-selector
POST   /admin/ai/crawler/ai-analyze
POST   /admin/ai/crawler/diagnose
```

### ai-crawler-assistant 路由列表
```
POST   /admin/ai/crawler/analyze
POST   /admin/ai/crawler/chat
POST   /admin/ai/crawler/preview
POST   /admin/ai/crawler/diagnose
POST   /admin/ai/crawler/test
GET    /admin/ai/crawler/proxy
POST   /admin/ai/crawler/template
POST   /admin/ai/crawler/validate-selector
GET    /admin/ai/crawler/templates
GET    /admin/ai/crawler/templates/:id
PUT    /admin/ai/crawler/templates/:id
DELETE /admin/ai/crawler/templates/:id
GET    /admin/ai/crawler-conversations-latest
GET    /admin/ai/crawler-conversations
GET    /admin/ai/crawler-conversations/:id
POST   /admin/ai/crawler-conversations
PUT    /admin/ai/crawler-conversations/:id
DELETE /admin/ai/crawler-conversations/:id
```

## 验证结果

运行 `node verify-crawler-routes.js` 验证结果:

✅ 所有模块已启用
✅ 统一使用 /admin/ai 前缀
✅ 路由路径格式正确
✅ 路由文件存在且可访问

## 路由注册机制

根据 `src/module-system/core/BackendRouteManager.ts` 和 `src/module-system/core/LifecycleManager.ts`:

1. 模块系统读取 `module.json` 中的 `backend.routes.prefix` 配置
2. 加载 `backend.routes.file` 指定的路由文件
3. 使用 `BackendRouteManager.registerRoutes(moduleName, router, prefix)` 注册路由
4. Express 应用使用 `app.use(prefix, router)` 挂载路由

最终效果: 路由文件中定义的 `/crawler/*` 路径会被挂载到 `/admin/ai` 前缀下,形成 `/admin/ai/crawler/*` 的完整路由。

## 注意事项

1. **路由冲突**: 三个模块都有 `/crawler/templates` 相关路由,但它们的功能可能不同,需要确保不会产生冲突
2. **前端调用**: 前端代码需要更新 API 调用路径,使用新的统一路由格式
3. **权限检查**: 确保所有路由都有正确的权限检查中间件
4. **模块启用**: 所有模块现在都设置为 `enabled: true`,系统启动时会自动加载

## 后续工作

1. 测试所有路由是否正常工作
2. 更新前端 API 调用代码
3. 检查是否有路由冲突
4. 更新相关文档和测试用例
