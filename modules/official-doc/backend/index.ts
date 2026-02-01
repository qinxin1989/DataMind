/**
 * 公文写作模块后端入口
 */

import { OfficialDocService } from './service';
import { createOfficialDocRoutes } from './routes';
import type { ModuleContext } from '../../../src/module-system/types';

export async function initialize(context: ModuleContext) {
  const { db, app, config } = context;

  // 创建服务实例
  const service = new OfficialDocService(db, config);

  // 尝试加载 AI 配置服务
  try {
    const aiConfigModule = require('../../ai-config/backend');
    if (aiConfigModule && aiConfigModule.AIConfigService) {
      // 这里需要获取 AI 配置服务实例
      // 实际实现中需要通过模块系统获取
      console.log('[OfficialDoc] AI 配置服务可用');
    }
  } catch (error) {
    console.log('[OfficialDoc] AI 配置服务不可用，将使用模板生成');
  }

  // 注册路由
  const routes = createOfficialDocRoutes(service);
  app.use('/api/modules/official-doc', routes);

  console.log('[OfficialDoc] 模块已初始化');

  return {
    service,
    routes
  };
}

export { OfficialDocService } from './service';
export * from './types';
