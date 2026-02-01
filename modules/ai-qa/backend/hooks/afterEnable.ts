/**
 * 启用后钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function afterEnable(context: ModuleContext): Promise<void> {
  console.log('[ai-qa] AI智能问答模块已启用');
  console.log('[ai-qa] 功能包括:');
  console.log('[ai-qa]   - 自然语言问答 (NL to SQL)');
  console.log('[ai-qa]   - 数据源管理');
  console.log('[ai-qa]   - Schema 分析');
  console.log('[ai-qa]   - 会话管理');
  console.log('[ai-qa]   - Agent 技能和工具');
  console.log('[ai-qa]   - 自动分析和大屏生成');
  console.log('[ai-qa]   - RAG 知识库');
  console.log('[ai-qa]   - 知识图谱');
  console.log('[ai-qa]   - 文章生成');
}
