/**
 * 卸载后钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function afterUninstall(context: ModuleContext): Promise<void> {
  console.log('[ai-qa] 清理AI智能问答模块数据...');
  
  try {
    // 删除数据库表
    await context.db.execute('DROP TABLE IF EXISTS knowledge_chunks');
    await context.db.execute('DROP TABLE IF EXISTS knowledge_documents');
    await context.db.execute('DROP TABLE IF EXISTS knowledge_categories');
    
    console.log('[ai-qa] 数据库表已删除');
  } catch (error: any) {
    console.warn('[ai-qa] 清理数据库表时出错:', error.message);
  }
  
  console.log('[ai-qa] AI智能问答模块已完全卸载');
}
