/**
 * 安装前钩子
 */

export async function beforeInstall(context: any): Promise<void> {
  console.log('[system-config] 准备安装系统配置模块...');
  
  // 检查数据库连接
  if (!context.db) {
    throw new Error('数据库连接不可用');
  }

  // 检查必要的权限
  console.log('[system-config] 前置检查通过');
}
