/**
 * 角色管理模块前端入口
 */

import routes from './routes';
import { roleApi } from './api';

export { routes, roleApi };

export default {
  routes,
  api: roleApi,
};
