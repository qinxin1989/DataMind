/**
 * 启用前钩子
 */

import { PoolConnection } from 'mysql2/promise';

export async function beforeEnable(connection: PoolConnection): Promise<void> {
  console.log('[crawler-template-config] 开始启用前检查...');
  
  // 检查Python爬虫服务是否可用
  try {
    const response = await fetch('http://localhost:5000/health', {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    
    if (!response.ok) {
      console.warn('[crawler-template-config] Python爬虫服务不可用，部分功能可能受限');
    }
  } catch (error) {
    console.warn('[crawler-template-config] 无法连接到Python爬虫服务，部分功能可能受限');
  }
  
  console.log('[crawler-template-config] 启用前检查完成');
}
