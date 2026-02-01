/**
 * 卸载前钩子
 */

export async function beforeUninstall(context: any): Promise<void> {
  console.log('[system-backup] 准备卸载系统备份模块...');
  
  // 警告：卸载将删除所有备份记录（但保留备份文件）
  console.warn('[system-backup] 警告：卸载将删除所有备份记录');
}
