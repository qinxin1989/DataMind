/**
 * 启用前钩子
 */

export async function beforeEnable(context: any): Promise<void> {
  console.log('[system-backup] 准备启用系统备份模块...');
  
  // 检查数据库表是否存在
  const { db } = context;
  if (db) {
    try {
      await db.get('SELECT 1 FROM system_backups LIMIT 1');
      console.log('[system-backup] 数据库表检查通过');
    } catch (error) {
      throw new Error('系统备份表不存在，请先运行数据库迁移');
    }
  }
}
