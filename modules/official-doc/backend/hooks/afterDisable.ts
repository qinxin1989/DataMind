/**
 * 禁用后钩子
 */

export async function afterDisable(context: any): Promise<void> {
  const { logger } = context;

  logger.info('公文写作模块已禁用');
  logger.info('历史数据已保留，重新启用后可继续使用');
}
