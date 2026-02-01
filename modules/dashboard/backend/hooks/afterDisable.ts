/**
 * After Disable Hook
 * 禁用后钩子
 */

export async function afterDisable(): Promise<void> {
  console.log('[Dashboard] 大屏管理模块已禁用');
  console.log('[Dashboard] 大屏数据已保留，重新启用后可继续使用');
}
