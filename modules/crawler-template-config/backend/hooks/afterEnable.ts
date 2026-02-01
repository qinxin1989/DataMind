/**
 * 启用后钩子
 */

import { PoolConnection } from 'mysql2/promise';

export async function afterEnable(connection: PoolConnection): Promise<void> {
  console.log('[crawler-template-config] 执行启用后操作...');
  
  // 记录启用日志
  console.log('[crawler-template-config] 模块已启用');
}
