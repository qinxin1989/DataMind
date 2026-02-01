/**
 * 禁用后钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function afterDisable(context: ModuleContext): Promise<void> {
  console.log('[file-tools] 执行禁用后操作...');

  // 可以在这里添加禁用后的清理逻辑
  // 例如：停止定时清理任务

  console.log('[file-tools] 模块已禁用');
}
