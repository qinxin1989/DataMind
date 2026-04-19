# Tasks — ai-agent-plus 集成到 DataMind

## Phase 1: 核心引擎
- [x] Phase 1c: `src/agent/errorReflection.ts` — 错误反思机制
- [x] Phase 1d: `src/agent/environmentObserver.ts` — 环境观测
- [x] Phase 1b: `src/agent/toolSchema.ts` — 统一工具 Schema
- [x] Phase 1a: `src/agent/agentLoop.ts` — 多轮工具执行循环（LLM → tool → LLM，SSE yield，连续错误计数）

## Phase 2: 声明式运行时
- [x] `src/agent/runtime/frontmatter.ts` — YAML frontmatter 解析
- [x] `src/agent/runtime/specs.ts` — ParamSpec, ActionSpec, SkillIndex 类型
- [x] `src/agent/runtime/declarativeRegistry.ts` — 扫描 SKILL.md 并注册
- [x] `src/agent/runtime/router.ts` — run_skill 路由分发
- [x] `src/agent/runtime/prompt.ts` — system prompt 构建
- [x] `src/agent/runtime/index.ts` — 统一导出

## Phase 3: 新增技能
- [x] Phase 3a: `src/agent/skills/file/index.ts` — readFile, writeFile, listDirectory, searchFiles, createDirectory, deletePath
- [x] Phase 3b: `src/agent/skills/shell/index.ts` — runCommand
- [x] Phase 3c: `src/agent/skills/web/index.ts` — fetchUrl, httpRequest, getCurrentTime
- [x] Phase 3d: `src/agent/skills/pdf/index.ts` — readPdf, mergePdf, splitPdf
- [x] Phase 3e: `src/agent/skills/docx/index.ts` — readWord, createWordDocument, generateWordReport
- [x] Phase 3f: `src/agent/skills/pptx/index.ts` — pptxInventory, pptxReplaceText, pptxRearrange
- [x] Phase 3g: `src/agent/skills/image_ocr/index.ts` — ocrImage
- [x] Phase 3h: `src/agent/skills/architecture_diagram/index.ts` — generateArchitectureDiagram
- [x] Phase 3i: `src/agent/skills/canvas_design/index.ts` + `doc_coauthoring/index.ts`
- [x] Phase 3j: SKILL.md 声明文件（所有技能）

## Phase 4: SSE API + 注册
- [x] `src/index.ts` 新增 `/api/agent/chat` SSE 端点
- [x] `src/agent/skills/index.ts` 注册新技能，扩展 SkillCategory

## Phase 5: 验证
- [x] 运行 `tsc` 编译验证通过（新增 agent 文件 0 错误；剩余 109 错误为项目已有代码）

---

# Plan B — Agent 能力集成到 AI 问答 + 超时修复

## Phase 1: 修复超时
- [x] 1a: 降低重试放大倍数 (maxRetries: OpenAI 2→1, callWithRetry 3→2)
- [x] 1b: 降低 OpenAI timeout (60s→45s)
- [x] 1c: 添加全局超时守卫 (answerWithContext Promise.race 120s)

## Phase 2: 新技能注入 planAction()
- [x] 2a: 扩展 planAction() 工具列表（10 个新技能加入 prompt）
- [x] 2b: planAction() switch 添加 16 个新技能路由分支
- [x] 2c: 补充 SkillContext 的 workDir 字段

## Phase 3: AI 问答 SSE 模式
- [x] 3a: ai-qa service 添加 askStream()（调用 runAgentLoop，支持会话历史 + schema 上下文）
- [x] 3b: ai-qa routes 添加 POST /stream SSE 端点

## Phase 4: 验证
- [x] 编译验证通过（新修改文件 0 错误）

---

# Plan C — 单助手工作台收口

## Phase 1: 隔离五模式残留
- [x] 1a: `src/index.ts` 中 `/api/agent/chat` 兼容入口改为单助手提示，不再按五种业务模式分流
- [x] 1b: `src/assistant/routes.ts` 限制产物文件访问根路径，避免兼容入口继续放大旧逻辑风险

## Phase 2: 工作台补齐参考交互
- [x] 2a: `admin-ui/src/views/ai/assistant.vue` 改回单助手工作台布局，保留会话侧栏 + 连续对话主区
- [x] 2b: 补齐消息对复制/删除、图片预览、状态反馈、加载更多、会话重命名/删除
- [x] 2c: 补齐拖拽/粘贴上传，附件继续走独立工作流

## Phase 3: 验证
- [x] 3a: 后端 `npm run build` 编译通过
- [x] 3b: 前端 `npm --prefix admin-ui run build` 编译通过
- [x] 3c: `npm start` 启动验证通过（服务成功监听 `http://localhost:3000`）
- [x] 3d: 浏览器级回归：登录后检查 `/ai/assistant` 与 `/ai/chat` 的真实交互链路

## Phase 4: 清理旧五模式兼容层
- [x] 4a: `modules/ai-qa/backend/service.ts` 改为本模块固定的数据问答画像，不再依赖 `src/assistant/router.ts`
- [x] 4b: `modules/ai-crawler-assistant/backend/service.ts` 改为本模块固定的采集画像，不再依赖 `src/assistant/router.ts`
- [x] 4c: 删除 `src/assistant/router.ts` / `src/assistant/profiles.ts` 旧五模式分流实现，避免后续误接
- [x] 4d: 删除 `tests/core/assistantRouter.test.ts` / `tests/core/assistantProfiles.test.ts` 旧分流测试，避免把已下线能力继续当作基线

## Phase 5: 菜单与模块化前端回归
- [x] 5a: 运行 `scripts/smoke-menu-routes.ts`，验证当前 34 条菜单路径全部可打开，无 404
- [x] 5b: 修复 `tests/core/menuRouteCoverage.test.ts`，让路由覆盖校验同时识别静态主路由与动态模块路由
- [x] 5c: 运行 `tests/core/menuSync.test.ts` 与 `tests/core/menuRouteCoverage.test.ts`，确认菜单同步和路由覆盖测试通过

---

# Plan D — 旧版数据问答接入分析类/报告类技能

## Phase 1: 旧链路技能路由补齐
- [x] 1a: `src/agent/index.ts` 扩展 `planAction()`，让旧问答可规划 `report.*` 与 `dataAnalysis.*` 技能
- [x] 1b: 兼容旧技能名 `data_analysis.executePython` 与新注册名 `dataAnalysis.executePython`

## Phase 2: 旧问答执行链打通
- [x] 2a: `answerWithContext()` 对识别出的 `skill` 直接执行，不再二次重规划丢失意图
- [x] 2b: 为 `report.summary / ppt / dashboard / excel / insight / compare` 补齐默认参数与结果文案
- [x] 2c: `answer()` 兼容新的分析/报告技能结果输出，避免直接回落成原始对象

## Phase 3: 验证
- [x] 3a: 运行 `npm run build`，确认 TypeScript 编译通过

---

# Plan E — 数据采集中心接入万表归一项目化流程

## Phase 1: 方案梳理
- [x] 1a: 梳理 `D:\project\JW` 中“万表归一”菜单、标准表和批量处理逻辑
- [x] 1b: 对齐 DataMind 现有数据采集中心菜单、动态模块路由与后端桥接方式

## Phase 2: 模块骨架与接入
- [x] 2a: 新建 `modules/universal-table/` 模块，声明菜单、权限、前后端入口
- [x] 2b: 将模块挂到数据采集中心，并补齐 `admin-ui/src/router/moduleRoutes.ts` 与 `src/index.ts` 路由桥接

## Phase 3: 后端采集链路
- [x] 3a: 实现标准表、分类、项目、项目文件入库与项目归属关系
- [x] 3b: 实现文件自动分类、按类生成样本、脱敏、测试数据与脚本模板接口
- [x] 3c: 实现 Python 采集脚本执行、表头比对与人工确认映射结果存储

## Phase 4: 前端工作台
- [x] 4a: 实现标准表管理页，支持批量导入表头与 AI 辅助建表
- [x] 4b: 实现项目化采集页，支持拖拽上传、分类、按类处理样本与脚本生成
- [x] 4c: 实现脚本运行结果与人工确认映射交互

## Phase 5: 验证
- [x] 5a: 新增模块级测试，覆盖表头匹配与脚本模板生成
- [x] 5b: 运行后端构建、模块测试与前端构建验证

## Phase 6: 采集结果数据库化
- [x] 6a: 采集脚本执行后自动将结构化结果写入项目级分析表
- [x] 6b: 为每个项目+标准表生成受限分析数据源，避免 Agent 误扫系统表
- [x] 6c: 前端展示分析数据集与数据源 ID，保留源文件格式下载
