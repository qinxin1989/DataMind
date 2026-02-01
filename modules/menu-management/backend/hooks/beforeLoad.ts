/**
 * 模块加载前钩子
 */

export async function beforeLoad(): Promise<void> {
  console.log('[menu-management] 准备加载模块');
}
