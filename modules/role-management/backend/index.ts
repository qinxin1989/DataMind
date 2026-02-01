/**
 * 角色管理模块后端入口
 */

import { roleService } from './service';
import routes from './routes';

export { roleService, routes };

export default {
  service: roleService,
  routes,
};
