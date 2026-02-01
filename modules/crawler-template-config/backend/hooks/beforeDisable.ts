/**
 * 禁用前钩子
 */

import { PoolConnection } from 'mysql2/promise';

export async function beforeDisable(connection: PoolConnection): Promise<void> {
  console.log('[crawler-template-config] 开始禁用前检查...');
  
  // 检查是否有正在运行的采集任务
  // 目前没有实现任务管理，直接通过
  
  console.log('[crawler-template-config] 禁用前检查通过');
}
