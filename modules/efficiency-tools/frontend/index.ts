/**
 * 效率工具模块前端入口
 */

import routes from './routes';

export { routes };

export function install() {
  console.log('[EfficiencyTools] 前端模块已加载');
}

export default {
  routes,
  install,
};
