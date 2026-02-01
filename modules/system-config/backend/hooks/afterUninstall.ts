/**
 * 卸载后钩子
 */

export async function afterUninstall(context: any): Promise<void> {
  console.log('[system-config] 系统配置模块已卸载');
  
  // 清理相关数据
  try {
    await context.db.run('DROP TABLE IF EXISTS system_configs');
    console.log('[system-config] 数据表已清理');
  } catch (error) {
    console.error('[system-config] 清理失败:', error);
  }
}
