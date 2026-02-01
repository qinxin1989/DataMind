/**
 * 示例模块前端入口
 */

import { exampleRoutes } from './routes';

export function initExampleFrontend() {
  return {
    routes: exampleRoutes,
    name: 'example',
    version: '1.0.0'
  };
}

export { exampleRoutes };
export * from './api';
