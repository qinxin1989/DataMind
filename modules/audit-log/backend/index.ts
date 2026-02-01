/**
 * 审计日志模块后端入口
 */

import { Router } from 'express';
import { initRoutes } from './routes';
import { AuditLogService } from './service';

export { AuditLogService };
export * from './types';

/**
 * 初始化模块
 */
export function init(db: any): Router {
  return initRoutes(db);
}
