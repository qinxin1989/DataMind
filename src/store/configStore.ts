import mysql from 'mysql2/promise';
import { DataSourceConfig } from '../types';
import { pool } from '../admin/core/database';

// 对话历史
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  timestamp: number;
  responseTime?: number;
  tokensUsed?: number;
  modelName?: string;
}

export interface ChatSession {
  id: string;
  datasourceId: string;
  messages: ChatMessage[];
  createdAt: number;
}

// Schema 分析结果（AI 生成 + 用户可编辑）
export interface SchemaAnalysis {
  datasourceId: string;
  tables: TableAnalysis[];
  suggestedQuestions: string[];
  analyzedAt: number;
  updatedAt: number;
  isUserEdited: boolean;
}

export interface TableAnalysis {
  tableName: string;
  tableNameCn: string;
  description?: string;
  columns: ColumnAnalysis[];
}

export interface ColumnAnalysis {
  name: string;
  type: string;
  nameCn: string;
  description: string;
}

// 配置存储 - 使用统一的 MySQL 连接池
export class ConfigStore {
  pool: mysql.Pool;

  constructor() {
    // 使用统一的连接池
    this.pool = pool;
  }

  async init(): Promise<void> {
    try {
      // 创建配置表
      await this.pool.execute(`
        CREATE TABLE IF NOT EXISTS datasource_config (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) DEFAULT '',
          name VARCHAR(100) NOT NULL,
          type VARCHAR(20) NOT NULL,
          config JSON NOT NULL,
          visibility VARCHAR(20) DEFAULT 'private',
          approval_status VARCHAR(20) DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id)
        )
      `);
      
      // 检查是否需要添加 user_id 列（兼容旧表）
      try {
        const [columns] = await this.pool.execute(
          `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'datasource_config' AND COLUMN_NAME = 'user_id'`
        );
        if ((columns as any[]).length === 0) {
          await this.pool.execute(`ALTER TABLE datasource_config ADD COLUMN user_id VARCHAR(36) DEFAULT '' AFTER id`);
          await this.pool.execute(`ALTER TABLE datasource_config ADD INDEX idx_user_id (user_id)`);
          console.log('已添加 user_id 列到 datasource_config 表');
        }
      } catch (e) {
        // 忽略
      }
      
      // 检查是否需要添加 visibility 和 approval_status 列
      try {
        const [columns] = await this.pool.execute(
          `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'datasource_config' AND COLUMN_NAME = 'visibility'`
        );
        if ((columns as any[]).length === 0) {
          await this.pool.execute(`ALTER TABLE datasource_config ADD COLUMN visibility VARCHAR(20) DEFAULT 'private'`);
          await this.pool.execute(`ALTER TABLE datasource_config ADD COLUMN approval_status VARCHAR(20) DEFAULT NULL`);
          console.log('已添加 visibility 和 approval_status 列到 datasource_config 表');
        }
      } catch (e) {
        // 忽略
      }
    } catch (error: any) {
      console.warn('数据库连接失败，将以内存模式运行:', error.message);
      // 继续运行，使用内存存储
    }
  }

  async save(config: DataSourceConfig): Promise<void> {
    await this.pool.execute(
      `INSERT INTO datasource_config (id, user_id, name, type, config, visibility, approval_status) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=?, type=?, config=?, visibility=?, approval_status=?`,
      [config.id, config.userId, config.name, config.type, JSON.stringify(config.config), 
       config.visibility || 'private', config.approvalStatus || null,
       config.name, config.type, JSON.stringify(config.config),
       config.visibility || 'private', config.approvalStatus || null]
    );
  }

  async getAll(userId?: string): Promise<DataSourceConfig[]> {
    try {
      let query = 'SELECT * FROM datasource_config';
      const params: any[] = [];

      if (userId) {
        query += ' WHERE user_id = ?';
        params.push(userId);
      }

      const [rows] = await this.pool.execute(query, params);
      return (rows as any[]).map(row => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        type: row.type,
        config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
        visibility: row.visibility || 'private',
        approvalStatus: row.approval_status,
      }));
    } catch (error: any) {
      console.warn('获取数据源配置失败，返回空列表:', error.message);
      return [];
    }
  }

  async getById(id: string): Promise<DataSourceConfig | null> {
    try {
      const [rows] = await this.pool.execute(
        'SELECT * FROM datasource_config WHERE id = ?',
        [id]
      );
      const row = (rows as any[])[0];
      if (!row) return null;

      return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        type: row.type,
        config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
        visibility: row.visibility || 'private',
        approvalStatus: row.approval_status,
      };
    } catch (error: any) {
      console.warn('获取数据源配置失败:', error.message);
      return null;
    }
  }

  async delete(id: string): Promise<void> {
    await this.pool.execute('DELETE FROM datasource_config WHERE id = ?', [id]);
  }

  // 对话历史相关
  async initChatTable(): Promise<void> {
    try {
      // 检查表是否存在，不存在才创建
      const [tables] = await this.pool.execute(
        `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'chat_history'`
      );
      
      if ((tables as any[]).length === 0) {
        await this.pool.execute(`
          CREATE TABLE chat_history (
            id VARCHAR(36) PRIMARY KEY,
            datasource_id VARCHAR(36) NOT NULL,
            messages MEDIUMTEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_datasource (datasource_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
      }
    } catch (error: any) {
      console.warn('聊天表初始化失败，将以内存模式运行:', error.message);
    }
  }

  // 清理字符串中的无效 Unicode 字符（surrogate pairs）
  private sanitizeString(str: string): string {
    // 移除无效的 surrogate pairs 和其他可能导致 JSON 问题的字符
    return str
      .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '') // 移除孤立的高位代理
      .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '') // 移除孤立的低位代理
      .replace(/\u0000/g, ''); // 移除 null 字符
  }

  // 清理消息内容
  private sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
    return messages.map(msg => ({
      ...msg,
      content: this.sanitizeString(msg.content),
      sql: msg.sql ? this.sanitizeString(msg.sql) : undefined
    }));
  }

  async saveChatSession(session: ChatSession, userId: string): Promise<void> {
    try {
      // 清理消息中的无效字符
      const sanitizedMessages = this.sanitizeMessages(session.messages);
      const messagesStr = JSON.stringify(sanitizedMessages);
      
      await this.pool.execute(
        `INSERT INTO chat_history (id, user_id, datasource_id, messages, created_at) VALUES (?, ?, ?, ?, FROM_UNIXTIME(?/1000))
         ON DUPLICATE KEY UPDATE messages=?, updated_at=NOW()`,
        [session.id, userId, session.datasourceId, messagesStr, session.createdAt, messagesStr]
      );
    } catch (error: any) {
      console.error('保存聊天记录失败:', error.message);
      // 如果还是失败，尝试只保存最后几条消息
      try {
        const lastMessages = session.messages.slice(-4);
        const sanitizedMessages = this.sanitizeMessages(lastMessages);
        const messagesStr = JSON.stringify(sanitizedMessages);
        
        await this.pool.execute(
          `INSERT INTO chat_history (id, user_id, datasource_id, messages, created_at) VALUES (?, ?, ?, ?, FROM_UNIXTIME(?/1000))
           ON DUPLICATE KEY UPDATE messages=?, updated_at=NOW()`,
          [session.id, userId, session.datasourceId, messagesStr, session.createdAt, messagesStr]
        );
      } catch (e) {
        console.error('保存聊天记录彻底失败:', e);
      }
    }
  }

  async getChatSessions(datasourceId: string, userId: string): Promise<ChatSession[]> {
    const [rows] = await this.pool.execute(
      `SELECT * FROM chat_history WHERE datasource_id = ? AND user_id = ? ORDER BY updated_at DESC LIMIT 20`,
      [datasourceId, userId]
    );
    return (rows as any[]).map(row => ({
      id: row.id,
      datasourceId: row.datasource_id,
      messages: typeof row.messages === 'string' ? JSON.parse(row.messages) : row.messages,
      createdAt: new Date(row.created_at).getTime(),
    }));
  }

  async getChatSession(id: string, userId: string): Promise<ChatSession | null> {
    const [rows] = await this.pool.execute(
      'SELECT * FROM chat_history WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    const row = (rows as any[])[0];
    if (!row) return null;
    return {
      id: row.id,
      datasourceId: row.datasource_id,
      messages: typeof row.messages === 'string' ? JSON.parse(row.messages) : row.messages,
      createdAt: new Date(row.created_at).getTime(),
    };
  }

  async deleteChatSession(id: string, userId: string): Promise<void> {
    await this.pool.execute('DELETE FROM chat_history WHERE id = ? AND user_id = ?', [id, userId]);
  }

  // ========== Schema 分析结果存储 ==========

  async initSchemaAnalysisTable(): Promise<void> {
    try {
      await this.pool.execute(`
        CREATE TABLE IF NOT EXISTS schema_analysis (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          datasource_id VARCHAR(36) NOT NULL,
          tables JSON NOT NULL,
          suggested_questions JSON NOT NULL,
          analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          is_user_edited BOOLEAN DEFAULT FALSE,
          UNIQUE KEY unique_user_ds (user_id, datasource_id)
        )
      `);
      
      // 检查是否需要添加 user_id 列（兼容旧表）
      try {
        await this.pool.execute(`ALTER TABLE schema_analysis ADD COLUMN user_id VARCHAR(36) NOT NULL DEFAULT '' AFTER id`);
        await this.pool.execute(`ALTER TABLE schema_analysis DROP PRIMARY KEY`);
        await this.pool.execute(`ALTER TABLE schema_analysis ADD PRIMARY KEY (id)`);
        await this.pool.execute(`ALTER TABLE schema_analysis ADD UNIQUE KEY unique_user_ds (user_id, datasource_id)`);
      } catch (e) {
        // 列已存在，忽略
      }
    } catch (error: any) {
      console.warn('Schema分析表初始化失败，将以内存模式运行:', error.message);
    }
  }

  async saveSchemaAnalysis(analysis: SchemaAnalysis, userId: string): Promise<void> {
    try {
      await this.pool.execute(
        `INSERT INTO schema_analysis (user_id, datasource_id, tables, suggested_questions, analyzed_at, is_user_edited) 
         VALUES (?, ?, ?, ?, NOW(), ?)
         ON DUPLICATE KEY UPDATE tables=VALUES(tables), suggested_questions=VALUES(suggested_questions), updated_at=NOW(), is_user_edited=VALUES(is_user_edited)`,
        [
          userId,
          analysis.datasourceId,
          JSON.stringify(analysis.tables),
          JSON.stringify(analysis.suggestedQuestions),
          analysis.isUserEdited || false
        ]
      );
    } catch (error: any) {
      console.error('保存Schema分析失败:', error.message);
      throw error;
    }
  }

  async getSchemaAnalysis(datasourceId: string, userId: string): Promise<SchemaAnalysis | null> {
    const [rows] = await this.pool.execute(
      'SELECT * FROM schema_analysis WHERE datasource_id = ? AND user_id = ?',
      [datasourceId, userId]
    );
    const row = (rows as any[])[0];
    if (!row) return null;
    
    return {
      datasourceId: row.datasource_id,
      tables: typeof row.tables === 'string' ? JSON.parse(row.tables) : row.tables,
      suggestedQuestions: typeof row.suggested_questions === 'string' 
        ? JSON.parse(row.suggested_questions) 
        : row.suggested_questions,
      analyzedAt: new Date(row.analyzed_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
      isUserEdited: row.is_user_edited
    };
  }

  async updateTableAnalysis(
    datasourceId: string, 
    tableName: string, 
    updates: Partial<TableAnalysis>,
    userId: string
  ): Promise<boolean> {
    const analysis = await this.getSchemaAnalysis(datasourceId, userId);
    if (!analysis) return false;

    const tableIndex = analysis.tables.findIndex(t => t.tableName === tableName);
    if (tableIndex === -1) return false;

    analysis.tables[tableIndex] = { ...analysis.tables[tableIndex], ...updates };
    analysis.isUserEdited = true;
    analysis.updatedAt = Date.now();

    await this.saveSchemaAnalysis(analysis, userId);
    return true;
  }

  async updateColumnAnalysis(
    datasourceId: string,
    tableName: string,
    columnName: string,
    updates: Partial<ColumnAnalysis>,
    userId: string
  ): Promise<boolean> {
    const analysis = await this.getSchemaAnalysis(datasourceId, userId);
    if (!analysis) return false;

    const table = analysis.tables.find(t => t.tableName === tableName);
    if (!table) return false;

    const column = table.columns.find(c => c.name === columnName);
    if (!column) return false;

    Object.assign(column, updates);
    analysis.isUserEdited = true;
    analysis.updatedAt = Date.now();

    await this.saveSchemaAnalysis(analysis, userId);
    return true;
  }

  async updateSuggestedQuestions(datasourceId: string, questions: string[], userId: string): Promise<boolean> {
    const analysis = await this.getSchemaAnalysis(datasourceId, userId);
    if (!analysis) return false;

    analysis.suggestedQuestions = questions;
    analysis.isUserEdited = true;
    analysis.updatedAt = Date.now();

    await this.saveSchemaAnalysis(analysis, userId);
    return true;
  }

  async deleteSchemaAnalysis(datasourceId: string, userId: string): Promise<void> {
    await this.pool.execute(
      'DELETE FROM schema_analysis WHERE datasource_id = ? AND user_id = ?',
      [datasourceId, userId]
    );
  }
}
