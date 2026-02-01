/**
 * 禁用前钩子
 */

export async function beforeDisable(): Promise<void> {
  console.log('[Example Module] Running beforeDisable hook...');
  
  // 可以在这里执行禁用前的清理
  
  console.log('[Example Module] beforeDisable hook completed');
}
