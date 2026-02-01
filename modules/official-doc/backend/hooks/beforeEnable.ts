/**
 * 启用前钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function beforeEnable(context: ModuleContext): Promise<void> {
  console.log('[OfficialDoc] 准备启用模块...');
}
