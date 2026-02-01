/**
 * 安装前钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function beforeInstall(context: ModuleContext): Promise<void> {
  console.log('[EfficiencyTools] 准备安装模块...');
  
  // 检查依赖
  const requiredPackages = ['sql-formatter', 'xlsx'];
  console.log(`[EfficiencyTools] 检查依赖包: ${requiredPackages.join(', ')}`);
}
