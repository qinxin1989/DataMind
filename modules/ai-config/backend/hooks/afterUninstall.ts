/**
 * 卸载后钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function afterUninstall(context: ModuleContext): Promise<void> {
  console.log('[ai-config] 模块已卸载');
  console.log('[ai-config] 注意：AI配置数据仍保留在数据库中');
}
