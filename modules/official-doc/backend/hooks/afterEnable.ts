/**
 * 启用后钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function afterEnable(context: ModuleContext): Promise<void> {
  console.log('[OfficialDoc] 模块已启用');
  console.log('[OfficialDoc] 公文写作助手现已可用');
}
