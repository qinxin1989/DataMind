/**
 * 文件工具模块后端入口
 */

import { FileToolsService } from './service';
import { createFileToolsRoutes } from './routes';
import type { ModuleContext } from '../../../src/module-system/types';

export async function initialize(context: ModuleContext) {
  const { db, app, config } = context;

  // 创建服务实例
  const service = new FileToolsService(db, config);

  // 创建路由
  const routes = createFileToolsRoutes(service);

  // 注册路由
  app.use('/api/modules/file-tools', routes);

  console.log('[file-tools] 模块已初始化');

  return {
    service,
    routes
  };
}

export async function destroy(context: ModuleContext) {
  console.log('[file-tools] 模块已销毁');
}

export { FileToolsService } from './service';
export * from './types';
