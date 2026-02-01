/**
 * 卸载前钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function beforeUninstall(context: ModuleContext): Promise<void> {
  console.log('[ai-config] 准备卸载模块...');
  
  // 检查是否有AI配置数据
  const [rows] = await context.db.query(
    'SELECT COUNT(*) as count FROM sys_ai_configs'
  );
  
  const count = (rows as any[])[0].count;
  if (count > 0) {
    console.warn(`[ai-config] 警告：存在 ${count} 条AI配置数据，卸载后将无法访问`);
  }
}
