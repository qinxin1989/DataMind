/**
 * 禁用后钩子
 */

export async function afterDisable(context: any): Promise<void> {
  console.log('[audit-log] 审计日志模块已禁用');
}
