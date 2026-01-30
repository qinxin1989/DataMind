import * as fs from 'fs';
import * as xlsx from 'xlsx';
import { parse } from 'csv-parse/sync';
import { BaseDataSource } from './base';
import { FileConfig, TableSchema, ColumnInfo, QueryResult } from '../types';
import { fileEncryption } from '../services/fileEncryption';

// 单个文件信息
interface FileInfo {
  path: string;
  fileType: 'csv' | 'xlsx' | 'json';
  originalName?: string;
  encrypted?: boolean;
  tableName: string;
}

export class FileDataSource extends BaseDataSource {
  private config: FileConfig;
  private tables: Map<string, any[]> = new Map(); // tableName -> data
  private schemas: TableSchema[] = [];

  constructor(config: FileConfig) {
    super();
    this.config = config;
  }

  // 获取所有文件信息
  private getFileInfos(): FileInfo[] {
    // 支持多文件：files 数组或单个 path
    if (this.config.files && this.config.files.length > 0) {
      return this.config.files.map(f => ({
        path: f.path,
        fileType: f.fileType,
        originalName: f.originalName,
        encrypted: f.encrypted,
        tableName: this.getTableName(f.originalName || f.path)
      }));
    }
    
    // 兼容单文件模式
    return [{
      path: this.config.path,
      fileType: this.config.fileType,
      originalName: this.config.originalName,
      encrypted: this.config.encrypted,
      tableName: this.getTableName(this.config.originalName || this.config.path)
    }];
  }

  // 从文件名提取表名
  private getTableName(nameOrPath: string): string {
    let name = nameOrPath.split(/[\/\\]/).pop() || 'file_data';
    // 移除扩展名（包括 .enc）
    name = name.replace(/\.(csv|xlsx|xls|json|enc)+$/gi, '');
    // 清理特殊字符，保留中文
    name = name.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_');
    return name;
  }

  async connect(): Promise<void> {
    const fileInfos = this.getFileInfos();

    for (const fileInfo of fileInfos) {
      try {
        const data = await this.loadFile(fileInfo);
        this.tables.set(fileInfo.tableName, data);

        // 生成 schema
        if (data.length > 0) {
          const columns: ColumnInfo[] = Object.keys(data[0]).map(key => ({
            name: key,
            type: this.inferType(data, key), // 传入整个data数组和字段名
            nullable: true,
          }));

          this.schemas.push({
            tableName: fileInfo.tableName,
            columns,
            sampleData: data.slice(0, 3),
          });
        }
      } catch (e: any) {
        console.error(`加载文件失败 ${fileInfo.originalName || fileInfo.path}:`, e.message);
      }
    }
  }

  // 加载单个文件
  private async loadFile(fileInfo: FileInfo): Promise<any[]> {
    let content: Buffer;

    try {
      // 检查文件是否加密
      if (fileInfo.encrypted || fileEncryption.isEncrypted(fileInfo.path)) {
        // 先验证加密文件格式
        const validation = fileEncryption.validateEncryptedFile(fileInfo.path);
        if (!validation.valid) {
          const fileName = fileInfo.originalName || fileInfo.path;
          throw new Error(`加密文件已损坏或格式不正确 [${fileName}]: ${validation.error}。建议：重新上传该文件`);
        }
        content = fileEncryption.decryptFileToBuffer(fileInfo.path);
      } else {
        content = fs.readFileSync(fileInfo.path);
      }
    } catch (error: any) {
      // 提供更详细的错误信息，包括文件名
      const fileName = fileInfo.originalName || fileInfo.path;
      throw new Error(`加载文件失败 [${fileName}]: ${error.message}`);
    }

    switch (fileInfo.fileType) {
      case 'csv':
        return parse(content, { columns: true, skip_empty_lines: true });
      case 'xlsx':
        const workbook = xlsx.read(content, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
      case 'json':
        const jsonData = JSON.parse(content.toString());
        return Array.isArray(jsonData) ? jsonData : [jsonData];
      default:
        return [];
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
    if (numberCount / total > 0.8) {
      return integerCount / numberCount > 0.8 ? 'integer' : 'float';
    }
    if (booleanCount / total > 0.8) return 'boolean';
    if (dateCount / total > 0.8) return 'date';

    // 默认返回string
    return 'string';
  }

  async disconnect(): Promise<void> {
    this.tables.clear();
    this.schemas = [];
  }

  async testConnection(): Promise<boolean> {
    const fileInfos = this.getFileInfos();
    for (const fileInfo of fileInfos) {
      if (fs.existsSync(fileInfo.path)) continue;
      if (fs.existsSync(fileInfo.path + '.enc')) continue;
      return false;
    }
    return fileInfos.length > 0;
  }

  async getSchema(): Promise<TableSchema[]> {
    if (this.schemas.length === 0) await this.connect();
    return this.schemas;
  }

  // 获取所有表名（用于AI提示）
  getTableNames(): string[] {
    return Array.from(this.tables.keys());
  }

  // 解析 SQL 中的表名
  private parseTableName(sql: string): string | null {
    // 支持中文表名
    const match = sql.match(/from\s+[`"]?([a-zA-Z0-9_\u4e00-\u9fa5]+)[`"]?/i);
    return match ? match[1] : null;
  }

  // 解析 JOIN 语句
  private parseJoins(sql: string): { table: string; alias?: string; on: string; type: 'inner' | 'left' | 'right' }[] {
    const joins: { table: string; alias?: string; on: string; type: 'inner' | 'left' | 'right' }[] = [];
    // 匹配 JOIN 语句，支持中文表名
    const joinRegex = /(left\s+|right\s+|inner\s+)?join\s+[`"]?([a-zA-Z0-9_\u4e00-\u9fa5]+)[`"]?(?:\s+(?:as\s+)?([a-zA-Z0-9_]+))?\s+on\s+([^join]+?)(?=\s+(?:left|right|inner)?\s*join|\s+where|\s+group|\s+order|\s+limit|$)/gi;
    
    let match;
    while ((match = joinRegex.exec(sql)) !== null) {
      const joinType = (match[1] || 'inner').trim().toLowerCase() as 'inner' | 'left' | 'right';
      joins.push({
        table: match[2],
        alias: match[3],
        on: match[4].trim(),
        type: joinType
      });
    }
    return joins;
  }

  // 解析 ON 条件
  private parseOnCondition(on: string): { leftTable: string; leftField: string; rightTable: string; rightField: string } | null {
    // 支持 table1.field = table2.field 或 alias1.field = alias2.field
    const match = on.match(/([a-zA-Z0-9_\u4e00-\u9fa5]+)\.([a-zA-Z0-9_\u4e00-\u9fa5]+)\s*=\s*([a-zA-Z0-9_\u4e00-\u9fa5]+)\.([a-zA-Z0-9_\u4e00-\u9fa5]+)/i);
    if (match) {
      return {
        leftTable: match[1],
        leftField: match[2],
        rightTable: match[3],
        rightField: match[4]
      };
    }
    return null;
  }

  // 执行 JOIN 操作
  private executeJoin(
    leftData: any[],
    rightData: any[],
    leftField: string,
    rightField: string,
    joinType: 'inner' | 'left' | 'right',
    leftPrefix: string,
    rightPrefix: string
  ): any[] {
    const result: any[] = [];
    
    // 为右表建立索引
    const rightIndex = new Map<string, any[]>();
    for (const row of rightData) {
      const key = String(row[rightField] ?? '');
      if (!rightIndex.has(key)) rightIndex.set(key, []);
      rightIndex.get(key)!.push(row);
    }

    for (const leftRow of leftData) {
      const key = String(leftRow[leftField] ?? '');
      const rightRows = rightIndex.get(key) || [];

      if (rightRows.length > 0) {
        for (const rightRow of rightRows) {
          const merged: any = {};
          // 添加左表字段（带前缀避免冲突）
          for (const [k, v] of Object.entries(leftRow)) {
            merged[`${leftPrefix}.${k}`] = v;
            merged[k] = v; // 也保留不带前缀的版本
          }
          // 添加右表字段
          for (const [k, v] of Object.entries(rightRow)) {
            merged[`${rightPrefix}.${k}`] = v;
            if (!(k in merged)) merged[k] = v; // 不覆盖已有字段
          }
          result.push(merged);
        }
      } else if (joinType === 'left') {
        // LEFT JOIN: 保留左表行，右表字段为 null
        const merged: any = {};
        for (const [k, v] of Object.entries(leftRow)) {
          merged[`${leftPrefix}.${k}`] = v;
          merged[k] = v;
        }
        result.push(merged);
      }
    }

    // RIGHT JOIN: 处理右表中没有匹配的行
    if (joinType === 'right') {
      const leftIndex = new Set(leftData.map(row => String(row[leftField] ?? '')));
      for (const rightRow of rightData) {
        const key = String(rightRow[rightField] ?? '');
        if (!leftIndex.has(key)) {
          const merged: any = {};
          for (const [k, v] of Object.entries(rightRow)) {
            merged[`${rightPrefix}.${k}`] = v;
            merged[k] = v;
          }
          result.push(merged);
        }
      }
    }

    return result;
  }

  // SQL-like 查询（支持多表JOIN和中文字段名）
  async executeQuery(sql: string): Promise<QueryResult> {
    try {
      if (this.tables.size === 0) await this.connect();
      
      // 解析主表名和别名
      const fromMatch = sql.match(/from\s+[`"]?([a-zA-Z0-9_\u4e00-\u9fa5]+)[`"]?(?:\s+(?:as\s+)?([a-zA-Z0-9_]+))?/i);
      const mainTable = fromMatch ? fromMatch[1] : null;
      const mainAlias = fromMatch ? (fromMatch[2] || fromMatch[1]) : null;
      
      let data: any[];
      
      if (mainTable && this.tables.has(mainTable)) {
        data = [...this.tables.get(mainTable)!];
      } else {
        // 默认使用第一个表
        const firstTable = this.tables.values().next().value;
        data = firstTable ? [...firstTable] : [];
      }
      
      console.log('File query - main table:', mainTable, 'alias:', mainAlias, 'total rows:', data.length);
      
      // 解析并执行 JOIN
      const joins = this.parseJoins(sql);
      if (joins.length > 0) {
        console.log('Found JOINs:', joins);
        
        for (const join of joins) {
          const joinTable = this.tables.get(join.table);
          if (!joinTable) {
            console.warn(`JOIN table not found: ${join.table}`);
            continue;
          }
          
          const onCondition = this.parseOnCondition(join.on);
          if (!onCondition) {
            console.warn(`Invalid ON condition: ${join.on}`);
            continue;
          }
          
          // 确定左右表的字段
          let leftField = onCondition.leftField;
          let rightField = onCondition.rightField;
          
          // 如果条件中的表名/别名与 join 表匹配，交换左右
          if (onCondition.leftTable === join.table || onCondition.leftTable === join.alias) {
            [leftField, rightField] = [rightField, leftField];
          }
          
          console.log(`Executing ${join.type} JOIN on ${leftField} = ${rightField}`);
          
          data = this.executeJoin(
            data,
            joinTable,
            leftField,
            rightField,
            join.type,
            mainAlias || mainTable || 'main',
            join.alias || join.table
          );
          
          console.log('After JOIN:', data.length, 'rows');
        }
      }
      
      const lowerSql = sql.toLowerCase();
      let result = data;

      // 解析WHERE条件（支持中文字段名）
      const whereMatch = sql.match(/where\s+(.+?)(?:\s+group|\s+order|\s+limit|$)/i);
      if (whereMatch) {
        const condition = whereMatch[1].trim();
        result = this.applyWhere(result, condition);
        console.log('After WHERE:', result.length, 'rows');
      }

      // 解析GROUP BY（支持中文字段名和多个字段）
      const groupMatch = sql.match(/group\s+by\s+(.+?)(?:\s+order|\s+limit|$)/i);
      const groupByFields = groupMatch ? groupMatch[1].trim().split(',').map(f => f.trim()) : [];

      // 解析SELECT字段和聚合函数
      const selectMatch = sql.match(/select\s+(.+?)\s+from/i);
      const selectFields = selectMatch ? selectMatch[1].trim() : '*';

      // 检查是否有聚合函数
      const hasAggregation = /\b(count|sum|avg|max|min)\s*\(/i.test(selectFields);

      console.log('SELECT fields:', selectFields, 'hasAggregation:', hasAggregation, 'groupBy:', groupByFields.join(', '));

      if (hasAggregation) {
        result = this.applyAggregation(result, selectFields, groupByFields);
        console.log('After aggregation:', result.length, 'rows', result);
      }

      // 解析ORDER BY（支持中文字段名和别名）
      const orderMatch = sql.match(/order\s+by\s+([a-zA-Z0-9_\u4e00-\u9fa5.]+)(?:\s+(asc|desc))?/i);
      if (orderMatch) {
        const field = orderMatch[1];
        const desc = orderMatch[2]?.toLowerCase() === 'desc';
        result.sort((a, b) => {
          const aVal = a[field] ?? 0;
          const bVal = b[field] ?? 0;
          const cmp = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
          return desc ? -cmp : cmp;
        });
      }

      // 解析LIMIT
      const limitMatch = lowerSql.match(/limit\s+(\d+)/);
      if (limitMatch) {
        result = result.slice(0, parseInt(limitMatch[1]));
      }

      console.log('Final result:', result.length, 'rows');
      return { success: true, data: result, sql, rowCount: result.length };
    } catch (error: any) {
      console.error('File query error:', error);
      return { success: false, error: error.message, sql };
    }
  }

  // 应用聚合函数（支持中文字段名和多个分组字段）
  private applyAggregation(data: any[], selectFields: string, groupByFields: string[] = []): any[] {
    const aggregations: { alias: string; func: string; field: string }[] = [];
    // 支持中文字段名的正则
    const aggRegex = /(count|sum|avg|max|min)\s*\(\s*(\*|[a-zA-Z0-9_\u4e00-\u9fa5]+)\s*\)(?:\s+as\s+([a-zA-Z0-9_\u4e00-\u9fa5]+))?/gi;
    let match;
    while ((match = aggRegex.exec(selectFields)) !== null) {
      const func = match[1].toLowerCase();
      const field = match[2];
      const alias = match[3] || (func === 'count' ? 'count' : `${func}_${field}`);
      aggregations.push({ alias, func, field });
      console.log('Found aggregation:', func, field, 'as', alias);
    }

    if (aggregations.length === 0) {
      console.log('No aggregations found in:', selectFields);
      return data;
    }

    if (groupByFields.length > 0) {
      const groups = new Map<string, any[]>();
      for (const row of data) {
        // 使用所有分组字段的组合作为key
        const keyParts = groupByFields.map(f => String(row[f] ?? 'null'));
        const key = keyParts.join('|||');  // 使用特殊分隔符避免冲突
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      }
      console.log('Groups count:', groups.size, 'fields:', groupByFields.join(', '));

      const result: any[] = [];
      for (const [key, rows] of groups) {
        // 解析组合key，恢复各个字段的值
        const keyParts = key.split('|||');
        const row: any = {};
        groupByFields.forEach((f, i) => {
          row[f] = keyParts[i];
        });
        for (const agg of aggregations) {
          row[agg.alias] = this.calculateAggregation(rows, agg.func, agg.field);
        }
        result.push(row);
      }
      return result;
    }

    const row: any = {};
    for (const agg of aggregations) {
      row[agg.alias] = this.calculateAggregation(data, agg.func, agg.field);
    }
    return [row];
  }

  private calculateAggregation(data: any[], func: string, field: string): number {
    if (func === 'count') return data.length;
    
    const values = data.map(row => parseFloat(row[field])).filter(v => !isNaN(v));
    if (values.length === 0) return 0;

    switch (func) {
      case 'sum': return values.reduce((a, b) => a + b, 0);
      case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
      case 'max': return Math.max(...values);
      case 'min': return Math.min(...values);
      default: return 0;
    }
  }

  private applyWhere(data: any[], condition: string): any[] {
    // 支持中文字段名的正则
    const fieldPattern = '[a-zA-Z0-9_\u4e00-\u9fa5]+';
    
    const notNullMatch = condition.match(new RegExp(`(${fieldPattern})\\s+is\\s+not\\s+null`, 'i'));
    if (notNullMatch) {
      const field = notNullMatch[1];
      return data.filter(row => row[field] !== null && row[field] !== undefined && row[field] !== '');
    }
    
    const eqMatch = condition.match(new RegExp(`(${fieldPattern})\\s*=\\s*['"]?([^'"]+)['"]?`));
    if (eqMatch) {
      const [, field, value] = eqMatch;
      console.log('WHERE filter:', field, '=', value);
      return data.filter(row => String(row[field]) === value);
    }
    
    const likeMatch = condition.match(new RegExp(`(${fieldPattern})\\s+like\\s+['"]%?([^%'"]+)%?['"]`, 'i'));
    if (likeMatch) {
      const [, field, value] = likeMatch;
      return data.filter(row => String(row[field]).includes(value));
    }
    return data;
  }
}
