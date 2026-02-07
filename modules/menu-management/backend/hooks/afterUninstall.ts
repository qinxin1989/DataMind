/**
 * 模块卸载钩子
 */

export async function afterUninstall(): Promise<void> {
  console.log('[menu-management] 模块卸载完成');
}

