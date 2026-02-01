/**
 * 禁用后钩子
 */

import { PoolConnection } from 'mysql2/promise';

export async function afterDisable(connection: PoolConnection): Promise<void> {
  console.log('[crawler-template-config] 执行禁用后操作...');
  
  // 记录禁用日志
  console.log('[crawler-template-config] 模块已禁用');
}
