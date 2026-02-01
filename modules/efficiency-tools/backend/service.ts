/**
 * 效率工具服务
 */

import { format as formatSql } from 'sql-formatter';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import type {
  SqlFormatRequest,
  SqlFormatResponse,
  DataConvertRequest,
  DataConvertResponse,
  RegexTestRequest,
  RegexTestResponse,
  RegexMatch,
  UserTemplate,
  TemplateQueryParams,
  TemplateQueryResult,
  EfficiencyToolsConfig
} from './types';

export class EfficiencyToolsService {
  private db: any;
  private config: EfficiencyToolsConfig;

  constructor(db: any, config?: Partial<EfficiencyToolsConfig>) {
    this.db = db;
    this.config = {
      enableSqlFormatter: true,
      enableDataConverter: true,
      enableRegexHelper: true,
      enableTemplates: true,
      maxInputSize: 10 * 1024 * 1024, // 10MB
      defaultSqlLanguage: 'mysql',
      defaultIndent: '  ',
      ...config
    };
  }

  /**
   * SQL 格式化
   */
  async formatSql(request: SqlFormatRequest): Promise<SqlFormatResponse> {
    if (!this.config.enableSqlFormatter) {
      return {
        success: false,
        error: 'SQL格式化功能未启用'
      };
    }

    try {
      const { sql, language, indent, uppercase, linesBetweenQueries } = request;

      if (!sql || sql.trim().length === 0) {
        return {
          success: false,
          error: '请输入SQL语句'
        };
      }

      if (sql.length > this.config.maxInputSize) {
        return {
          success: false,
          error: `输入内容过大，最大支持 ${this.config.maxInputSize / 1024 / 1024}MB`
        };
      }

      const formatted = formatSql(sql, {
        language: language || this.config.defaultSqlLanguage,
        indent: indent || this.config.defaultIndent,
        uppercase: uppercase !== undefined ? uppercase : false,
        linesBetweenQueries: linesBetweenQueries || 1
      });

      return {
        success: true,
        formatted
      };
    } catch (error: any) {
      console.error('SQL格式化错误:', error);
      return {
        success: false,
        error: error.message || 'SQL格式化失败'
      };
    }
  }

  /**
   * 数据转换
   */
  async convertData(request: DataConvertRequest): Promise<DataConvertResponse> {
    if (!this.config.enableDataConverter) {
      return {
        success: false,
        error: '数据转换功能未启用'
      };
    }

    try {
      const { data, sourceFormat, targetFormat, options } = request;

      if (!data || data.trim().length === 0) {
        return {
          success: false,
          error: '请输入数据'
        };
      }

      if (data.length > this.config.maxInputSize) {
        return {
          success: false,
          error: `输入内容过大，最大支持 ${this.config.maxInputSize / 1024 / 1024}MB`
        };
      }

      let converted: string;

      // JSON 转换
      if (sourceFormat === 'json') {
        const jsonData = JSON.parse(data);
        
        if (targetFormat === 'csv') {
          converted = this.jsonToCsv(jsonData, options);
        } else if (targetFormat === 'excel') {
          converted = this.jsonToExcel(jsonData);
        } else if (targetFormat === 'xml') {
          converted = this.jsonToXml(jsonData);
        } else if (targetFormat === 'yaml') {
          converted = this.jsonToYaml(jsonData);
        } else {
          converted = options?.pretty ? JSON.stringify(jsonData, null, 2) : JSON.stringify(jsonData);
        }
      }
      // CSV 转换
      else if (sourceFormat === 'csv') {
        const csvData = this.parseCsv(data, options);
        
        if (targetFormat === 'json') {
          converted = JSON.stringify(csvData, null, options?.pretty ? 2 : 0);
        } else if (targetFormat === 'excel') {
          converted = this.jsonToExcel(csvData);
        } else {
          converted = data;
        }
      }
      // Excel 转换 (base64)
      else if (sourceFormat === 'excel') {
        return {
          success: false,
          error: 'Excel转换需要上传文件'
        };
      }
      // XML 转换
      else if (sourceFormat === 'xml') {
        const xmlData = this.parseXml(data);
        
        if (targetFormat === 'json') {
          converted = JSON.stringify(xmlData, null, options?.pretty ? 2 : 0);
        } else {
          converted = data;
        }
      }
      // YAML 转换
      else if (sourceFormat === 'yaml') {
        const yamlData = this.parseYaml(data);
        
        if (targetFormat === 'json') {
          converted = JSON.stringify(yamlData, null, options?.pretty ? 2 : 0);
        } else {
          converted = data;
        }
      }
      else {
        return {
          success: false,
          error: '不支持的格式转换'
        };
      }

      return {
        success: true,
        converted
      };
    } catch (error: any) {
      console.error('数据转换错误:', error);
      return {
        success: false,
        error: error.message || '数据转换失败'
      };
    }
  }

  /**
   * 正则测试
   */
  async testRegex(request: RegexTestRequest): Promise<RegexTestResponse> {
    if (!this.config.enableRegexHelper) {
      return {
        success: false,
        error: '正则助手功能未启用'
      };
    }

    try {
      const { pattern, text, flags } = request;

      if (!pattern) {
        return {
          success: false,
          error: '请输入正则表达式'
        };
      }

      if (!text) {
        return {
          success: false,
          error: '请输入测试文本'
        };
      }

      const regex = new RegExp(pattern, flags || 'g');
      const matches: RegexMatch[] = [];
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        matches.push({
          match: match[0],
          index: match.index,
          groups: match.slice(1)
        });

        // 防止无限循环
        if (!flags?.includes('g')) break;
      }

      return {
        success: true,
        matches
      };
    } catch (error: any) {
      console.error('正则测试错误:', error);
      return {
        success: false,
        error: error.message || '正则表达式无效'
      };
    }
  }

  /**
   * JSON 转 CSV
   */
  private jsonToCsv(data: any, options?: any): string {
    const array = Array.isArray(data) ? data : [data];
    if (array.length === 0) return '';

    const headers = Object.keys(array[0]);
    const delimiter = options?.delimiter || ',';
    
    let csv = options?.headers !== false ? headers.join(delimiter) + '\n' : '';
    
    for (const row of array) {
      const values = headers.map(header => {
        const value = row[header];
        const str = value === null || value === undefined ? '' : String(value);
        return str.includes(delimiter) || str.includes('"') || str.includes('\n') 
          ? `"${str.replace(/"/g, '""')}"` 
          : str;
      });
      csv += values.join(delimiter) + '\n';
    }

    return csv;
  }

  /**
   * JSON 转 Excel (返回 base64)
   */
  private jsonToExcel(data: any): string {
    const array = Array.isArray(data) ? data : [data];
    const worksheet = XLSX.utils.json_to_sheet(array);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer.toString('base64');
  }

  /**
   * JSON 转 XML
   */
  private jsonToXml(data: any, rootName: string = 'root'): string {
    const buildXml = (obj: any, indent: string = ''): string => {
      if (typeof obj !== 'object' || obj === null) {
        return String(obj);
      }

      let xml = '';
      for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            xml += `${indent}<${key}>${buildXml(item, indent + '  ')}</${key}>\n`;
          }
        } else if (typeof value === 'object' && value !== null) {
          xml += `${indent}<${key}>\n${buildXml(value, indent + '  ')}${indent}</${key}>\n`;
        } else {
          xml += `${indent}<${key}>${value}</${key}>\n`;
        }
      }
      return xml;
    };

    return `<?xml version="1.0" encoding="UTF-8"?>\n<${rootName}>\n${buildXml(data, '  ')}</${rootName}>`;
  }

  /**
   * JSON 转 YAML
   */
  private jsonToYaml(data: any, indent: number = 0): string {
    const spaces = '  '.repeat(indent);
    
    if (typeof data !== 'object' || data === null) {
      return String(data);
    }

    if (Array.isArray(data)) {
      return data.map(item => `${spaces}- ${this.jsonToYaml(item, indent + 1)}`).join('\n');
    }

    let yaml = '';
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'object' && value !== null) {
        yaml += `${spaces}${key}:\n${this.jsonToYaml(value, indent + 1)}\n`;
      } else {
        yaml += `${spaces}${key}: ${value}\n`;
      }
    }
    return yaml;
  }

  /**
   * 解析 CSV
   */
  private parseCsv(csv: string, options?: any): any[] {
    const delimiter = options?.delimiter || ',';
    const lines = csv.trim().split('\n');
    
    if (lines.length === 0) return [];

    const headers = lines[0].split(delimiter).map(h => h.trim());
    const result: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map(v => v.trim());
      const obj: any = {};
      
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = values[j] || '';
      }
      
      result.push(obj);
    }

    return result;
  }

  /**
   * 解析 XML (简单实现)
   */
  private parseXml(xml: string): any {
    // 简单的 XML 解析，实际项目中应使用专业库
    return { xml: xml.trim() };
  }

  /**
   * 解析 YAML (简单实现)
   */
  private parseYaml(yaml: string): any {
    // 简单的 YAML 解析，实际项目中应使用专业库
    return { yaml: yaml.trim() };
  }

  /**
   * 创建模板
   */
  async createTemplate(template: Omit<UserTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserTemplate> {
    if (!this.config.enableTemplates) {
      throw new Error('模板功能未启用');
    }

    const id = uuidv4();
    const now = Date.now();
    const newTemplate: UserTemplate = {
      ...template,
      id,
      createdAt: now,
      updatedAt: now
    };

    const query = `
      INSERT INTO efficiency_templates 
      (id, user_id, type, name, content, description, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.run(query, [
      newTemplate.id,
      newTemplate.userId,
      newTemplate.type,
      newTemplate.name,
      newTemplate.content,
      newTemplate.description || null,
      newTemplate.tags ? JSON.stringify(newTemplate.tags) : null,
      newTemplate.createdAt,
      newTemplate.updatedAt
    ]);

    return newTemplate;
  }

  /**
   * 更新模板
   */
  async updateTemplate(id: string, userId: string, updates: Partial<UserTemplate>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.content) {
      fields.push('content = ?');
      values.push(updates.content);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.tags) {
      fields.push('tags = ?');
      values.push(JSON.stringify(updates.tags));
    }

    fields.push('updated_at = ?');
    values.push(Date.now());

    values.push(id, userId);

    const query = `UPDATE efficiency_templates SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`;
    await this.db.run(query, values);
  }

  /**
   * 删除模板
   */
  async deleteTemplate(id: string, userId: string): Promise<void> {
    const query = 'DELETE FROM efficiency_templates WHERE id = ? AND user_id = ?';
    await this.db.run(query, [id, userId]);
  }

  /**
   * 获取模板
   */
  async getTemplate(id: string, userId: string): Promise<UserTemplate | null> {
    const query = 'SELECT * FROM efficiency_templates WHERE id = ? AND user_id = ?';
    const row = await this.db.get(query, [id, userId]);

    if (!row) return null;

    return {
      ...row,
      tags: row.tags ? JSON.parse(row.tags) : []
    };
  }

  /**
   * 查询模板
   */
  async queryTemplates(params: TemplateQueryParams): Promise<TemplateQueryResult> {
    const { userId, type, keyword, page = 1, pageSize = 20 } = params;

    let whereClause = 'WHERE user_id = ?';
    const queryParams: any[] = [userId];

    if (type) {
      whereClause += ' AND type = ?';
      queryParams.push(type);
    }
    if (keyword) {
      whereClause += ' AND (name LIKE ? OR description LIKE ?)';
      queryParams.push(`%${keyword}%`, `%${keyword}%`);
    }

    // 获取总数
    const countQuery = `SELECT COUNT(*) as total FROM efficiency_templates ${whereClause}`;
    const countResult = await this.db.get(countQuery, queryParams);
    const total = countResult.total;

    // 获取数据
    const offset = (page - 1) * pageSize;
    const dataQuery = `
      SELECT * FROM efficiency_templates 
      ${whereClause}
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `;
    const rows = await this.db.all(dataQuery, [...queryParams, pageSize, offset]);

    const items = rows.map((row: any) => ({
      ...row,
      tags: row.tags ? JSON.parse(row.tags) : []
    }));

    return {
      total,
      page,
      pageSize,
      items
    };
  }
}
