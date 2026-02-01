/**
 * 安装后钩子
 */

export async function afterInstall(): Promise<void> {
  console.log('[user-management] 模块安装完成');
  // 可以在这里初始化数据、创建默认用户等
}
