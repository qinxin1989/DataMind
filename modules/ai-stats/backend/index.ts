/**
 * AI统计模块后端入口
 */

import type { ModuleContext } from '../../../src/module-system/types';
import routes from './routes';
import { aiStatsService } from './service';

export default {
  /**
   * 模块安装前钩子
   */
  async beforeInstall(context: ModuleContext): Promise<void> {
    context.logger.info('[ai-stats] 准备安装AI统计模块...');
  },

  /**
   * 模块安装后钩子
   */
  async afterInstall(context: ModuleContext): Promise<void> {
    context.logger.info('[ai-stats] AI统计模块安装完成');
  },

  /**
   * 模块卸载前钩子
   */
  async beforeUninstall(context: ModuleContext): Promise<void> {
    context.logger.info('[ai-stats] 准备卸载AI统计模块...');
  },

  /**
   * 模块卸载后钩子
   */
  async afterUninstall(context: ModuleContext): Promise<void> {
    context.logger.info('[ai-stats] AI统计模块已卸载');
  },

  /**
   * 模块启用前钩子
   */
  async beforeEnable(context: ModuleContext): Promise<void> {
    context.logger.info('[ai-stats] 准备启用AI统计模块...');
  },

  /**
   * 模块启用后钩子
   */
  async afterEnable(context: ModuleContext): Promise<void> {
    context.logger.info('[ai-stats] AI统计模块已启用');
  },

  /**
   * 模块禁用前钩子
   */
  async beforeDisable(context: ModuleContext): Promise<void> {
    context.logger.info('[ai-stats] 准备禁用AI统计模块...');
  },

  /**
   * 模块禁用后钩子
   */
  async afterDisable(context: ModuleContext): Promise<void> {
    context.logger.info('[ai-stats] AI统计模块已禁用');
  },

  /**
   * 获取路由
   */
  getRoutes() {
    return routes;
  },

  /**
   * 获取服务实例
   */
  getService() {
    return aiStatsService;
  }
};
