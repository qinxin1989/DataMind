/**
 * 安装前钩子
 */

export async function beforeInstall(): Promise<void> {
  console.log('[Example Module] Running beforeInstall hook...');
  
  // 可以在这里执行安装前的检查
  // 例如：检查依赖、验证环境等
  
  console.log('[Example Module] beforeInstall hook completed');
}
