/**
 * 启用前钩子
 */

export async function beforeEnable(): Promise<void> {
  console.log('[Example Module] Running beforeEnable hook...');
  
  // 可以在这里执行启用前的检查
  
  console.log('[Example Module] beforeEnable hook completed');
}
