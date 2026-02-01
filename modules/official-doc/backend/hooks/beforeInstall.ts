/**
 * 安装前钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function beforeInstall(context: ModuleContext): Promise<void> {
  console.log('[OfficialDoc] 准备安装模块...');
  console.log('[OfficialDoc] 检查依赖: ai-config (可选)');
}
