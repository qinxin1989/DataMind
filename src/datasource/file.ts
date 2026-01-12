import * as fs from 'fs';
import * as xlsx from 'xlsx';
import { parse } from 'csv-parse/sync';
import { BaseDataSource } from './base';
import { FileConfig, TableSchema, ColumnInfo, QueryResult } from '../types';

export class FileDataSource extends BaseDataSource {
  private config: FileConfig;
  private data: any[] = [];
  private schema: TableSchema | null = null;

  constructor(config: FileConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    const content = fs.readFileSync(this.config.path);
    
    switch (this.config.fileType) {
      case 'csv':
        this.data = parse(content, { columns: true, skip_empty_lines: true });
        break;
      case 'xlsx':
        const workbook = xlsx.read(content, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        this.data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        break;
      case 'json':
        const jsonData = JSON.parse(content.toString());
        this.data = Array.isArray(jsonData) ? jsonData : [jsonData];
        break;
    }

    // 自动识别schema
    if (this.data.length > 0) {
      const columns: ColumnInfo[] = Object.keys(this.data[0]).map(key => ({
        name: key,
        type: this.inferType(this.data[0][key]),
        nullable: true,
      }));
      
      // 使用原始文件名作为表名（如果有的话），否则从路径提取
      let tableName = (this.config.config as any).originalName || this.config.path.split(/[\/\\]/).pop() || 'file_data';
      // 移除文件扩展名
      tableName = tableName.replace(/\.[^.]+$/, '');
      
      this.schema = {
        tableName,
        columns,
        sampleData: this.data.slice(0, 3),
      };
    }
  }

  private inferType(value: any): string {
    if (value === null || value === undefined) return 'string';
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'float';
    if (typeof value === 'boolean') return 'boolean';
    if (!isNaN(Date.parse(value))) return 'date';
    return 'string';
  }

  async disconnect(): Promise<void> {
    this.data = [];
    this.schema = null;
  }

  async testConnection(): Promise<boolean> {
    return fs.existsSync(this.config.path);
  }

  async getSchema(): Promise<TableSchema[]> {
    if (!this.schema) await this.connect();
    return this.schema ? [this.schema] : [];
  }

  // 简单的SQL-like查询（支持SELECT/WHERE/ORDER BY/LIMIT）
  async executeQuery(sql: string): Promise<QueryResult> {
    try {
      if (this.data.length === 0) await this.connect();
      
      const lowerSql = sql.toLowerCase();
      let result = [...this.data];

      // 解析WHERE条件
      const whereMatch = lowerSql.match(/where\s+(.+?)(?:\s+order|\s+limit|$)/);
      if (whereMatch) {
        const condition = whereMatch[1].trim();
        result = this.applyWhere(result, condition);
      }

      // 解析ORDER BY
      const orderMatch = lowerSql.match(/order\s+by\s+(\w+)(?:\s+(asc|desc))?/);
      if (orderMatch) {
        const field = orderMatch[1];
        const desc = orderMatch[2] === 'desc';
        result.sort((a, b) => {
          const cmp = a[field] > b[field] ? 1 : -1;
          return desc ? -cmp : cmp;
        });
      }

      // 解析LIMIT
      const limitMatch = lowerSql.match(/limit\s+(\d+)/);
      if (limitMatch) {
        result = result.slice(0, parseInt(limitMatch[1]));
      }

      return { success: true, data: result, sql, rowCount: result.length };
    } catch (error: any) {
      return { success: false, error: error.message, sql };
    }
  }

  private applyWhere(data: any[], condition: string): any[] {
    // 简单支持 = 和 LIKE
    const eqMatch = condition.match(/(\w+)\s*=\s*['"]?([^'"]+)['"]?/);
    if (eqMatch) {
      const [, field, value] = eqMatch;
      return data.filter(row => String(row[field]) === value);
    }
    const likeMatch = condition.match(/(\w+)\s+like\s+['"]%?([^%'"]+)%?['"]/i);
    if (likeMatch) {
      const [, field, value] = likeMatch;
      return data.filter(row => String(row[field]).includes(value));
    }
    return data;
  }
}
