/**
 * 卸载后钩子
 */

export async function afterUninstall(context: any): Promise<void> {
  const { logger, db } = context;

  logger.info('开始清理公文写作模块数据...');

  try {
    // 删除模板表
    await db.run('DROP TABLE IF EXISTS official_doc_templates');
    logger.info('已删除模板表');

    // 删除历史表
    await db.run('DROP TABLE IF EXISTS official_doc_history');
    logger.info('已删除历史表');

    logger.info('公文写作模块已完全卸载');
  } catch (error) {
    logger.error('清理数据失败:', error);
    throw error;
  }
}
