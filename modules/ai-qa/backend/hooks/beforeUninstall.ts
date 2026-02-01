/**
 * 卸载前钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function beforeUninstall(context: ModuleContext): Promise<void> {
  console.log('[ai-qa] 准备卸载AI智能问答模块...');
  
  // 统计数据量
  const [categories] = await context.db.query('SELECT COUNT(*) as count FROM knowledge_categories');
  const [documents] = await context.db.query('SELECT COUNT(*) as count FROM knowledge_documents');
  const [chunks] = await context.db.query('SELECT COUNT(*) as count FROM knowledge_chunks');
  
  const categoryCount = (categories as any[])[0]?.count || 0;
  const documentCount = (documents as any[])[0]?.count || 0;
  const chunkCount = (chunks as any[])[0]?.count || 0;
  
  if (categoryCount > 0 || documentCount > 0 || chunkCount > 0) {
    console.warn('[ai-qa] 警告: 卸载将删除以下数据:');
    console.warn(`[ai-qa]   - ${categoryCount} 个知识库分类`);
    console.warn(`[ai-qa]   - ${documentCount} 个知识库文档`);
    console.warn(`[ai-qa]   - ${chunkCount} 个知识块`);
    console.warn('[ai-qa] 请确保已备份重要数据！');
  }
  
  console.log('[ai-qa] 卸载前检查完成');
}
