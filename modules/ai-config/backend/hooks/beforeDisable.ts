/**
 * 禁用前钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function beforeDisable(context: ModuleContext): Promise<void> {
  console.log('[ai-config] 准备禁用模块...');
  console.warn('[ai-config] 警告：禁用后AI服务将无法访问配置');
}
