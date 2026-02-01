/**
 * 卸载前钩子
 */

import type { ModuleContext } from '../../../../src/module-system/types';

export async function beforeUninstall(context: ModuleContext): Promise<void> {
  console.log('[file-tools] 执行卸载前检查...');

  // 警告用户数据将被删除
  console.warn('[file-tools] 警告: 卸载将删除所有转换历史记录');

  // 检查是否有正在进行的任务
  const { db } = context;
  try {
    const result = await db.get(
      "SELECT COUNT(*) as count FROM file_conversion_history WHERE status = 'processing'"
    );
    
    if (result && result.count > 0) {
      throw new Error(`有 ${result.count} 个转换任务正在进行中，请等待完成后再卸载`);
    }
  } catch (error: any) {
    if (error.message.includes('转换任务正在进行中')) {
      throw error;
    }
    console.error('[file-tools] 检查转换任务失败:', error);
  }

  console.log('[file-tools] 卸载前检查通过');
}
