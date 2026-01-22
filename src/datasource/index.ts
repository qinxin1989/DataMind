import { BaseDataSource } from './base';
import { MySQLDataSource } from './mysql';
import { PostgresDataSource } from './postgres';
import { FileDataSource } from './file';
import { ApiDataSource } from './api';
import { DataSourceConfig, DatabaseConfig, FileConfig, ApiConfig } from '../types';

export function createDataSource(config: DataSourceConfig): BaseDataSource {
  // 兼容前端发送的 postgresql 类型
  let type = config.type;
  if (type === 'postgresql' as any) {
    type = 'postgres';
  }
  
  switch (type) {
    case 'mysql':
      return new MySQLDataSource(config.config as DatabaseConfig);
    case 'postgres':
      return new PostgresDataSource(config.config as DatabaseConfig);
    case 'file':
      return new FileDataSource(config.config as FileConfig);
    case 'api':
      return new ApiDataSource(config.config as ApiConfig);
    default:
      throw new Error(`Unsupported data source type: ${config.type}`);
  }
}

export { BaseDataSource, MySQLDataSource, PostgresDataSource, FileDataSource, ApiDataSource };
