/**
 * Before Disable Hook
 * 禁用前钩子
 */

export async function beforeDisable(): Promise<void> {
  console.log('[Dashboard] 准备禁用大屏管理模块...');
  console.log('[Dashboard] 注意：禁用后将无法访问大屏管理功能');
  console.log('[Dashboard] 现有大屏数据将被保留');
}
