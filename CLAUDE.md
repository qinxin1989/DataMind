# Memory

## Preferences
- **语言**：始终使用中文与用户交流（代码注释也用中文）
- 代码风格遵循项目现有 TypeScript 惯例

## 记忆管理规则
- **新对话启动时**：优先读取 `CLAUDE.md` 和 `memory/session.md`，快速了解项目背景和未完成任务，避免重复提问
- **对话结束/中断前**：将当前对话的关键内容（任务进展、待办事项、决策要点）总结写入 `memory/session.md`
- **减少 token 消耗**：记忆文件保持精简，只记录关键上下文，避免冗长描述
- **任务跟踪**：`memory/session.md` 中维护「待办任务」和「已完成任务」列表，确保跨对话连续性
- **记忆更新时机**：每次任务有重大进展或完成时更新，不必每轮对话都写入

## Projects
| Name | What |
|------|------|
| **DataMind** | TypeScript/Node.js 数据智能平台，正在从 ai-agent-plus（Python）迁移 Agent 能力 |

## Terms
| Term | Meaning |
|------|---------|
| ai-agent-plus | Python 版源项目，提供多轮工具执行循环 + 声明式技能系统 |
| agentLoop | 多轮工具执行循环核心（src/agent/agentLoop.ts） |
| SKILL.md | 声明式技能描述文件（YAML frontmatter + Markdown body） |
→ Full glossary: memory/glossary.md
→ Session memory: memory/session.md
