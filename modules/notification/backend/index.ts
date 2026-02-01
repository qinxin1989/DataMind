/**
 * 通知模块后端入口
 */

import routes from './routes';
import { notificationService } from './service';

export { routes, notificationService };

export * from './types';
export * from './service';
