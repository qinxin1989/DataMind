/**
 * 安装后钩子
 */

export async function afterInstall(): Promise<void> {
  console.log('[Example Module] Running afterInstall hook...');
  
  // 可以在这里执行安装后的初始化
  // 例如：创建默认数据、初始化配置等
  
  console.log('[Example Module] afterInstall hook completed');
}
