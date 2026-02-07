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
         (id, user_id, name, url, department, data_type, container_selector) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          userId,
          data.name,
          data.url,
          data.department || '',
          data.data_type || '',
          data.selectors.container || null
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
              COALESCE(t.name, '未知模板') as template_name
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
      templateName: row.template_name,
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
    // 这里调用agent/skills中的爬虫技能
    const { crawlerSkills } = await import('../../../src/agent/skills/crawler/index');

    // 查找对应的技能
    const skill = crawlerSkills.find(s => s.name === request.skill);
    if (!skill) {
      throw new Error(`未找到技能: ${request.skill}`);
    }

    // 执行技能
    const context = {
      userId,
      openai: undefined, // 需要从AI配置模块获取
      model: undefined
    };

    return await skill.execute(request.params, context);
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
}

export const crawlerManagementService = new CrawlerManagementService();
