/**
 * 禁用前钩子
 */

export async function beforeDisable(context: any): Promise<void> {
  console.log('[system-config] 准备禁用系统配置模块...');
  
  // 停止监控任务
  console.log('[system-config] 停止系统监控');
}
