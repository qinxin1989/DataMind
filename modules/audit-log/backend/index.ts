/**
 * 审计日志模块后端入口
 */

import { Router } from 'express';
import { initRoutes } from './routes';
import { AuditLogService } from './service';
import { ModuleContext, ModuleHooks } from '../../../src/module-system/types';

export { AuditLogService };
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

    const queries = [
      `CREATE TABLE IF NOT EXISTS sys_audit_logs (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36),
        username VARCHAR(100),
        action VARCHAR(100) NOT NULL,
        module VARCHAR(50) DEFAULT 'admin',
        target_type VARCHAR(50),
        target_id VARCHAR(100),
        details TEXT,
        ip_address VARCHAR(50),
        user_agent VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

      `CREATE TABLE IF NOT EXISTS sys_chat_history (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36),
        username VARCHAR(100),
        datasource_id VARCHAR(36),
        datasource_name VARCHAR(100),
        question TEXT,
        answer TEXT,
        sql_query TEXT,
        tokens_used INT DEFAULT 0,
        response_time INT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'success',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
    ];

    try {
      for (const query of queries) {
        await db.execute(query);
      }
      logger.info('Audit log tables initialized');
    } catch (error) {
      logger.error('Failed to initialize audit log tables:', error);
      throw error;
    }
  }
};
