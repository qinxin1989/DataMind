/**
 * 卸载后钩子
 */

export async function afterUninstall(context: any): Promise<void> {
  console.log('[system-backup] 系统备份模块已卸载');
  
  // 清理相关数据
  const { db } = context;
  if (db) {
    try {
      await db.run('DROP TABLE IF EXISTS system_backups');
      console.log('[system-backup] 数据表已清理');
    } catch (error) {
      console.error('[system-backup] 清理失败:', error);
    }
  }
  
  // 注意：不删除备份文件，以防数据丢失
  console.log('[system-backup] 备份文件已保留');
}
