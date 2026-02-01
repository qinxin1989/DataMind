/**
 * 卸载后钩子
 */

import { PoolConnection } from 'mysql2/promise';

export async function afterUninstall(connection: PoolConnection): Promise<void> {
  console.log('[crawler-template-config] 执行卸载后清理...');
  
  // 注意：不删除crawler_templates表中的数据，因为可能被其他模块使用
  // 只记录日志
  
  console.log('[crawler-template-config] 卸载完成');
}
