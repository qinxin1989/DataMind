/**
 * 启用后钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function afterEnable(context: ModuleContext): Promise<void> {
  console.log('[ai-config] 模块已启用');
  console.log('[ai-config] AI配置管理功能现已可用');
}
