/**
 * 数据源管理模块入口
 */

import type { Pool } from 'mysql2/promise';
import { createDataSourceRoutes } from './routes';
import { DataSourceService } from './service';

export interface DataSourceModuleOptions {
  db: Pool;
}

export function initDataSourceModule(options: DataSourceModuleOptions) {
  const { db } = options;

  return {
    routes: createDataSourceRoutes(db),
    name: 'datasource-management',
    version: '1.0.0',

    // 提供服务实例工厂
    createService: (userId: string) => new DataSourceService(db, userId)
  };
}

// 导出所有类型和服务
export * from './types';
export * from './service';

// 导出数据源适配器
export { BaseDataSource } from './base';
export { MySQLDataSource } from './mysql';
export { PostgresDataSource } from './postgres';
export { FileDataSource } from './file';
export { APIDataSource } from './api';
