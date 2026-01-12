import mysql from 'mysql2/promise';
import { DataSourceConfig } from '../types';

// 对话历史
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  timestamp: number;
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
  isUserEdited: boolean;  // 标记是否被用户编辑过
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

// 配置存储 - 使用MySQL持久化
export class ConfigStore {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: process.env.CONFIG_DB_HOST || 'localhost',
      port: parseInt(process.env.CONFIG_DB_PORT || '3306'),
      user: process.env.CONFIG_DB_USER || 'root',
      password: process.env.CONFIG_DB_PASSWORD || '',
      database: process.env.CONFIG_DB_NAME || 'taobao_data',
      waitForConnections: true,
      connectionLimit: 5,
    });
  }

  async init(): Promise<void> {
    try {
      // 创建配置表
      await this.pool.execute(`
        CREATE TABLE IF NOT EXISTS datasource_config (
          id VARCHAR(36) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          type VARCHAR(20) NOT NULL,
          config JSON NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (error: any) {
      console.warn('数据库连接失败，将以内存模式运行:', error.message);
      // 继续运行，使用内存存储
    }
  }

  async save(config: DataSourceConfig): Promise<void> {
    await this.pool.execute(
      `INSERT INTO datasource_config (id, name, type, config) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=?, type=?, config=?`,
      [config.id, config.name, config.type, JSON.stringify(config.config),
       config.name, config.type, JSON.stringify(config.config)]
    );
  }

  async getAll(): Promise<DataSourceConfig[]> {
    try {
      const [rows] = await this.pool.execute('SELECT * FROM datasource_config');
      return (rows as any[]).map(row => ({
        id: row.id,
        name: row.name,
        type: row.type,
        config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
      }));
    } catch (error: any) {
      console.warn('获取数据源配置失败，返回空列表:', error.message);
      return [];
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

  async saveChatSession(session: ChatSession): Promise<void> {
    try {
      // 清理消息中的无效字符
      const sanitizedMessages = this.sanitizeMessages(session.messages);
      const messagesStr = JSON.stringify(sanitizedMessages);
      
      await this.pool.execute(
        `INSERT INTO chat_history (id, datasource_id, messages, created_at) VALUES (?, ?, ?, FROM_UNIXTIME(?/1000))
         ON DUPLICATE KEY UPDATE messages=?, updated_at=NOW()`,
        [session.id, session.datasourceId, messagesStr, session.createdAt, messagesStr]
      );
    } catch (error: any) {
      console.error('保存聊天记录失败:', error.message);
      // 如果还是失败，尝试只保存最后几条消息
      try {
        const lastMessages = session.messages.slice(-4);
        const sanitizedMessages = this.sanitizeMessages(lastMessages);
        const messagesStr = JSON.stringify(sanitizedMessages);
        
        await this.pool.execute(
          `INSERT INTO chat_history (id, datasource_id, messages, created_at) VALUES (?, ?, ?, FROM_UNIXTIME(?/1000))
           ON DUPLICATE KEY UPDATE messages=?, updated_at=NOW()`,
          [session.id, session.datasourceId, messagesStr, session.createdAt, messagesStr]
        );
      } catch (e) {
        console.error('保存聊天记录彻底失败:', e);
      }
    }
  }

  async getChatSessions(datasourceId: string): Promise<ChatSession[]> {
    const [rows] = await this.pool.execute(
      `SELECT * FROM chat_history WHERE datasource_id = ? ORDER BY updated_at DESC LIMIT 20`,
      [datasourceId]
    );
    return (rows as any[]).map(row => ({
      id: row.id,
      datasourceId: row.datasource_id,
      messages: typeof row.messages === 'string' ? JSON.parse(row.messages) : row.messages,
      createdAt: new Date(row.created_at).getTime(),
    }));
  }

  async getChatSession(id: string): Promise<ChatSession | null> {
    const [rows] = await this.pool.execute('SELECT * FROM chat_history WHERE id = ?', [id]);
    const row = (rows as any[])[0];
    if (!row) return null;
    return {
      id: row.id,
      datasourceId: row.datasource_id,
      messages: typeof row.messages === 'string' ? JSON.parse(row.messages) : row.messages,
      createdAt: new Date(row.created_at).getTime(),
    };
  }

  async deleteChatSession(id: string): Promise<void> {
    await this.pool.execute('DELETE FROM chat_history WHERE id = ?', [id]);
  }

  // ========== Schema 分析结果存储 ==========

  async initSchemaAnalysisTable(): Promise<void> {
    try {
      await this.pool.execute(`
        CREATE TABLE IF NOT EXISTS schema_analysis (
          datasource_id VARCHAR(36) PRIMARY KEY,
          tables JSON NOT NULL,
          suggested_questions JSON NOT NULL,
          analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          is_user_edited BOOLEAN DEFAULT FALSE
        )
      `);
    } catch (error: any) {
      console.warn('Schema分析表初始化失败，将以内存模式运行:', error.message);
    }
  }

  // 保存 Schema 分析结果
  async saveSchemaAnalysis(analysis: SchemaAnalysis): Promise<void> {
    await this.pool.execute(
      `INSERT INTO schema_analysis (datasource_id, tables, suggested_questions, analyzed_at, is_user_edited) 
       VALUES (?, ?, ?, FROM_UNIXTIME(?/1000), ?)
       ON DUPLICATE KEY UPDATE tables=?, suggested_questions=?, updated_at=NOW(), is_user_edited=?`,
      [
        analysis.datasourceId,
        JSON.stringify(analysis.tables),
        JSON.stringify(analysis.suggestedQuestions),
        analysis.analyzedAt,
        analysis.isUserEdited,
        JSON.stringify(analysis.tables),
        JSON.stringify(analysis.suggestedQuestions),
        analysis.isUserEdited
      ]
    );
  }

  // 获取 Schema 分析结果
  async getSchemaAnalysis(datasourceId: string): Promise<SchemaAnalysis | null> {
    const [rows] = await this.pool.execute(
      'SELECT * FROM schema_analysis WHERE datasource_id = ?',
      [datasourceId]
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

  // 更新单个表的分析（用户编辑）
  async updateTableAnalysis(
    datasourceId: string, 
    tableName: string, 
    updates: Partial<TableAnalysis>
  ): Promise<boolean> {
    const analysis = await this.getSchemaAnalysis(datasourceId);
    if (!analysis) return false;

    const tableIndex = analysis.tables.findIndex(t => t.tableName === tableName);
    if (tableIndex === -1) return false;

    analysis.tables[tableIndex] = { ...analysis.tables[tableIndex], ...updates };
    analysis.isUserEdited = true;
    analysis.updatedAt = Date.now();

    await this.saveSchemaAnalysis(analysis);
    return true;
  }

  // 更新单个字段的分析（用户编辑）
  async updateColumnAnalysis(
    datasourceId: string,
    tableName: string,
    columnName: string,
    updates: Partial<ColumnAnalysis>
  ): Promise<boolean> {
    const analysis = await this.getSchemaAnalysis(datasourceId);
    if (!analysis) return false;

    const table = analysis.tables.find(t => t.tableName === tableName);
    if (!table) return false;

    const column = table.columns.find(c => c.name === columnName);
    if (!column) return false;

    Object.assign(column, updates);
    analysis.isUserEdited = true;
    analysis.updatedAt = Date.now();

    await this.saveSchemaAnalysis(analysis);
    return true;
  }

  // 更新推荐问题（用户编辑）
  async updateSuggestedQuestions(datasourceId: string, questions: string[]): Promise<boolean> {
    const analysis = await this.getSchemaAnalysis(datasourceId);
    if (!analysis) return false;

    analysis.suggestedQuestions = questions;
    analysis.isUserEdited = true;
    analysis.updatedAt = Date.now();

    await this.saveSchemaAnalysis(analysis);
    return true;
  }

  // 删除 Schema 分析（重新分析时使用）
  async deleteSchemaAnalysis(datasourceId: string): Promise<void> {
    await this.pool.execute('DELETE FROM schema_analysis WHERE datasource_id = ?', [datasourceId]);
  }
}
