/**
 * 卸载后钩子
 */

export async function afterUninstall(context: any): Promise<void> {
  console.log('[audit-log] 审计日志模块已卸载');
  
  // 清理相关数据
  const { db } = context;
  if (db) {
    try {
      await db.run('DROP TABLE IF EXISTS audit_logs');
      console.log('[audit-log] 数据表已清理');
    } catch (error) {
      console.error('[audit-log] 清理失败:', error);
    }
  }
}
