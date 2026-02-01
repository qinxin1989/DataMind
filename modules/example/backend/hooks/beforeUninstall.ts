/**
 * 卸载前钩子
 */

export async function beforeUninstall(): Promise<void> {
  console.log('[Example Module] Running beforeUninstall hook...');
  
  // 可以在这里执行卸载前的检查和清理
  
  console.log('[Example Module] beforeUninstall hook completed');
}
