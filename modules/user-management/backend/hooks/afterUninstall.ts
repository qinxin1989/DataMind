/**
 * 卸载后钩子
 */

export async function afterUninstall(): Promise<void> {
  console.log('[user-management] 模块已卸载');
}
