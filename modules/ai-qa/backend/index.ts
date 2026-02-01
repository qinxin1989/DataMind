/**
 * AI Q&A 模块后端入口
 */

import type { Pool } from 'mysql2/promise';
import { AIQAService } from './service';
import { createRoutes } from './routes';

let serviceInstance: AIQAService | null = null;

/**
 * 初始化模块
 */
export async function initialize(db: Pool) {
  const connection = await db.getConnection();
  try {
    serviceInstance = new AIQAService(connection as any);
    await serviceInstance.init();
    const router = createRoutes(serviceInstance);
    return router;
  } finally {
    connection.release();
  }
}

/**
 * 获取服务实例
 */
export function getService(): AIQAService {
  if (!serviceInstance) {
    throw new Error('AI Q&A module not initialized');
  }
  return serviceInstance;
}

/**
 * 清理模块
 */
export async function cleanup() {
  serviceInstance = null;
}

export { AIQAService } from './service';
export * from './types';
