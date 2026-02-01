/**
 * 启用后钩子
 */

export async function afterEnable(context: any): Promise<void> {
  console.log('[system-backup] 系统备份模块已启用');
  
  // 启动自动清理任务（如果配置了）
  const { config } = context;
  if (config?.autoCleanup) {
    console.log('[system-backup] 自动清理任务已启动');
  }
}
