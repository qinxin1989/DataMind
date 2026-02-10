/**
 * 系统配置模块后端入口
 */

import { Router } from 'express';
import { initRoutes } from './routes';
import { SystemConfigService } from './service';
import { ModuleContext, ModuleHooks } from '../../../src/module-system/types';

export { SystemConfigService };
export * from './types';

/**
 * 初始化模块
 */
export function init(db: any): Router {
  return initRoutes(db);
}

/**
 * 模块钩子
 */
export const hooks: ModuleHooks = {
  beforeEnable: async (context: ModuleContext) => {
    const { db, logger } = context;

    const query = `
      CREATE TABLE IF NOT EXISTS system_configs (
        id VARCHAR(36) PRIMARY KEY,
        config_key VARCHAR(100) NOT NULL UNIQUE,
        config_value TEXT,
        value_type VARCHAR(20) DEFAULT 'string',
        description VARCHAR(255),
        config_group VARCHAR(50) DEFAULT 'general',
        is_editable TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    try {
      await db.execute(query);
      logger.info('Table system_configs initialized');
    } catch (error) {
      logger.error('Failed to initialize table system_configs:', error);
      throw error;
    }
  }
};
