/**
 * 禁用后钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function afterDisable(context: ModuleContext): Promise<void> {
  console.log('[ai-config] 模块已禁用');
}
