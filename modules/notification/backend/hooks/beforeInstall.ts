/**
 * 安装前钩子
 */

export async function beforeInstall(): Promise<void> {
  console.log('[notification] 准备安装通知模块...');
  
  // 检查依赖
  // 通知模块无外部依赖
}
