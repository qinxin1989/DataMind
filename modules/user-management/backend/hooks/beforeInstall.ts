/**
 * 安装前钩子
 */

export async function beforeInstall(): Promise<void> {
  console.log('[user-management] 准备安装模块...');
  // 可以在这里检查依赖、验证环境等
}
