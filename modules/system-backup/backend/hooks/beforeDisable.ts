/**
 * 禁用前钩子
 */

export async function beforeDisable(context: any): Promise<void> {
  console.log('[system-backup] 准备禁用系统备份模块...');
  
  // 停止自动清理任务
  console.log('[system-backup] 停止自动清理任务');
}
