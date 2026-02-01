/**
 * 启用前钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function beforeEnable(context: ModuleContext): Promise<void> {
  console.log('[ai-qa] 准备启用AI智能问答模块...');
  
  // 检查AI配置是否存在
  const [rows] = await context.db.query(
    "SELECT COUNT(*) as count FROM sys_ai_configs WHERE status = 'active'"
  );
  
  const count = (rows as any[])[0].count;
  if (count === 0) {
    console.warn('[ai-qa] 警告: 未找到激活的AI配置，请先配置AI服务');
  }
  
  console.log('[ai-qa] 启用前检查通过');
}
