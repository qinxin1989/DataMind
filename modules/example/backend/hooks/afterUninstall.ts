/**
 * 卸载后钩子
 */

export async function afterUninstall(): Promise<void> {
  console.log('[Example Module] Running afterUninstall hook...');
  
  // 可以在这里执行卸载后的清理
  
  console.log('[Example Module] afterUninstall hook completed');
}
