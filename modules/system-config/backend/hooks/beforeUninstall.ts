/**
 * 卸载前钩子
 */

export async function beforeUninstall(context: any): Promise<void> {
  console.log('[system-config] 准备卸载系统配置模块...');
  
  // 警告：卸载将删除所有配置数据
  console.warn('[system-config] 警告：即将删除所有系统配置数据');
}
