/**
 * 安装后钩子
 */

export async function afterInstall(context: any): Promise<void> {
  console.log('[audit-log] 审计日志模块安装完成');
  
  // 记录安装日志
  const { db } = context;
  if (db) {
    try {
      // 可以在这里创建初始审计日志
      console.log('[audit-log] 初始化完成');
    } catch (error) {
      console.error('[audit-log] 初始化失败:', error);
    }
  }
}
