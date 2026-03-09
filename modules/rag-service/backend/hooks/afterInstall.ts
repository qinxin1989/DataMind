import { MigrationManager } from '../../../../src/module-system/core/MigrationManager';

export async function afterInstall(): Promise<void> {
  console.log('[rag-service] Hook afterInstall executed');
  
  // 运行数据库迁移，确保表结构正确
  try {
    const migrationManager = new MigrationManager();
    await migrationManager.migrate('rag-service');
    console.log('[rag-service] 数据库迁移完成');
  } catch (error: any) {
    console.error('[rag-service] 数据库迁移失败:', error.message);
    // 不抛出错误，允许模块继续安装
  }
}
