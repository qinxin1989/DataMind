# 将 ai-agent-plus Agent 功能集成到 DataMind

## 背景
源项目 `ai-agent-plus` 是一个 Python Agent 系统，核心能力：
* **多轮工具执行循环**：LLM 输出 → 调用工具 → 结果回传 → 继续推理，直到完成
* **声明式技能系统**：通过 `SKILL.md`（YAML frontmatter）定义技能，运行时自动注册/路由
* **13 个技能**：file、excel、word/docx、pdf、pptx、web、shell、image_ocr、architecture_diagram、data_analysis、canvas-design、doc-coauthoring
* **会话管理**：多会话持久化、摘要、Artifacts 追踪
* **SSE 流式聊天 API**：带工具执行进度推送
* **错误反思机制**：工具失败自动分类 → 注入诊断提示 → LLM 自我修正
* **环境观测注入**：将 cwd、uploads、recent artifacts 作为 system message 注入
* **模式切换**：fast/plan 模式影响最大迭代数和输出风格

目标项目 `DataMind` 是 TypeScript/Node.js Express 平台，已有：
* `AIAgent` 类（以 SQL 生成为核心的问答，意图识别 → SQL → 结果解释）
* `SkillsRegistry`（data, document, media, report, qa, crawler 6 类共约 15 个技能）
* `MCPRegistry`（calculator, datetime, formatter, textFormatter, ppt 5 个内置 MCP 工具）

## 差异分析
**DataMind 已有的：** 数据查询/SQL 转换、技能注册中心、MCP 协议工具、数据分析/大屏/质量检测

**DataMind 缺失的（需从 ai-agent-plus 迁移）：**
1. 多轮工具执行循环（当前 DataMind 只调一次 LLM 就结束，不支持 LLM → tool → LLM 链）
2. 声明式 SKILL.md 动态注册系统
3. 通用文件操作技能（file: read/write/list/search/mkdir/delete）
4. Shell 命令执行技能
5. PDF 深度操作技能（merge/split/OCR/extract）
6. Word 深度操作技能（create/edit/redline/report/table/image）
7. PPTX OOXML 级编辑技能（inventory/replace/rearrange/unpack/pack）
8. 架构图生成技能
9. Canvas 设计技能
10. Doc 协作工作流技能
11. Web/HTTP 请求技能
12. Image OCR 技能
13. 工具错误反思机制
14. SSE 流式工具执行进度推送
15. 环境观测注入 & 模式切换

## 设计方案

### 1. Agent 核心 — 多轮工具执行循环
新建 `src/agent/agentLoop.ts`，实现 ai-agent-plus 的核心 Agent 循环：
* 接收用户消息 → 构建 messages（含 system prompt、history）
* 调用 LLM（使用 OpenAI tool_choice=auto）
* 若有 tool_calls → 执行 → 将结果追加到 messages → 再调 LLM
* 循环直到无 tool_calls 或达到 maxIterations
* 支持 SSE yield 每步进度（content/tool_start/tool_result/done/error）
* 集成连续工具失败计数器 + 错误反思注入

`AgentLoopConfig`：maxIterations, maxConsecutiveToolErrors, mode(fast/plan)

### 2. 统一工具 Schema 层
新建 `src/agent/toolSchema.ts`：
* 将 DataMind 已有的 `SkillsRegistry` 和 `MCPRegistry` 统一适配为 OpenAI function-calling tools 格式
* 实现 `run_skill` 单一入口 schema（与 ai-agent-plus 声明式模式一致），也支持直接工具 schema 模式
* 工具执行分发：skill name → SkillsRegistry.execute / MCPRegistry.callTool

### 3. 声明式 SKILL.md 注册系统
新建 `src/agent/runtime/` 目录，TypeScript 重写：
* `frontmatter.ts` — 解析 YAML frontmatter
* `specs.ts` — ParamSpec, ActionSpec, SkillIndex 类型
* `declarativeRegistry.ts` — 扫描 `skills/` 目录下的 SKILL.md 并注册
* `router.ts` — run_skill 路由：声明式技能 → 已有 SkillsRegistry/MCPRegistry 的适配
* `prompt.ts` — 构建含技能目录的 system prompt

### 4. 新增技能实现（TypeScript）
在 `src/agent/skills/` 下新增：
* `file/index.ts` — 文件操作：readFile, writeFile, listDirectory, searchFiles, createDirectory, deletePath
* `shell/index.ts` — 执行命令：runCommand（child_process.exec，带 timeout/安全限制）
* `web/index.ts` — HTTP 请求：fetchUrl, httpRequest, getCurrentTime（用 axios）
* `image_ocr/index.ts` — OCR：调用 ocr-service 或 tesseract
* `architecture_diagram/index.ts` — 架构图：基于 mermaid-cli 或 excalidraw JSON 生成
* `pdf/index.ts` — PDF 操作：readPdf（pdf-parse 已有依赖）, mergePdf, splitPdf
* `docx/index.ts` — Word 操作：createWordDocument, generateWordReport, readWord
* `pptx/index.ts` — PPTX OOXML 操作：inventory, replaceText, rearrange（扩展已有 pptGenerator）
* `canvas_design/index.ts` — Canvas 设计（需 puppeteer 或 canvas 库）
* `doc_coauthoring/index.ts` — 协作文档工作流（纯 prompt 引导型技能）

同时将 SKILL.md 文件复制/翻译到 `skills/` 目录，供声明式系统使用。

### 5. 错误反思 & 环境观测
新建 `src/agent/errorReflection.ts`：
* classifyToolError(result) → 分类（bad_arguments, missing_file, permission, timeout 等）
* buildToolErrorGuidance(toolName, args, result) → 生成中文诊断建议
* maybeAddReflexMessage(messages, ...) → 注入 system message 引导 LLM 自我修正

新建 `src/agent/environmentObserver.ts`：
* buildEnvironmentObservation() → 返回 cwd、uploads、recent artifacts 等信息
* injectEnvironmentObservation(messages) → 注入到 messages 中

### 6. SSE 流式聊天 API 升级
在 `src/index.ts` 新增 `/api/agent/chat` SSE 端点：
* 接收 { message, sessionId, files?, mode? }
* 调用 agentLoop，用 SSE 推送：progress/content/tool/done/error
* 保持现有 `/api/ask` 不变（兼容旧问答逻辑）

### 7. 技能注册统一入口
修改 `src/agent/skills/index.ts`，在 `registerAllSkills()` 中新增注册上述技能。
修改 `src/agent/skills/registry.ts`：扩展 SkillCategory 类型增加 'file' | 'shell' | 'web' | 'ocr' | 'diagram' | 'design'

## 实施顺序
- [x] Phase 1 — 核心引擎（agentLoop + toolSchema + errorReflection + environmentObserver）
- [x] Phase 2 — 声明式运行时（runtime/ 目录全部）
- [x] Phase 3 — 新增技能实现（file → shell → web → pdf → docx → pptx → ocr → architecture → canvas → doc-coauthoring）
- [x] Phase 4 — SSE API + 环境观测 + 模式切换
- [ ] Phase 5 — 编译验证
