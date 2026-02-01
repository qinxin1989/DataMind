/**
 * 启用后钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function afterEnable(context: ModuleContext): Promise<void> {
  console.log('[file-tools] 执行启用后操作...');

  // 可以在这里添加启用后的初始化逻辑
  // 例如：启动定时清理任务

  console.log('[file-tools] 模块已启用，文件工具功能现已可用');
}
