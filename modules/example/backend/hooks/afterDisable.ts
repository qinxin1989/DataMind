/**
 * 禁用后钩子
 */

export async function afterDisable(): Promise<void> {
  console.log('[Example Module] Running afterDisable hook...');
  
  // 可以在这里执行禁用后的清理
  
  console.log('[Example Module] afterDisable hook completed');
}
