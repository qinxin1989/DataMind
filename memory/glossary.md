# Glossary

## Acronyms
| Term | Meaning | Context |
|------|---------|---------|
| SSE | Server-Sent Events | Agent 流式聊天推送协议 |
| MCP | Model Context Protocol | DataMind 内置工具协议 |
| OOXML | Office Open XML | PPTX/DOCX 底层格式 |

## Internal Terms
| Term | Meaning |
|------|---------|
| agentLoop | 多轮工具执行循环（LLM → tool → LLM → ...） |
| toolSchema | 统一工具适配层，将 SkillsRegistry + MCPRegistry 转为 OpenAI function-calling 格式 |
| errorReflection | 工具错误反思机制，自动分类 + 诊断提示 + LLM 自我修正 |
| environmentObserver | 环境观测注入（cwd/uploads/artifacts → system message） |
| DeclarativeSkillRegistry | 声明式技能注册，扫描 SKILL.md 文件自动注册 |
| run_skill | LLM 统一工具调用入口 { skill, action, args } |

## Project Codenames
| Codename | Project |
|----------|---------|
| ai-agent-plus | Python 版 Agent 源项目 |
| DataMind | TypeScript 目标项目 |
