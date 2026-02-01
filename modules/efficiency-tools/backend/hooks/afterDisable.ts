/**
 * 禁用后钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function afterDisable(context: ModuleContext): Promise<void> {
  console.log('[EfficiencyTools] 模块已禁用');
  console.log('[EfficiencyTools] 用户模板数据已保留');
}
