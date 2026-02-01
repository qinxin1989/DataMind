/**
 * 效率工具模块后端入口
 */

import { EfficiencyToolsService } from './service';
import { createEfficiencyToolsRoutes } from './routes';
import type { ModuleContext } from '../../../src/module-system/types';

export async function initialize(context: ModuleContext) {
  const { db, app, config } = context;

  // 创建服务实例
  const service = new EfficiencyToolsService(db, config);

  // 注册路由
  const routes = createEfficiencyToolsRoutes(service);
  app.use('/api/modules/efficiency-tools', routes);

  console.log('[EfficiencyTools] 模块已初始化');

  return {
    service,
    routes
  };
}

export { EfficiencyToolsService } from './service';
export * from './types';
