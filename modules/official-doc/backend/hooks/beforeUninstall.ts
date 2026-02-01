/**
 * 卸载前钩子
 */

export async function beforeUninstall(context: any): Promise<void> {
  const { logger, db } = context;

  logger.warn('准备卸载公文写作模块');

  // 检查是否有数据
  try {
    const templateCount = await db.get(
      'SELECT COUNT(*) as count FROM official_doc_templates WHERE is_system = 0'
    );
    const historyCount = await db.get(
      'SELECT COUNT(*) as count FROM official_doc_history'
    );

    if (templateCount.count > 0 || historyCount.count > 0) {
      logger.warn(`警告: 将删除 ${templateCount.count} 个模板和 ${historyCount.count} 条历史记录`);
      logger.warn('建议先备份数据再卸载');
    }
  } catch (error) {
    logger.error('检查数据失败:', error);
  }
}
