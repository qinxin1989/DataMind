/**
 * Dashboard Module Backend Entry
 * 大屏管理模块后端入口
 */

import { DashboardService } from './service';
import { createDashboardRoutes } from './routes';

export function initDashboardModule() {
  const service = new DashboardService();
  const routes = createDashboardRoutes(service);

  return {
    service,
    routes,
  };
}

export { DashboardService } from './service';
export * from './types';
