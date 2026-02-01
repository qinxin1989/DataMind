/**
 * 禁用后钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function afterDisable(context: ModuleContext): Promise<void> {
  console.log('[ai-qa] AI智能问答模块已禁用');
  console.log('[ai-qa] 所有AI问答功能已停止');
  console.log('[ai-qa] 数据已保留，重新启用后可继续使用');
}
