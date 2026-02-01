/**
 * 采集模板配置服务
 */

import { PoolConnection } from 'mysql2/promise';
import {
  CrawlerTemplate,
  CreateTemplateDto,
  UpdateTemplateDto,
  TestTemplateDto,
  PreviewDataDto,
  ValidateSelectorDto,
  AIAnalyzeDto,
  DiagnoseDto,
  CrawlerTestResult,
  SelectorValidationResult,
  AIAnalysisResult,
  DiagnosisResult
} from './types';

export class CrawlerTemplateConfigService {
  private tableName: string;

  constructor(tableName: string = 'crawler_templates') {
    this.tableName = tableName;
  }

  /**
   * 获取所有采集模板
   */
  async getTemplates(connection: PoolConnection): Promise<CrawlerTemplate[]> {
    const [rows] = await connection.query<any[]>(
      `SELECT * FROM ${this.tableName} ORDER BY created_at DESC`
    );
    return rows.map(row => this.formatTemplate(row));
  }

  /**
   * 根据ID获取采集模板
   */
  async getTemplate(connection: PoolConnection, id: number): Promise<CrawlerTemplate | null> {
    const [rows] = await connection.query<any[]>(
      `SELECT * FROM ${this.tableName} WHERE id = ?`,
      [id]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    return this.formatTemplate(rows[0]);
  }

  /**
   * 创建采集模板
   */
  async createTemplate(
    connection: PoolConnection,
    data: CreateTemplateDto,
    userId: number
  ): Promise<CrawlerTemplate> {
    // 数据验证
    if (!data.name || !data.url || !data.containerSelector) {
      throw new Error('Missing required fields: name, url, containerSelector');
    }

    const [result] = await connection.query<any>(
      `INSERT INTO ${this.tableName} (
        name, department, data_type, url, container_selector, fields,
        pagination_enabled, pagination_next_selector, pagination_max_pages,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        data.name,
        data.department || null,
        data.dataType || null,
        data.url,
        data.containerSelector,
        JSON.stringify(data.fields),
        data.paginationEnabled || false,
        data.paginationNextSelector || null,
        data.paginationMaxPages || 50,
        userId
      ]
    );

    const template = await this.getTemplate(connection, result.insertId);
    if (!template) {
      throw new Error('Failed to create template');
    }

    return template;
  }

  /**
   * 更新采集模板
   */
  async updateTemplate(
    connection: PoolConnection,
    id: number,
    data: UpdateTemplateDto
  ): Promise<CrawlerTemplate> {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.department !== undefined) {
      updates.push('department = ?');
      values.push(data.department);
    }
    if (data.dataType !== undefined) {
      updates.push('data_type = ?');
      values.push(data.dataType);
    }
    if (data.url !== undefined) {
      updates.push('url = ?');
      values.push(data.url);
    }
    if (data.containerSelector !== undefined) {
      updates.push('container_selector = ?');
      values.push(data.containerSelector);
    }
    if (data.fields !== undefined) {
      updates.push('fields = ?');
      values.push(JSON.stringify(data.fields));
    }
    if (data.paginationEnabled !== undefined) {
      updates.push('pagination_enabled = ?');
      values.push(data.paginationEnabled);
    }
    if (data.paginationNextSelector !== undefined) {
      updates.push('pagination_next_selector = ?');
      values.push(data.paginationNextSelector);
    }
    if (data.paginationMaxPages !== undefined) {
      updates.push('pagination_max_pages = ?');
      values.push(data.paginationMaxPages);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    updates.push('updated_at = NOW()');
    values.push(id);

    await connection.query(
      `UPDATE ${this.tableName} SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const template = await this.getTemplate(connection, id);
    if (!template) {
      throw new Error('Template not found');
    }

    return template;
  }

  /**
   * 删除采集模板
   */
  async deleteTemplate(connection: PoolConnection, id: number): Promise<void> {
    await connection.query(`DELETE FROM ${this.tableName} WHERE id = ?`, [id]);
  }

  /**
   * 测试采集模板
   */
  async testTemplate(
    connection: PoolConnection,
    data: TestTemplateDto
  ): Promise<CrawlerTestResult> {
    try {
      // 调用Python爬虫服务进行测试
      const response = await fetch('http://localhost:5000/api/crawler/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: data.url,
          selectors: data.selectors,
          pagination: data.pagination
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      return {
        success: result.success || false,
        count: result.count || 0,
        data: result.data || [],
        message: result.message || '测试完成'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '测试失败'
      };
    }
  }

  /**
   * 预览采集数据
   */
  async previewData(
    connection: PoolConnection,
    data: PreviewDataDto
  ): Promise<CrawlerTestResult> {
    try {
      const response = await fetch('http://localhost:5000/api/crawler/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: data.url,
          selectors: data.selectors,
          limit: data.limit || 10
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      return {
        success: result.success || false,
        count: result.count || 0,
        data: result.data || []
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '预览失败'
      };
    }
  }

  /**
   * 验证选择器
   */
  async validateSelector(
    connection: PoolConnection,
    data: ValidateSelectorDto
  ): Promise<SelectorValidationResult> {
    try {
      const response = await fetch('http://localhost:5000/api/crawler/validate-selector', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: data.url,
          selector: data.selector
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      return {
        valid: result.valid || false,
        count: result.count || 0,
        samples: result.samples || []
      };
    } catch (error: any) {
      return {
        valid: false,
        error: error.message || '验证失败'
      };
    }
  }

  /**
   * AI智能分析
   */
  async aiAnalyze(
    connection: PoolConnection,
    data: AIAnalyzeDto
  ): Promise<AIAnalysisResult> {
    try {
      const response = await fetch('http://localhost:5000/api/crawler/ai-analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: data.url,
          dataType: data.dataType
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      return {
        success: result.success || false,
        containerSelector: result.containerSelector,
        fields: result.fields || []
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'AI分析失败'
      };
    }
  }

  /**
   * 诊断采集问题
   */
  async diagnose(
    connection: PoolConnection,
    data: DiagnoseDto
  ): Promise<DiagnosisResult> {
    try {
      const response = await fetch('http://localhost:5000/api/crawler/diagnose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: data.url,
          containerSelector: data.containerSelector,
          fields: data.fields
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      return {
        success: result.success || false,
        issues: result.issues || [],
        suggestions: result.suggestions || [],
        strategy: result.strategy
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '诊断失败'
      };
    }
  }

  /**
   * 格式化模板数据
   */
  private formatTemplate(row: any): CrawlerTemplate {
    return {
      id: row.id,
      name: row.name,
      department: row.department,
      data_type: row.data_type,
      url: row.url,
      container_selector: row.container_selector,
      fields: typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields,
      pagination_enabled: Boolean(row.pagination_enabled),
      pagination_next_selector: row.pagination_next_selector,
      pagination_max_pages: row.pagination_max_pages,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by
    };
  }
}
