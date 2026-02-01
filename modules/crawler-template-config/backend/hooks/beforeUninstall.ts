/**
 * 卸载前钩子
 */

import { PoolConnection } from 'mysql2/promise';

export async function beforeUninstall(connection: PoolConnection): Promise<void> {
  console.log('[crawler-template-config] 开始卸载前检查...');
  
  // 检查是否有其他模块依赖此模块
  // 目前没有其他模块依赖，直接通过
  
  console.log('[crawler-template-config] 卸载前检查通过');
}
