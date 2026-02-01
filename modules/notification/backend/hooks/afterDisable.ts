/**
 * 禁用后钩子
 */

export async function afterDisable(): Promise<void> {
  console.log('[notification] 通知模块已禁用');
}
