/**
 * 禁用前钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function beforeDisable(context: ModuleContext): Promise<void> {
  console.log('[OfficialDoc] 准备禁用模块...');
}
