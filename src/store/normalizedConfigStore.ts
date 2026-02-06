/**
 * 标准化配置存储 - 支持分表存储的JSON数据
 * 替代原有的JSON字段存储方式
 */

import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import { DataSourceConfig } from '../types';

export interface NormalizedSchemaAnalysis {
  id: string;
  datasourceId: string;
  userId: string;
  analyzedAt: number;
  updatedAt: number;
  isUserEdited: boolean;
  tables: NormalizedTable[];
  suggestedQuestions: string[];
}

export interface NormalizedTable {
  id: string;
  tableName: string;
  tableNameCn?: string;
  tableComment?: string;
  rowCount: number;
  columns: NormalizedColumn[];
}

export interface NormalizedColumn {
  id: string;
  name: string;
  nameCn?: string;
  type: string;
  comment?: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue?: string;
}

export interface DatasourceConfigItem {
  id: string;
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'object';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  order: number;
}

export interface AuditLogDetail {
  id: string;
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'object';
}

export class NormalizedConfigStore {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'qinxin',
      database: process.env.DB_NAME || 'DataMind',
      charset: 'utf8mb4',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }

  // ========== 数据源配置管理 ==========

  /**
   * 保存数据源配置（分表存储）
   */
  async saveDatasourceConfig(datasourceId: string, config: Record<string, any>): Promise<void> {
    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // 删除旧配置
      await connection.execute(
        'DELETE FROM datasource_configs WHERE datasource_id = ?',
        [datasourceId]
      );

      // 插入新配置
      for (const [key, value] of Object.entries(config)) {
        let configType: string = 'string';
        let configValue: string = '';

        if (typeof value === 'number') {
          configType = 'number';
          configValue = value.toString();
        } else if (typeof value === 'boolean') {
          configType = 'boolean';
          configValue = value.toString();
        } else if (typeof value === 'object' && value !== null) {
          configType = 'object';
          configValue = JSON.stringify(value);
        } else {
          configValue = String(value);
        }

        await connection.execute(
          `INSERT INTO datasource_configs (id, datasource_id, config_key, config_value, config_type) 
           VALUES (?, ?, ?, ?, ?)`,
          [uuidv4(), datasourceId, key, configValue, configType]
        );
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
   * 获取数据源配置
   */
  async getDatasourceConfig(datasourceId: string): Promise<Record<string, any>> {
    const [rows] = await this.pool.execute(
      'SELECT config_key, config_value, config_type FROM datasource_configs WHERE datasource_id = ?',
      [datasourceId]
    ) as [DatasourceConfigItem[], any];

    const config: Record<string, any> = {};

    for (const row of rows) {
      let value: any = row.value;

      switch (row.type) {
        case 'number':
          value = parseFloat(row.value);
          break;
        case 'boolean':
          value = row.value === 'true';
          break;
        case 'object':
          try {
            value = JSON.parse(row.value);
          } catch {
            value = row.value;
          }
          break;
        default:
          value = row.value;
      }

      config[row.key] = value;
    }

    return config;
  }

  // ========== Schema分析管理 ==========

  /**
   * 保存Schema分析结果（分表存储）
   */
  async saveSchemaAnalysis(analysis: {
    datasourceId: string;
    tables: any[];
    suggestedQuestions: string[];
    analyzedAt: number;
    updatedAt: number;
    isUserEdited: boolean;
  }, userId: string): Promise<void> {
    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // 获取或创建分析记录
      let analysisId: string;
      const [existing] = await connection.execute(
        'SELECT id FROM schema_analysis WHERE user_id = ? AND datasource_id = ?',
        [userId, analysis.datasourceId]
      ) as [any[], any];

      if (existing.length > 0) {
        analysisId = existing[0].id;
        
        // 更新主记录
        await connection.execute(
          `UPDATE schema_analysis 
           SET analyzed_at = FROM_UNIXTIME(?), updated_at = FROM_UNIXTIME(?), is_user_edited = ?
           WHERE id = ?`,
          [analysis.analyzedAt / 1000, analysis.updatedAt / 1000, analysis.isUserEdited, analysisId]
        );

        // 删除旧的分表数据
        await connection.execute('DELETE FROM schema_tables WHERE analysis_id = ?', [analysisId]);
        await connection.execute('DELETE FROM schema_questions WHERE analysis_id = ?', [analysisId]);
      } else {
        analysisId = uuidv4();
        
        // 创建主记录（保留原JSON字段为空，使用分表）
        await connection.execute(
          `INSERT INTO schema_analysis (id, user_id, datasource_id, tables, suggested_questions, analyzed_at, updated_at, is_user_edited) 
           VALUES (?, ?, ?, '[]', '[]', FROM_UNIXTIME(?), FROM_UNIXTIME(?), ?)`,
          [analysisId, userId, analysis.datasourceId, analysis.analyzedAt / 1000, analysis.updatedAt / 1000, analysis.isUserEdited]
        );
      }

      // 保存表信息
      for (const table of analysis.tables) {
        const tableId = uuidv4();
        
        await connection.execute(
          `INSERT INTO schema_tables (id, analysis_id, table_name, table_name_cn, table_comment, row_count) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            tableId,
            analysisId,
            table.tableName || table.name,
            table.tableNameCn || table.nameCn,
            table.tableComment || table.comment,
            table.rowCount || 0
          ]
        );

        // 保存字段信息
        if (table.columns && Array.isArray(table.columns)) {
          for (const column of table.columns) {
            await connection.execute(
              `INSERT INTO schema_columns (id, table_id, column_name, column_name_cn, column_type, column_comment, is_nullable, is_primary_key, default_value) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                uuidv4(),
                tableId,
                column.name,
                column.nameCn,
                column.type,
                column.comment,
                column.nullable !== false,
                column.primaryKey === true,
                column.defaultValue
              ]
            );
          }
        }
      }

      // 保存推荐问题
      for (let i = 0; i < analysis.suggestedQuestions.length; i++) {
        await connection.execute(
          `INSERT INTO schema_questions (id, analysis_id, question, sort_order) 
           VALUES (?, ?, ?, ?)`,
          [uuidv4(), analysisId, analysis.suggestedQuestions[i], i + 1]
        );
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
   * 获取Schema分析结果
   */
  async getSchemaAnalysis(datasourceId: string, userId: string): Promise<NormalizedSchemaAnalysis | null> {
    // 获取主记录
    const [analysisRows] = await this.pool.execute(
      `SELECT id, analyzed_at, updated_at, is_user_edited 
       FROM schema_analysis 
       WHERE user_id = ? AND datasource_id = ?`,
      [userId, datasourceId]
    ) as [any[], any];

    if (analysisRows.length === 0) {
      return null;
    }

    const analysis = analysisRows[0];
    const analysisId = analysis.id;

    // 获取表信息
    const [tableRows] = await this.pool.execute(
      `SELECT id, table_name, table_name_cn, table_comment, row_count 
       FROM schema_tables 
       WHERE analysis_id = ? 
       ORDER BY table_name`,
      [analysisId]
    ) as [any[], any];

    const tables: NormalizedTable[] = [];

    for (const tableRow of tableRows) {
      // 获取字段信息
      const [columnRows] = await this.pool.execute(
        `SELECT id, column_name, column_name_cn, column_type, column_comment, is_nullable, is_primary_key, default_value 
         FROM schema_columns 
         WHERE table_id = ? 
         ORDER BY column_name`,
        [tableRow.id]
      ) as [any[], any];

      const columns: NormalizedColumn[] = columnRows.map((col: any) => ({
        id: col.id,
        name: col.column_name,
        nameCn: col.column_name_cn,
        type: col.column_type,
        comment: col.column_comment,
        nullable: col.is_nullable,
        primaryKey: col.is_primary_key,
        defaultValue: col.default_value
      }));

      tables.push({
        id: tableRow.id,
        tableName: tableRow.table_name,
        tableNameCn: tableRow.table_name_cn,
        tableComment: tableRow.table_comment,
        rowCount: tableRow.row_count,
        columns
      });
    }

    // 获取推荐问题
    const [questionRows] = await this.pool.execute(
      `SELECT question 
       FROM schema_questions 
       WHERE analysis_id = ? 
       ORDER BY sort_order`,
      [analysisId]
    ) as [any[], any];

    const suggestedQuestions = questionRows.map((q: any) => q.question);

    return {
      id: analysisId,
      datasourceId,
      userId,
      analyzedAt: analysis.analyzed_at.getTime(),
      updatedAt: analysis.updated_at.getTime(),
      isUserEdited: analysis.is_user_edited,
      tables,
      suggestedQuestions
    };
  }

  // ========== 聊天消息管理 ==========

  /**
   * 保存聊天消息（分表存储）
   */
  async saveChatMessages(chatId: string, messages: Array<{ role: string; content: string }>): Promise<void> {
    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // 删除旧消息
      await connection.execute('DELETE FROM chat_messages WHERE chat_id = ?', [chatId]);

      // 插入新消息
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        await connection.execute(
          `INSERT INTO chat_messages (id, chat_id, role, content, message_order) 
           VALUES (?, ?, ?, ?, ?)`,
          [uuidv4(), chatId, message.role, message.content, i + 1]
        );
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
   * 获取聊天消息
   */
  async getChatMessages(chatId: string): Promise<ChatMessage[]> {
    const [rows] = await this.pool.execute(
      `SELECT id, role, content, message_order 
       FROM chat_messages 
       WHERE chat_id = ? 
       ORDER BY message_order`,
      [chatId]
    ) as [any[], any];

    return rows.map((row: any) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      order: row.message_order
    }));
  }

  // ========== 审计日志详情管理 ==========

  /**
   * 保存审计日志详情（分表存储）
   */
  async saveAuditLogDetails(auditLogId: string, details: Record<string, any>): Promise<void> {
    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // 删除旧详情
      await connection.execute('DELETE FROM audit_log_details WHERE audit_log_id = ?', [auditLogId]);

      // 插入新详情
      for (const [key, value] of Object.entries(details)) {
        let detailType: string = 'string';
        let detailValue: string = '';

        if (typeof value === 'number') {
          detailType = 'number';
          detailValue = value.toString();
        } else if (typeof value === 'boolean') {
          detailType = 'boolean';
          detailValue = value.toString();
        } else if (typeof value === 'object' && value !== null) {
          detailType = 'object';
          detailValue = JSON.stringify(value);
        } else {
          detailValue = String(value);
        }

        await connection.execute(
          `INSERT INTO audit_log_details (id, audit_log_id, detail_key, detail_value, detail_type) 
           VALUES (?, ?, ?, ?, ?)`,
          [uuidv4(), auditLogId, key, detailValue, detailType]
        );
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
   * 获取审计日志详情
   */
  async getAuditLogDetails(auditLogId: string): Promise<Record<string, any>> {
    const [rows] = await this.pool.execute(
      'SELECT detail_key, detail_value, detail_type FROM audit_log_details WHERE audit_log_id = ?',
      [auditLogId]
    ) as [AuditLogDetail[], any];

    const details: Record<string, any> = {};

    for (const row of rows) {
      let value: any = row.value;

      switch (row.type) {
        case 'number':
          value = parseFloat(row.value);
          break;
        case 'boolean':
          value = row.value === 'true';
          break;
        case 'object':
          try {
            value = JSON.parse(row.value);
          } catch {
            value = row.value;
          }
          break;
        default:
          value = row.value;
      }

      details[row.key] = value;
    }

    return details;
  }

  /**
   * 关闭连接池
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

// 导出单例实例
export const normalizedConfigStore = new NormalizedConfigStore();