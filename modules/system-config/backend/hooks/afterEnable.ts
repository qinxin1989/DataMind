/**
 * 启用后钩子
 */

export async function afterEnable(context: any): Promise<void> {
  console.log('[system-config] 系统配置模块已启用');
  
  // 可以在这里初始化监控任务等
  console.log('[system-config] 系统监控已就绪');
}
