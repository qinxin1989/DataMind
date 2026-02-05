import { TableSchema, QueryResult } from './types';

// 数据源抽象基类
export abstract class BaseDataSource {
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract getSchema(): Promise<TableSchema[]>;
  abstract executeQuery(sql: string): Promise<QueryResult>;
  abstract testConnection(): Promise<boolean>;

  // 别名方法（保持兼容性）
  async getSchemas(): Promise<TableSchema[]> {
    return this.getSchema();
  }

  async query(sql: string): Promise<QueryResult> {
    return this.executeQuery(sql);
  }
}
