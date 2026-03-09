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
