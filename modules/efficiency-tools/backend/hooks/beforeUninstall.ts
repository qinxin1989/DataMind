/**
 * 卸载前钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function beforeUninstall(context: ModuleContext): Promise<void> {
  console.log('[EfficiencyTools] 准备卸载模块...');
  console.log('[EfficiencyTools] 警告: 卸载将删除所有用户模板数据');
}
