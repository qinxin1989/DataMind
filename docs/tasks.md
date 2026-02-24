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
