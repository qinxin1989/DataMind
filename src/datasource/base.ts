import { TableSchema, QueryResult } from '../types';

// 数据源抽象基类
export abstract class BaseDataSource {
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract getSchema(): Promise<TableSchema[]>;
  abstract executeQuery(sql: string): Promise<QueryResult>;
  abstract testConnection(): Promise<boolean>;
}
