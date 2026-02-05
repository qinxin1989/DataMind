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
        type: this.inferType(this.data, key), // 传入整个data数组和字段名
        nullable: true,
      }));
      this.schema = {
        tableName: 'api_data',
        columns,
        sampleData: this.data.slice(0, 3),
      };
    }
  }

  /**
   * 改进的类型推断：采样多行数据来推断字段类型
   * @param data - 数据数组
   * @param key - 字段名
   * @returns 推断的类型
   */
  private inferType(data: any[], key: string): string {
    // 采样前20行数据（或全部数据，如果少于20行）
    const sampleSize = Math.min(data.length, 20);
    const samples: any[] = [];

    for (let i = 0; i < sampleSize; i++) {
      const value = data[i][key];
      if (value !== null && value !== undefined && value !== '') {
        samples.push(value);
      }
    }

    // 如果所有采样值都是空的，返回string
    if (samples.length === 0) return 'string';

    // 统计各类型的出现次数
    let numberCount = 0;
    let integerCount = 0;
    let booleanCount = 0;
    let arrayCount = 0;
    let objectCount = 0;
    let dateCount = 0;
    let stringCount = 0;

    for (const value of samples) {
      const type = typeof value;

      if (type === 'number') {
        numberCount++;
        if (Number.isInteger(value)) {
          integerCount++;
        }
      } else if (type === 'boolean') {
        booleanCount++;
      } else if (Array.isArray(value)) {
        arrayCount++;
      } else if (type === 'object') {
        objectCount++;
      } else if (type === 'string') {
        // 尝试解析为日期
        const dateVal = new Date(value);
        const isValidDate = !isNaN(dateVal.getTime()) &&
                           !isNaN(Date.parse(value)) &&
                           value.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/); // 包含日期格式

        if (isValidDate) {
          dateCount++;
        } else {
          stringCount++;
        }
      }
    }

    const total = samples.length;

    // 判断逻辑：如果某种类型占比超过80%，则认为是该类型
    if (arrayCount / total > 0.8) return 'array';
    if (objectCount / total > 0.8) return 'object';
    if (numberCount / total > 0.8) {
      return integerCount / numberCount > 0.8 ? 'integer' : 'float';
    }
    if (booleanCount / total > 0.8) return 'boolean';
    if (dateCount / total > 0.8) return 'date';

    // 默认返回string
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
