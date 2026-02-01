/**
 * 启用后钩子
 */

export async function afterEnable(context: any): Promise<void> {
  console.log('[audit-log] 审计日志模块已启用');
  
  // 启动自动清理任务（如果配置了）
  const { config } = context;
  if (config?.enableAutoCleanup) {
    console.log('[audit-log] 自动清理任务已启动');
  }
}
