# DataMind 项目规则

## Plan & Tasks 持久化
- 每次生成 plan 时，必须同步写入 `docs/plan.md` 文件
- 每次生成 tasks 时，必须同步写入 `docs/tasks.md` 文件
- **每完成一个 task，必须立即更新 `docs/tasks.md` 中对应项的 `[ ]` 为 `[x]`**
- 这是强制规则：不允许完成 task 后遗漏打勾，确保新会话能准确延续进度

## Agent 开发规范
- AI 问答的核心入口是 `src/agent/index.ts` 中的 `AIAgent.answerWithContext()`
- 新 Agent Loop 入口是 `src/agent/agentLoop.ts` 中的 `runAgentLoop()`
- 所有技能必须在 `src/agent/skills/index.ts` 的 `registerAllSkills()` 中注册
- 修改 AI 问答流程时，必须检查 `planAction()` 路由表是否需要同步更新
- `callWithRetry()` 的重试次数和 OpenAI timeout 需保持可控，避免重试叠加导致长时间等待
- 修改问答相关方法时，参考 `.agents/skills/datamind-qa-rules/SKILL.md` 中的质量规则
