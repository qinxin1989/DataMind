/**
 * 模块加载后钩子
 */

export async function afterLoad(): Promise<void> {
  console.log('[menu-management] 模块加载完成');
}
