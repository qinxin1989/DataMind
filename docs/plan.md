# DataMind 实施计划

---

## Plan A：ai-agent-plus 功能迁移（已完成）

### 背景
源项目 `ai-agent-plus` 是一个 Python Agent 系统，核心能力：多轮工具执行循环、声明式技能系统、13 个技能、SSE 流式聊天 API、错误反思机制、环境观测注入、模式切换。

### 实施状态
- [x] Phase 1 — 核心引擎（agentLoop + toolSchema + errorReflection + environmentObserver）
- [x] Phase 2 — 声明式运行时（runtime/ 目录全部）
- [x] Phase 3 — 新增技能实现（file/shell/web/pdf/docx/pptx/ocr/architecture/canvas/doc-coauthoring/data_analysis）
- [x] Phase 4 — SSE API 端点 `/api/agent/chat` + 技能注册
- [x] Phase 5 — 编译验证（新增 agent 文件 0 错误）

---

## Plan B：Agent 能力集成到 AI 问答 + 超时修复

### 问题
1. **超时**：`answerWithContext()` 无全局超时，重试叠加（OpenAI maxRetries=2 × callWithRetry maxRetries=3 × 60s timeout）可达 540s/阶段，多阶段累计超 10 分钟
2. **新技能未对接**：从 ai-agent-plus 迁移的 11 类新技能已注册到 `skillsRegistry`，但 `planAction()` 意图路由表不包含这些技能，LLM 无法选择
3. **新 Agent Loop 未使用**：`/api/agent/chat` SSE 端点已就绪但前端未调用

### Phase 1：修复超时（src/agent/index.ts）

#### 1a. 降低重试放大倍数
- `initWithConfig()` (line 306)：`maxRetries: 2` → `maxRetries: 1`
- `callWithRetry()` (line 401)：`maxRetries: number = 3` → 默认 `2`
- 效果：单阶段最坏从 540s 降到 180s

#### 1b. 降低 OpenAI timeout
- `initWithConfig()` (line 306)：`timeout: 60000` → `timeout: 45000`（45s 足够绝大多数 LLM 调用）

#### 1c. 添加全局超时守卫
- 在 `answerWithContext()` 顶部包裹 `Promise.race`，整个方法硬超时 120s（2 分钟）
- 超时返回友好错误消息而非让用户等 10 分钟

### Phase 2：新技能注入 planAction() 路由表

#### 2a. 扩展 planAction() 的工具列表
`planAction()` (line 594-750) 的 system prompt 目前只列了 7 个工具。追加：
- `file.readFile` / `file.writeFile` / `file.searchFiles` — 文件操作
- `web.fetchUrl` / `web.httpRequest` — 网络请求
- `pdf.readPdf` / `pdf.mergePdf` — PDF 处理
- `docx.readWord` / `docx.createWordDocument` — Word 处理
- `pptx.pptxInventory` / `pptx.pptxReplaceText` — PPT 处理
- `image_ocr.ocrImage` — 图片文字识别
- `shell.runCommand` — 执行命令
- `data_analysis.executePython` — Python 数据分析

#### 2b. 在 planAction() switch 中添加路由分支
当 AI 选择新技能时返回对应 `ToolCall`，让 skill 执行路径走通（skillsRegistry 已注册）。

#### 2c. 补充 skill 执行路径的 context
`answer()` line 1420 创建 `SkillContext` 时缺少 `workDir` 和 `userId`，新技能需要。

### Phase 3：AI 问答 SSE 模式（可选增强）

#### 3a. ai-qa service 添加 askStream()
新增 `askStream()` 方法，内部调用 `runAgentLoop()`，通过回调输出 SSE 事件。

#### 3b. ai-qa routes 添加 SSE 端点
新增 `POST /api/ask/stream` 路由，前端可选择获得实时进度反馈。

### 修改文件清单
- `src/agent/index.ts` — Phase 1 (超时修复) + Phase 2 (planAction 扩展)
- `modules/ai-qa/backend/service.ts` — Phase 3 (askStream)
- `modules/ai-qa/backend/routes.ts` — Phase 3 (SSE 路由)

---

## Plan C：单助手工作台收口（进行中）

### 背景
上一轮把多个问答入口硬合并成了“五种业务模式卡片”，导致参考项目的单助手工作台没有完整复刻，同时旧版数据问答入口也被感知为被覆盖。当前目标是把 `/ai/assistant` 收回到单一助手工作流，把 `/ai/chat` 继续保留为独立的数据问答页。

### 已完成
- [x] `/api/assistant/*` 维持独立会话、附件、流式输出和摘要链路，不再侵入旧 `/api/chat`
- [x] `/api/agent/chat` 兼容入口改为单助手提示，不再依赖五模式路由决策
- [x] `admin-ui/src/views/ai/assistant.vue` 重做为单助手工作台，补齐会话管理、消息对删除、图片预览、拖拽/粘贴上传、状态反馈
- [x] 前后端编译通过，`npm start` 启动验证通过
- [x] 浏览器级回归通过：登录后验证 `/ai/assistant` 会话、上传、发送、删除消息对，以及 `/ai/chat` 页面加载
- [x] `ai-qa` / `ai-crawler-assistant` 改为模块内固定画像，移除对 `src/assistant/router.ts` 的依赖
- [x] 删除 `src/assistant/router.ts` 和 `src/assistant/profiles.ts`，彻底撤掉旧“五模式”分流入口
- [x] 删除 `tests/core/assistantRouter.test.ts` 和 `tests/core/assistantProfiles.test.ts`，避免旧分流测试继续绑住当前架构
- [x] 菜单烟测通过：`scripts/smoke-menu-routes.ts` 验证当前 34 条菜单路径全部可打开，无 404
- [x] `tests/core/menuRouteCoverage.test.ts` 已补齐动态模块路由识别，和当前模块化前端一致
- [x] `tests/core/menuSync.test.ts` 与 `tests/core/menuRouteCoverage.test.ts` 回归通过

---

## Plan D：旧版数据问答接入分析类 / 报告类技能（已完成）

### 背景
统一助手中的分析类与报告类技能已经注册完成，但旧版数据问答的生产链路仍以 `service.ask() -> aiAgent.answerWithContext()` 为主。此前旧链路存在两个断点：

1. `planAction()` 只暴露了少量旧工具，无法稳定选择新的 `report.*` / `dataAnalysis.*`
2. `answerWithContext()` 识别到 `skill` 后会再次委托 `answer()` 重规划，导致已经识别出的技能意图被冲掉，特别是 `data_analysis.executePython` 与 `dataAnalysis.executePython` 命名不一致时会直接掉回 SQL

### 实施内容
- 扩展 `src/agent/index.ts` 的 `planAction()` 工具列表与 JSON 输出约束，允许旧问答规划：
  - `report.summary`
  - `report.ppt`
  - `report.dashboard`
  - `report.excel`
  - `report.insight`
  - `report.compare`
  - `report.comprehensive`
  - `dataAnalysis.executePython`
  - `dataAnalysis.statisticalAnalysis`
  - `dataAnalysis.createVisualization`
  - `dataAnalysis.pythonEval`
- 增加技能名兼容，将旧别名 `data_analysis.*` 统一映射到当前注册名 `dataAnalysis.*`
- 修改 `answerWithContext()`：当 `planAction()` 已经返回 `skill` 时，直接执行该 skill，不再重新走一遍旧规划链
- 为报告类技能补齐默认参数与结果文案，避免旧问答只返回“执行成功”或原始对象
- 同步增强 `answer()` 的 skill 分支，让非 `answerWithContext()` 调用方也能识别新技能名并输出更自然的结果

### 验证
- `npm run build` 编译通过
