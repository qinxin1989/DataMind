import { TableSchema, QueryResult } from '../types';

// 数据源抽象基类
export abstract class BaseDataSource {
  // Schema 缓存（避免每次问答都查 information_schema）
  private schemaCache: TableSchema[] | null = null;
  private schemaCacheTime: number = 0;
  protected SCHEMA_CACHE_TTL: number = 5 * 60 * 1000; // 默认 5 分钟

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract executeQuery(sql: string): Promise<QueryResult>;
  abstract testConnection(): Promise<boolean>;

  // 子类实现实际的 Schema 获取逻辑
  protected abstract fetchSchema(): Promise<TableSchema[]>;

  // 带缓存的 getSchema（外部统一调用此方法）
  async getSchema(forceRefresh: boolean = false): Promise<TableSchema[]> {
    const now = Date.now();
    if (
      !forceRefresh &&
      this.schemaCache &&
      (now - this.schemaCacheTime) < this.SCHEMA_CACHE_TTL
    ) {
      return this.schemaCache;
    }

    this.schemaCache = await this.fetchSchema();
    this.schemaCacheTime = now;
    return this.schemaCache;
  }

  // 手动使缓存失效（数据源结构变更时调用）
  invalidateSchemaCache(): void {
    this.schemaCache = null;
    this.schemaCacheTime = 0;
  }
}
