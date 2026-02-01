/**
 * 启用后钩子
 */

export async function afterEnable(): Promise<void> {
  console.log('[Example Module] Running afterEnable hook...');
  
  // 可以在这里执行启用后的初始化
  
  console.log('[Example Module] afterEnable hook completed');
}
