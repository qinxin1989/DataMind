/**
 * 示例模块后端入口
 */

import type { Pool } from 'mysql2/promise';
import { createExampleRoutes } from './routes';

export interface ExampleModuleOptions {
  db: Pool;
}

export function initExampleModule(options: ExampleModuleOptions) {
  const { db } = options;

  return {
    routes: createExampleRoutes(db),
    name: 'example',
    version: '1.0.0'
  };
}

export * from './types';
export * from './service';
