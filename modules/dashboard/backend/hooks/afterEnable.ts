/**
 * After Enable Hook
 * 启用后钩子
 */

export async function afterEnable(): Promise<void> {
  console.log('[Dashboard] 大屏管理模块已启用');
  console.log('[Dashboard] 可以通过 /system/dashboard 访问大屏管理页面');
  console.log('[Dashboard] API端点: /api/dashboards');
}
