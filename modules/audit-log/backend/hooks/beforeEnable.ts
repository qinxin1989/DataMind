/**
 * 启用前钩子
 */

export async function beforeEnable(context: any): Promise<void> {
  console.log('[audit-log] 准备启用审计日志模块...');
  
  // 检查数据库表是否存在
  const { db } = context;
  if (db) {
    try {
      await db.get('SELECT 1 FROM audit_logs LIMIT 1');
      console.log('[audit-log] 数据库表检查通过');
    } catch (error) {
      throw new Error('审计日志表不存在，请先运行数据库迁移');
    }
  }
}
