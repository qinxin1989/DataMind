/**
 * 禁用后钩子
 */

export async function afterDisable(context: any): Promise<void> {
  console.log('[system-backup] 系统备份模块已禁用');
}
