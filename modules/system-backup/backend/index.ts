/**
 * 系统备份模块后端入口
 */

import { Router } from 'express';
import { initRoutes } from './routes';
import { SystemBackupService } from './service';
import { ModuleContext, ModuleHooks } from '../../../src/module-system/types';

export { SystemBackupService };
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
      CREATE TABLE IF NOT EXISTS system_backups (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        backup_size BIGINT DEFAULT 0,
        file_count INT DEFAULT 0,
        backup_path VARCHAR(512) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_by VARCHAR(36),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        error_message TEXT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    try {
      await db.execute(query);
      logger.info('Table system_backups initialized');
    } catch (error) {
      logger.error('Failed to initialize table system_backups:', error);
      throw error;
    }
  }
};
