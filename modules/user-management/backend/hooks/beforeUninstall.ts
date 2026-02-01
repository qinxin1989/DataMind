/**
 * 卸载前钩子
 */

export async function beforeUninstall(): Promise<void> {
  console.log('[user-management] 准备卸载模块...');
  // 可以在这里备份数据等
}
