/**
 * 爬虫管理服务
 * 
 * 功能：
 * - 模板管理（CRUD）
 * - 任务管理（查询、切换状态）
 * - 结果管理（查询、删除）
 * - 技能执行
 */

import { pool } from '../../../src/admin/core/database';
import { v4 as uuidv4 } from 'uuid';
import {
  CrawlerTemplate,
  CrawlerTask,
  CrawlerResult,
  CrawlerResultRow,
  SaveTemplateRequest,
  ExecuteSkillRequest
} from './types';

export class CrawlerManagementService {
  /**
   * 获取用户的所有模板
   */
  async getTemplates(userId: string): Promise<CrawlerTemplate[]> {
    const [rows] = await pool.execute(
      'SELECT * FROM crawler_templates WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    const templates: CrawlerTemplate[] = [];
    for (const row of rows as any[]) {
      const [fields] = await pool.execute(
        'SELECT field_name as name, field_selector as selector FROM crawler_template_fields WHERE template_id = ?',
        [row.id]
      );

      templates.push({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        url: row.url,
        department: row.department,
        data_type: row.data_type,
        containerSelector: row.container_selector,
        paginationEnabled: Boolean(row.pagination_enabled),
        paginationNextSelector: row.pagination_next_selector,
        paginationMaxPages: row.pagination_max_pages,
        paginationUrlPattern: row.pagination_url_pattern,
        fields: fields as any[],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      });
    }

    return templates;
  }

  /**
   * 获取单个模板详情
   */
  async getTemplate(id: string): Promise<CrawlerTemplate | null> {
    const [rows] = await pool.execute(
      'SELECT * FROM crawler_templates WHERE id = ?',
      [id]
    );

    const row = (rows as any[])[0];
    if (!row) return null;

    const [fields] = await pool.execute(
      'SELECT field_name as name, field_selector as selector FROM crawler_template_fields WHERE template_id = ?',
      [id]
    );

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      url: row.url,
      department: row.department,
      data_type: row.data_type,
      containerSelector: row.container_selector || '',
      paginationEnabled: Boolean(row.pagination_enabled),
      paginationNextSelector: row.pagination_next_selector,
      paginationMaxPages: row.pagination_max_pages,
      paginationUrlPattern: row.pagination_url_pattern,
      fields: fields as any[],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * 保存模板
   */
  async saveTemplate(userId: string, data: SaveTemplateRequest): Promise<string> {
    const id = uuidv4();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 插入模板
      await connection.execute(
        `INSERT INTO crawler_templates 
         (id, user_id, name, url, department, data_type, container_selector, pagination_enabled, pagination_next_selector, pagination_max_pages, pagination_url_pattern) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          userId,
          data.name,
          data.url,
          data.department || '',
          data.data_type || '',
          data.selectors?.container || (data as any).containerSelector || null,
          (data as any).paginationEnabled ? 1 : (data.selectors?.pagination?.enabled ? 1 : 0),
          (data as any).paginationNextSelector || data.selectors?.pagination?.next_selector || null,
          (data as any).paginationMaxPages || data.selectors?.pagination?.max_pages || 1,
          (data as any).paginationUrlPattern || data.selectors?.pagination?.url_pattern || null
        ]
      );

      // 插入字段
      const fields = Object.entries(data.selectors.fields);
      for (const [name, selector] of fields) {
        await connection.execute(
          'INSERT INTO crawler_template_fields (id, template_id, field_name, field_selector) VALUES (?, ?, ?, ?)',
          [uuidv4(), id, name, selector]
        );
      }

      await connection.commit();
      return id;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 更新模板
   */
  async updateTemplate(id: string, userId: string, data: any): Promise<void> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 验证权限
      const [rows] = await connection.execute(
        'SELECT user_id FROM crawler_templates WHERE id = ?',
        [id]
      );

      if ((rows as any[]).length === 0) {
        throw new Error('模板不存在');
      }

      if ((rows as any[])[0].user_id !== userId) {
        throw new Error('无权更新此模板');
      }

      // 更新基本信息
      // 注意：这里需要处理下划线和驼峰命名的兼容，数据库是下划线
      const updateFields: string[] = [];
      const updateValues: any[] = [];

      if (data.name) { updateFields.push('name = ?'); updateValues.push(data.name); }
      if (data.url) { updateFields.push('url = ?'); updateValues.push(data.url); }
      if (data.department !== undefined) { updateFields.push('department = ?'); updateValues.push(data.department); }
      if (data.data_type !== undefined || data.dataType !== undefined) {
        updateFields.push('data_type = ?');
        updateValues.push(data.data_type || data.dataType);
      }
      if (data.selectors?.container !== undefined || data.containerSelector !== undefined) {
        updateFields.push('container_selector = ?');
        updateValues.push(data.selectors?.container || data.containerSelector);
      }

      // 分页相关字段
      if (data.selectors?.pagination || (data as any).paginationEnabled !== undefined) {
        updateFields.push('pagination_enabled = ?');
        updateValues.push((data as any).paginationEnabled ? 1 : (data.selectors?.pagination?.enabled ? 1 : 0));
        updateFields.push('pagination_next_selector = ?');
        updateValues.push((data as any).paginationNextSelector || data.selectors?.pagination?.next_selector || null);
        updateFields.push('pagination_max_pages = ?');
        updateValues.push((data as any).paginationMaxPages || data.selectors?.pagination?.max_pages || 1);
        updateFields.push('pagination_url_pattern = ?');
        updateValues.push((data as any).paginationUrlPattern || data.selectors?.pagination?.url_pattern || null);
      }

      updateFields.push('updated_at = NOW()');

      if (updateFields.length > 0) {
        updateValues.push(id); // Where cause
        await connection.execute(
          `UPDATE crawler_templates SET ${updateFields.join(', ')} WHERE id = ?`,
          updateValues
        );
      }

      // 更新字段 (策略：先删后加)
      // 兼容两种格式：selectors.fields (kv对象) 或 fields (对象数组)
      let fieldsToUpdate: { name: string, selector: string }[] = [];

      if (data.selectors?.fields) {
        fieldsToUpdate = Object.entries(data.selectors.fields).map(([k, v]) => ({ name: k, selector: String(v) }));
      } else if (Array.isArray(data.fields)) {
        fieldsToUpdate = data.fields;
      }

      if (fieldsToUpdate.length > 0) {
        // 删除旧字段
        await connection.execute(
          'DELETE FROM crawler_template_fields WHERE template_id = ?',
          [id]
        );

        // 插入新字段
        for (const field of fieldsToUpdate) {
          await connection.execute(
            'INSERT INTO crawler_template_fields (id, template_id, field_name, field_selector) VALUES (?, ?, ?, ?)',
            [uuidv4(), id, field.name, field.selector]
          );
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 删除模板
   */
  async deleteTemplate(id: string, userId: string): Promise<void> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 验证权限
      const [rows] = await connection.execute(
        'SELECT user_id FROM crawler_templates WHERE id = ?',
        [id]
      );

      if ((rows as any[]).length === 0) {
        throw new Error('模板不存在');
      }

      if ((rows as any[])[0].user_id !== userId) {
        throw new Error('无权删除此模板');
      }

      // 删除字段
      await connection.execute(
        'DELETE FROM crawler_template_fields WHERE template_id = ?',
        [id]
      );

      // 删除模板
      await connection.execute(
        'DELETE FROM crawler_templates WHERE id = ?',
        [id]
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 获取用户的所有任务
   */
  async getTasks(userId: string): Promise<CrawlerTask[]> {
    const [rows] = await pool.execute(
      `SELECT t.*, COALESCE(tmp.name, '未知模板') as template_name
       FROM crawler_tasks t
       LEFT JOIN crawler_templates tmp ON t.template_id = tmp.id
       WHERE t.user_id = ? 
       ORDER BY t.created_at DESC`,
      [userId]
    );

    return (rows as any[]).map(row => ({
      id: row.id,
      userId: row.user_id,
      templateId: row.template_id,
      templateName: row.template_name,
      name: row.name,
      frequency: row.frequency,
      status: row.status,
      nextRunAt: row.next_run_at,
      lastRunAt: row.last_run_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  /**
   * 切换任务状态
   */
  async toggleTask(id: string, userId: string, status: 'active' | 'paused'): Promise<void> {
    // 验证权限
    const [rows] = await pool.execute(
      'SELECT user_id FROM crawler_tasks WHERE id = ?',
      [id]
    );

    if ((rows as any[]).length === 0) {
      throw new Error('任务不存在');
    }

    if ((rows as any[])[0].user_id !== userId) {
      throw new Error('无权操作此任务');
    }

    // 更新状态
    await pool.execute(
      'UPDATE crawler_tasks SET status = ?, updated_at = NOW() WHERE id = ?',
      [status, id]
    );
  }

  /**
   * 获取采集结果列表
   */
  async getResults(userId: string, limit: number = 20): Promise<CrawlerResult[]> {
    // 使用字符串拼接limit，因为MySQL的prepared statement不支持LIMIT参数
    const [rows] = await pool.query(
      `SELECT r.*, 
              COALESCE(t.name, '未知模板') as template_name,
              t.department,
              t.data_type
       FROM crawler_results r
       LEFT JOIN crawler_templates t ON r.template_id = t.id
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC 
       LIMIT ${parseInt(String(limit))}`,
      [userId]
    );

    return (rows as any[]).map(row => ({
      id: row.id,
      userId: row.user_id,
      templateId: row.template_id,
      template_name: row.template_name,
      department: row.department,
      data_type: row.data_type,
      createdAt: row.created_at
    }));
  }

  /**
   * 获取采集结果详情
   */
  async getResultDetails(id: string, userId: string): Promise<CrawlerResultRow[]> {
    // 验证权限
    const [resultRows] = await pool.execute(
      'SELECT user_id FROM crawler_results WHERE id = ?',
      [id]
    );

    if ((resultRows as any[]).length === 0) {
      throw new Error('结果不存在');
    }

    if ((resultRows as any[])[0].user_id !== userId) {
      throw new Error('无权查看此结果');
    }

    // 获取所有行
    const [rows] = await pool.execute(
      'SELECT * FROM crawler_result_rows WHERE result_id = ? ORDER BY created_at ASC',
      [id]
    );

    const fullRows: CrawlerResultRow[] = [];
    for (const row of rows as any[]) {
      const [items] = await pool.execute(
        'SELECT field_name, field_value FROM crawler_result_items WHERE row_id = ?',
        [row.id]
      );

      const rowData: Record<string, any> = {
        id: row.id,
        created_at: row.created_at
      };

      (items as any[]).forEach((item: any) => {
        rowData[item.field_name] = item.field_value;
      });

      fullRows.push({
        id: row.id,
        resultId: id,
        data: rowData,
        createdAt: row.created_at
      });
    }

    return fullRows;
  }

  /**
   * 删除采集结果
   */
  async deleteResult(id: string, userId: string): Promise<void> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 验证权限
      const [rows] = await connection.execute(
        'SELECT user_id FROM crawler_results WHERE id = ?',
        [id]
      );

      if ((rows as any[]).length === 0) {
        throw new Error('结果不存在');
      }

      if ((rows as any[])[0].user_id !== userId) {
        throw new Error('无权删除此结果');
      }

      // 删除明细数据
      await connection.execute(
        'DELETE FROM crawler_result_items WHERE row_id IN (SELECT id FROM crawler_result_rows WHERE result_id = ?)',
        [id]
      );

      // 删除行数据
      await connection.execute(
        'DELETE FROM crawler_result_rows WHERE result_id = ?',
        [id]
      );

      // 删除结果记录
      await connection.execute(
        'DELETE FROM crawler_results WHERE id = ?',
        [id]
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 执行技能
   */
  async executeSkill(userId: string, request: ExecuteSkillRequest): Promise<any> {
    console.log(`[CrawlerManagement] executeSkill called manually for: ${request.skill}`);
    // 使用模块化路径加载爬虫技能
    const { crawlerSkills } = await import('../../ai-crawler-assistant/backend/skills/index');

    // 查找对应的技能
    const skill = crawlerSkills.find(s => s.name === request.skill);
    if (!skill) {
      throw new Error(`未找到技能: ${request.skill}`);
    }

    // 执行技能
    const context = {
      userId,
      openai: undefined,
      model: undefined
    };

    // 如果提供了 templateId，获取模板配置并注入到 params 中
    let finalParams = { ...request.params };
    if (finalParams.templateId) {
      const template = await this.getTemplate(finalParams.templateId);
      if (template) {
        // 确保技能实现能拿到这些分页配置
        (finalParams as any).paginationConfig = {
          enabled: template.paginationEnabled,
          next_selector: template.paginationNextSelector,
          max_pages: template.paginationMaxPages,
          url_pattern: template.paginationUrlPattern
        };
      }
    }

    return await skill.execute(finalParams, context);
  }

  /**
   * 保存采集结果
   */
  async saveResults(userId: string, templateId: string, data: any[]): Promise<string> {
    const resultId = uuidv4();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 插入结果记录
      await connection.execute(
        'INSERT INTO crawler_results (id, user_id, template_id) VALUES (?, ?, ?)',
        [resultId, userId, templateId]
      );

      // 插入每一行数据
      for (const item of data) {
        const rowId = uuidv4();
        await connection.execute(
          'INSERT INTO crawler_result_rows (id, result_id) VALUES (?, ?)',
          [rowId, resultId]
        );

        // 插入字段值
        for (const [fieldName, fieldValue] of Object.entries(item)) {
          if (fieldName !== 'id' && fieldName !== 'created_at') {
            await connection.execute(
              'INSERT INTO crawler_result_items (id, row_id, field_name, field_value) VALUES (?, ?, ?, ?)',
              [uuidv4(), rowId, fieldName, String(fieldValue)]
            );
          }
        }
      }

      await connection.commit();
      return resultId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 渲染HTML表格
   */
  renderHtml(fields: string[], data: any[]): string {
    let html = '<table border="1" style="border-collapse: collapse; width: 100%;">';
    html += '<thead><tr>';
    fields.forEach(f => {
      html += `<th style="padding: 8px; background: #f0f0f0;">${f}</th>`;
    });
    html += '</tr></thead><tbody>';

    data.forEach(row => {
      html += '<tr>';
      fields.forEach(f => {
        const value = row[f] || '';
        html += `<td style="padding: 8px;">${value}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table>';
    return html;
  }
  /**
   * 获取所有采集结果行（Flattened View）
   */
  async getResultItems(userId: string, params: {
    page?: number;
    pageSize?: number;
    department?: string;
    dataType?: string;
    title?: string;
  }): Promise<{ items: any[]; total: number }> {
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const offset = (page - 1) * pageSize;

    // 构建WHERE条件
    let whereClause = 'r.result_id IN (SELECT id FROM crawler_results WHERE user_id = ?)';
    const queryParams: any[] = [userId];

    if (params.department) {
      whereClause += ' AND t.department LIKE ?';
      queryParams.push(`%${params.department}%`);
    }

    if (params.dataType) {
      whereClause += ' AND t.data_type LIKE ?';
      queryParams.push(`%${params.dataType}%`);
    }

    if (params.title) {
      // 标题过滤需要关联items表，这里使用EXISTS子查询提高性能
      whereClause += ` AND EXISTS (
        SELECT 1 FROM crawler_result_items i 
        WHERE i.row_id = r.id 
        AND (i.field_name = '标题' OR i.field_name = 'title') 
        AND i.field_value LIKE ?
      )`;
      queryParams.push(`%${params.title}%`);
    }

    // 查询总数
    const countSql = `
      SELECT COUNT(DISTINCT r.id) as total
      FROM crawler_result_rows r
      JOIN crawler_results res ON r.result_id = res.id
      LEFT JOIN crawler_templates t ON res.template_id = t.id
      WHERE ${whereClause}
    `;

    // 查询数据
    // 同时获取标题和链接，以便列表展示
    const dataSql = `
      SELECT r.id, r.created_at, 
             t.department, t.data_type,
             t.name as template_name,
             (SELECT field_value FROM crawler_result_items WHERE row_id = r.id AND (field_name = '标题' OR field_name = 'title') LIMIT 1) as title,
             (SELECT field_value FROM crawler_result_items WHERE row_id = r.id AND (field_name = '发布日期' OR field_name = 'date' OR field_name = 'publish_date' OR field_name = 'time') LIMIT 1) as publish_date,
             (SELECT field_value FROM crawler_result_items WHERE row_id = r.id AND (field_name = '链接' OR field_name = 'link' OR field_name = 'url') LIMIT 1) as link
      FROM crawler_result_rows r
      JOIN crawler_results res ON r.result_id = res.id
      LEFT JOIN crawler_templates t ON res.template_id = t.id
      WHERE ${whereClause}
      ORDER BY publish_date DESC, r.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const [countRows] = await pool.execute(countSql, queryParams);
    const total = (countRows as any[])[0]?.total || 0;

    const [rows] = await pool.execute(dataSql, queryParams);

    return {
      items: (rows as any[]).map(row => ({
        id: row.id,
        department: row.department,
        data_type: row.data_type,
        template_name: row.template_name,
        title: row.title,
        publish_date: row.publish_date,
        link: row.link,
        created_at: row.created_at
      })),
      total
    };
  }
  /**
   * 获取筛选选项（部门和数据类型）
   */
  async getFilterOptions(userId: string): Promise<{ departments: string[]; dataTypes: string[] }> {
    // 从模板表中获取唯一部门和数据类型
    const [deptRows] = await pool.execute(
      `SELECT DISTINCT department FROM crawler_templates WHERE department IS NOT NULL AND department != '' AND user_id = ?`,
      [userId]
    );

    const [typeRows] = await pool.execute(
      `SELECT DISTINCT data_type FROM crawler_templates WHERE data_type IS NOT NULL AND data_type != '' AND user_id = ?`,
      [userId]
    );

    // 也从结果表中尝试获取（针对手动运行可能有记录的情况，虽然目前结构主要依赖模板）
    // 目前手动运行没有department字段记录在Results表，只在Items里。
    // 为了性能，暂时只查询模板表配置。

    return {
      departments: (deptRows as any[]).map(row => row.department),
      dataTypes: (typeRows as any[]).map(row => row.data_type)
    };
  }
}

export const crawlerManagementService = new CrawlerManagementService();
