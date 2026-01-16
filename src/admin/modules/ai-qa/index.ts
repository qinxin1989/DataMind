/**
 * AI Q&A 模块 - 将现有 AI 问答功能集成到管理框架
 * 
 * 功能：
 * - 数据源管理（MySQL、PostgreSQL、文件、API）
 * - 自然语言问答（NL2SQL）
 * - Schema 分析（AI 生成中文名和推荐问题）
 * - 会话管理
 * - Agent 技能和 MCP 工具
 * - 自动分析和大屏生成
 * - RAG 知识库
 */

export { aiQAService, AIQAService } from './aiQAService';
export { default as routes } from './routes';
