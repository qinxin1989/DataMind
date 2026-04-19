/**
 * 文件工具模块前端入口
 */

import routes from './routes';

export { routes };

export default {
  routes,
  install() {
    console.log('[file-tools] 前端模块已加载');
  },
};
