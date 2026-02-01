/**
 * 禁用前钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function beforeDisable(context: ModuleContext): Promise<void> {
  console.log('[ai-qa] 准备禁用AI智能问答模块...');
  
  // 检查是否有活跃的会话
  const [rows] = await context.db.query(
    "SELECT COUNT(*) as count FROM chat_sessions WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)"
  );
  
  const count = (rows as any[])[0]?.count || 0;
  if (count > 0) {
    console.warn(`[ai-qa] 警告: 当前有 ${count} 个活跃会话，禁用后这些会话将无法继续`);
  }
  
  console.log('[ai-qa] 禁用前检查完成');
}
