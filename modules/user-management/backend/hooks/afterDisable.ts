/**
 * 禁用后钩子
 */

export async function afterDisable(): Promise<void> {
  console.log('[user-management] 模块已禁用');
}
