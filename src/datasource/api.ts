import axios from 'axios';
import { BaseDataSource } from './base';
import { ApiConfig, TableSchema, ColumnInfo, QueryResult } from '../types';

export class ApiDataSource extends BaseDataSource {
  private config: ApiConfig;
  private data: any[] = [];
  private schema: TableSchema | null = null;

  constructor(config: ApiConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    const response = await axios({
      method: this.config.method,
      url: this.config.url,
      headers: this.config.headers,
      params: this.config.params,
    });

    const responseData = response.data;
    this.data = Array.isArray(responseData) 
      ? responseData 
      : responseData.data 
        ? (Array.isArray(responseData.data) ? responseData.data : [responseData.data])
        : [responseData];

    // 自动识别schema
    if (this.data.length > 0) {
      const columns: ColumnInfo[] = Object.keys(this.data[0]).map(key => ({
        name: key,
        type: this.inferType(this.data[0][key]),
        nullable: true,
      }));
      this.schema = {
        tableName: 'api_data',
        columns,
        sampleData: this.data.slice(0, 3),
      };
    }
  }

  private inferType(value: any): string {
    if (value === null || value === undefined) return 'string';
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'float';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'string';
  }

  async disconnect(): Promise<void> {
    this.data = [];
    this.schema = null;
  }

  async testConnection(): Promise<boolean> {
    try {
      await axios.head(this.config.url, { headers: this.config.headers, timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async getSchema(): Promise<TableSchema[]> {
    if (!this.schema) await this.connect();
    return this.schema ? [this.schema] : [];
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    try {
      if (this.data.length === 0) await this.connect();
      
      // 简单的过滤逻辑，类似文件数据源
      const lowerSql = sql.toLowerCase();
      let result = [...this.data];

      const limitMatch = lowerSql.match(/limit\s+(\d+)/);
      if (limitMatch) {
        result = result.slice(0, parseInt(limitMatch[1]));
      }

      return { success: true, data: result, sql, rowCount: result.length };
    } catch (error: any) {
      return { success: false, error: error.message, sql };
    }
  }
}
