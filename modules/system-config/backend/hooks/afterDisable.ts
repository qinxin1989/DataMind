/**
 * 禁用后钩子
 */

export async function afterDisable(context: any): Promise<void> {
  console.log('[system-config] 系统配置模块已禁用');
}
