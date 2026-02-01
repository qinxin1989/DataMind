/**
 * 安装前钩子
 */

export async function beforeInstall(context: any): Promise<void> {
  console.log('[system-backup] 准备安装系统备份模块...');
  
  // 检查数据库连接
  if (!context.db) {
    throw new Error('数据库连接不可用');
  }

  // 检查必要的权限
  console.log('[system-backup] 前置检查通过');
}
