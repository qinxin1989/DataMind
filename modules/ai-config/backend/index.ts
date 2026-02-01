/**
 * AI配置模块后端入口
 */

import type { Pool } from 'mysql2/promise';
import { AIConfigService } from './service';
import { initRoutes } from './routes';

let serviceInstance: AIConfigService | null = null;

/**
 * 初始化模块
 */
export async function initialize(db: Pool, requirePermission: any) {
  serviceInstance = new AIConfigService(db);
  const router = initRoutes(serviceInstance, requirePermission);
  return router;
}

/**
 * 获取服务实例
 */
export function getService(): AIConfigService {
  if (!serviceInstance) {
    throw new Error('AI Config module not initialized');
  }
  return serviceInstance;
}

/**
 * 清理模块
 */
export async function cleanup() {
  serviceInstance = null;
}

export { AIConfigService } from './service';
export * from './types';
