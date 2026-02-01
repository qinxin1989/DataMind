/**
 * 启用后钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function afterEnable(context: ModuleContext): Promise<void> {
  console.log('[EfficiencyTools] 模块已启用');
  console.log('[EfficiencyTools] 效率工具箱现已可用');
}
