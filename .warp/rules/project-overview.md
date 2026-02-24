# DataMind 项目规则

## 项目概览
DataMind 是一个支持多数据源连接的自然语言数据查询平台，可独立部署或嵌入其他系统。

## 技术栈
- **后端**: Node.js + Express + TypeScript (tsx 运行)
- **前端**: Vue 3 + Vite + Ant Design Vue 4 + Pinia + Vue Router
- **数据库**: MySQL (mysql2)，支持 PostgreSQL (pg)
- **AI**: OpenAI 兼容 API（配置存储在数据库 sys_ai_configs 表）
- **图表**: ECharts 6 + AntV G2Plot
- **测试**: Vitest
- **构建**: TypeScript 5 (target ES2020, module commonjs)

## 项目结构
```
src/           → 核心后端代码（Express 路由、AI Agent、数据源、中间件等）
modules/       → 模块化业务功能（每个模块独立目录，包含 backend/frontend/module.json）
admin-ui/      → Vue 3 前端管理界面
mcp-servers/   → MCP 工具服务器
ocr-service/   → Python OCR 服务
scripts/       → 工具脚本
tests/         → 测试文件
migrations/    → 数据库迁移
```

## 核心开发命令
- `npm run dev` → 启动后端开发服务器 (tsx watch, port 3000)
- `cd admin-ui && npm run dev` → 启动前端开发服务器 (Vite, port 3001)
- `npm run build` → TypeScript 编译
- `npm run test` → 运行测试
- `npm run build:prod` → 生产构建（后端 + 前端）

## 重要约定
- 所有代码注释和 UI 文本使用**中文**
- 日志使用 `createLogger('ModuleName')` 创建（来自 `src/utils/logger.ts`），不要直接用 console.log
- 路径别名: `@/*` → `src/*`，`@modules/*` → `modules/*`
- API 路由统一以 `/api/` 为前缀
- 认证中间件: `authMiddleware`（JWT），管理员权限: `requireAdmin`
- 文件上传自动加密存储（fileEncryption 服务）
- 环境变量通过 `.env` 配置，敏感信息支持加密（`.env.encrypted`）
- 数据库连接池通过 `ConfigStore.pool` 获取
