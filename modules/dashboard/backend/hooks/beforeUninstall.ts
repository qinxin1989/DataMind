/**
 * Before Uninstall Hook
 * 卸载前钩子
 */

export async function beforeUninstall(): Promise<void> {
  console.log('[Dashboard] 准备卸载大屏管理模块...');
  console.log('[Dashboard] ⚠️  警告：卸载将删除所有大屏数据！');
  console.log('[Dashboard] 请确保已备份重要数据');
}
