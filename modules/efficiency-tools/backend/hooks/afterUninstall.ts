/**
 * 卸载后钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function afterUninstall(context: ModuleContext): Promise<void> {
  const { db } = context;
  
  console.log('[EfficiencyTools] 清理模块数据...');
  
  // 删除模板表
  await db.run('DROP TABLE IF EXISTS efficiency_templates');
  
  console.log('[EfficiencyTools] 模块已完全卸载');
}
