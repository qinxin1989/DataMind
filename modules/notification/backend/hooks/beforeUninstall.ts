/**
 * 卸载前钩子
 */

export async function beforeUninstall(): Promise<void> {
  console.log('[notification] 准备卸载通知模块...');
  console.log('[notification] 警告：卸载将删除所有通知数据');
}
