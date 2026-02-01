/**
 * 安装后钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function afterInstall(context: ModuleContext): Promise<void> {
  console.log('[ai-config] 模块安装完成');
  console.log('[ai-config] 已注册 8 个 API 端点');
  console.log('[ai-config] 已注册 2 个权限：ai:view, ai:config');
}
