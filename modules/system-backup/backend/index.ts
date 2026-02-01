/**
 * 系统备份模块后端入口
 */

import { Router } from 'express';
import { initRoutes } from './routes';
import { SystemBackupService } from './service';

export { SystemBackupService };
export * from './types';

/**
 * 初始化模块
 */
export function init(db: any): Router {
  return initRoutes(db);
}
