/**
 * 系统配置模块后端入口
 */

import { Router } from 'express';
import { initRoutes } from './routes';
import { SystemConfigService } from './service';

export { SystemConfigService };
export * from './types';

/**
 * 初始化模块
 */
export function init(db: any): Router {
  return initRoutes(db);
}
