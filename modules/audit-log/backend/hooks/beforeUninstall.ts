/**
 * 卸载前钩子
 */

export async function beforeUninstall(context: any): Promise<void> {
  console.log('[audit-log] 准备卸载审计日志模块...');
  
  // 警告：卸载将删除所有审计日志数据
  console.warn('[audit-log] 警告：卸载将删除所有审计日志数据');
}
