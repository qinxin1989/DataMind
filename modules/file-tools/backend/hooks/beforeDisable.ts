/**
 * 禁用前钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function beforeDisable(context: ModuleContext): Promise<void> {
  console.log('[file-tools] 执行禁用前检查...');

  // 检查是否有正在进行的转换任务
  const { db } = context;
  try {
    const result = await db.get(
      "SELECT COUNT(*) as count FROM file_conversion_history WHERE status = 'processing'"
    );
    
    if (result && result.count > 0) {
      console.warn(`[file-tools] 警告: 有 ${result.count} 个转换任务正在进行中`);
      // 可以选择是否阻止禁用
      // throw new Error('有转换任务正在进行中，请稍后再试');
    }
  } catch (error) {
    console.error('[file-tools] 检查转换任务失败:', error);
  }

  console.log('[file-tools] 禁用前检查完成');
}
