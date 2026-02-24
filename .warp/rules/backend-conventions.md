# 后端开发规范

## API 路由规范
- 路由文件使用 Express Router，通过工厂函数创建: `createXxxRoutes(service)`
- 所有 API 路由以 `/api/` 为前缀
- 需认证的路由使用 `authMiddleware` 中间件
- 管理员接口额外使用 `requireAdmin` 中间件
- 错误响应格式: `{ error: '错误信息' }`
- 成功响应直接返回数据或 `{ message: '操作成功', ...data }`

## 服务层规范
- 业务逻辑封装在 Service 类中，不要写在路由处理函数里
- Service 构造函数可接收 `Pool` (mysql2 连接池) 参数
- 数据库操作使用 `pool.execute()` 或 `pool.query()`，参数化查询防 SQL 注入
- 所有异步操作使用 async/await

## 错误处理
- 路由层使用 try/catch 包裹，返回合适的 HTTP 状态码
- 400: 参数错误
- 401: 未认证
- 403: 无权限
- 404: 资源不存在
- 500: 服务器内部错误

## 日志规范
```typescript
import { createLogger } from '@/utils/logger';
const log = createLogger('ServiceName');
log.info('操作成功');
log.error('操作失败:', error);
log.debug('调试信息');
log.warn('警告信息');
```

## AI Agent 相关
- AI Agent 实例: `AIAgent` 类（`src/agent/`）
- Skills 注册: `skillsRegistry`（`src/agent/skills/`）
- MCP 工具: `mcpRegistry`（`src/agent/mcp/`）
- AI 配置从数据库动态获取，支持多配置自动故障转移
- 调用 AI 时使用 `aiAgent` 实例的方法

## 数据源管理
- 数据源通过 `dataSourceManager`（`modules/datasource-management/backend/manager`）管理
- 支持类型: MySQL, PostgreSQL, CSV/Excel 文件, API 接口
- 配置持久化在 `ConfigStore`（MySQL 数据库）

## TypeScript 规范
- 类型定义放在 `types.ts` 文件中
- 使用 `interface` 定义数据结构，`type` 定义联合类型
- 避免使用 `any`，必要时用 `unknown` 并做类型断言
- 导出类型: `export * from './types'`
