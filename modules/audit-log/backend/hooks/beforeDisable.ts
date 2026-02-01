/**
 * 禁用前钩子
 */

export async function beforeDisable(context: any): Promise<void> {
  console.log('[audit-log] 准备禁用审计日志模块...');
  
  // 停止自动清理任务
  console.log('[audit-log] 停止自动清理任务');
}
