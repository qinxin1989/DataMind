import mysql from 'mysql2/promise';
import { DataSourceConfig } from '../types';
import { pool } from '../admin/core/database';
import { encrypt, decrypt } from '../admin/utils/crypto';

// 上传文件基础路径（用于相对路径转换）
const UPLOAD_BASE_PATH = process.env.UPLOAD_PATH || './uploads';

// 对话历史
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  chart?: any;
  data?: any;
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // 修复外键约束问题 - 确保user_id指向sys_users表而不是users表
      try {
        // 1. 获取所有外键约束的详细信息
        const [constraints] = await this.pool.execute(`
          SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
          FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'datasource_config'
          AND REFERENCED_TABLE_NAME IS NOT NULL
        `);

        // 2. 删除所有指向users表的外键约束
        for (const constraint of constraints as any[]) {
          if (constraint.REFERENCED_TABLE_NAME === 'users') {
            try {
              await this.pool.execute(`
                ALTER TABLE datasource_config 
                DROP FOREIGN KEY ${constraint.CONSTRAINT_NAME}
              `);
              console.log(`已删除错误的外键约束: ${constraint.CONSTRAINT_NAME} (指向users表)`);
            } catch (dropError) {
              console.log(`删除外键约束 ${constraint.CONSTRAINT_NAME} 失败:`, (dropError as any).message);
            }
          }
        }

        // 3. 检查sys_users表是否存在
        const [sysUsersExists] = await this.pool.execute(`
          SHOW TABLES LIKE 'sys_users'
        `);

        if ((sysUsersExists as any[]).length > 0) {
          // 4. 检查是否已存在指向sys_users的外键约束
          let hasCorrectConstraint = false;
          for (const constraint of constraints as any[]) {
            if (constraint.REFERENCED_TABLE_NAME === 'sys_users' && constraint.REFERENCED_COLUMN_NAME === 'id') {
              hasCorrectConstraint = true;
              console.log('已存在正确的外键约束，指向sys_users.id');
              break;
            }
          }

          // 5. 如果没有正确的外键约束，则添加
          if (!hasCorrectConstraint) {
            try {
              await this.pool.execute(`
                ALTER TABLE datasource_config 
                ADD CONSTRAINT fk_datasource_user 
                FOREIGN KEY (user_id) REFERENCES sys_users(id) 
                ON DELETE CASCADE
              `);
              console.log('已成功添加正确的外键约束: fk_datasource_user (指向sys_users.id)');
            } catch (addError) {
              // 如果添加外键约束失败，可能是因为user_id包含无效值
              console.log('添加外键约束失败:', (addError as any).message);
              console.log('尝试将无效的user_id设置为空字符串...');

              // 尝试修复无效的user_id值
              await this.pool.execute(`
                UPDATE datasource_config 
                SET user_id = '' 
                WHERE user_id NOT IN (SELECT id FROM sys_users)
              `);
              console.log('已将无效的user_id设置为空字符串');

              // 再次尝试添加外键约束
              try {
                await this.pool.execute(`
                  ALTER TABLE datasource_config 
                  ADD CONSTRAINT fk_datasource_user 
                  FOREIGN KEY (user_id) REFERENCES sys_users(id) 
                  ON DELETE CASCADE
                `);
                console.log('修复user_id后，成功添加外键约束');
              } catch (secondAddError) {
                console.log('修复user_id后添加外键约束仍失败:', (secondAddError as any).message);
              }
            }
          }
        } else {
          console.log('sys_users表不存在，跳过外键约束添加');
        }
      } catch (e) {
        console.log('外键约束修复过程中发生错误:', (e as any).message);
      }

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

      // 添加新的拆分列（host, port, db_user, db_password, db_name, file_path, dataset_id）
      try {
        const [columns] = await this.pool.execute(
          `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'datasource_config' AND COLUMN_NAME = 'host'`
        );
        if ((columns as any[]).length === 0) {
          console.log('正在添加数据源配置拆分列...');
          await this.pool.execute(`ALTER TABLE datasource_config ADD COLUMN host VARCHAR(255) DEFAULT NULL`);
          await this.pool.execute(`ALTER TABLE datasource_config ADD COLUMN port INT DEFAULT NULL`);
          await this.pool.execute(`ALTER TABLE datasource_config ADD COLUMN db_user VARCHAR(100) DEFAULT NULL`);
          await this.pool.execute(`ALTER TABLE datasource_config ADD COLUMN db_password VARCHAR(500) DEFAULT NULL`);
          await this.pool.execute(`ALTER TABLE datasource_config ADD COLUMN db_name VARCHAR(100) DEFAULT NULL`);
          await this.pool.execute(`ALTER TABLE datasource_config ADD COLUMN file_path VARCHAR(500) DEFAULT NULL`);
          await this.pool.execute(`ALTER TABLE datasource_config ADD COLUMN dataset_id VARCHAR(36) DEFAULT NULL`);
          console.log('已添加数据源配置拆分列');

          // 迁移旧数据
          await this.migrateConfigData();
        }
      } catch (e: any) {
        console.error('添加数据源配置拆分列失败:', e.message);
      }
    } catch (error: any) {
      console.warn('数据库连接失败，将以内存模式运行:', error.message);
      // 继续运行，使用内存存储
    }
  }

  async save(config: DataSourceConfig): Promise<void> {
    // 从 config 对象中提取字段
    let host = null, port = null, dbUser = null, dbPassword = null, dbName = null, filePath = null;

    if (config.type === 'mysql' || config.type === 'postgres') {
      const dbConfig = config.config as any;
      host = dbConfig.host || null;
      port = dbConfig.port || null;
      dbUser = dbConfig.user || null;
      // 加密密码
      dbPassword = dbConfig.password ? encrypt(dbConfig.password) : null;
      dbName = dbConfig.database || null;
    } else if (config.type === 'file') {
      const fileConfig = config.config as any;
      // 转换为相对路径
      filePath = this.toRelativePath(fileConfig.path);
    }

    await this.pool.execute(
      `INSERT INTO datasource_config 
       (id, user_id, name, type, config, visibility, approval_status, host, port, db_user, db_password, db_name, file_path, dataset_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
       name=VALUES(name), type=VALUES(type), config=VALUES(config), visibility=VALUES(visibility), 
       approval_status=VALUES(approval_status), host=VALUES(host), port=VALUES(port), db_user=VALUES(db_user), 
       db_password=VALUES(db_password), db_name=VALUES(db_name), file_path=VALUES(file_path), dataset_id=VALUES(dataset_id)`,
      [
        config.id, config.userId, config.name, config.type, JSON.stringify(config.config),
        config.visibility || 'private', config.approvalStatus || null,
        host, port, dbUser, dbPassword, dbName, filePath, config.datasetId || null
      ]
    );
  }

  // 路径转换辅助方法
  private toRelativePath(absolutePath: string): string {
    if (!absolutePath) return absolutePath;
    // 标准化路径分隔符
    const normalized = absolutePath.replace(/\\/g, '/');
    const basePath = UPLOAD_BASE_PATH.replace(/\\/g, '/');

    if (normalized.includes('/uploads/')) {
      // 提取 uploads 之后的相对路径
      const match = normalized.match(/\/uploads\/(.+)$/);
      if (match) return match[1];
    }
    return absolutePath;
  }

  private toAbsolutePath(relativePath: string): string {
    if (!relativePath) return relativePath;
    // 如果已经是绝对路径，直接返回
    if (relativePath.includes(':') || relativePath.startsWith('/')) {
      return relativePath;
    }
    return `${UPLOAD_BASE_PATH}/${relativePath}`;
  }

  // 迁移旧数据
  private async migrateConfigData(): Promise<void> {
    console.log('开始迁移旧数据源配置...');
    try {
      const [rows] = await this.pool.execute('SELECT * FROM datasource_config WHERE host IS NULL AND config IS NOT NULL');
      for (const row of rows as any[]) {
        try {
          const config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
          let host = null, port = null, dbUser = null, dbPassword = null, dbName = null, filePath = null;

          if (row.type === 'mysql' || row.type === 'postgres') {
            host = config.host || null;
            port = config.port || null;
            dbUser = config.user || null;
            dbPassword = config.password ? encrypt(config.password) : null;
            dbName = config.database || null;
          } else if (row.type === 'file') {
            filePath = this.toRelativePath(config.path);
          }

          await this.pool.execute(
            `UPDATE datasource_config SET host=?, port=?, db_user=?, db_password=?, db_name=?, file_path=? WHERE id=?`,
            [host, port, dbUser, dbPassword, dbName, filePath, row.id]
          );
          console.log(`已迁移数据源: ${row.name}`);
        } catch (e: any) {
          console.error(`迁移数据源 ${row.name} 失败:`, e.message);
        }
      }
      console.log('数据源配置迁移完成');
    } catch (e: any) {
      console.error('数据迁移失败:', e.message);
    }
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
      return (rows as any[]).map(row => this.mapRowToConfig(row));
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

      return this.mapRowToConfig(row);
    } catch (error: any) {
      console.warn('获取数据源配置失败:', error.message);
      return null;
    }
  }

  async delete(id: string): Promise<void> {
    await this.pool.execute('DELETE FROM datasource_config WHERE id = ?', [id]);
  }

  // 将数据库行映射为 DataSourceConfig 对象
  private mapRowToConfig(row: any): DataSourceConfig {
    // 优先使用拆分列，保持向后兼容
    let config: any;

    if (row.host || row.file_path) {
      // 使用新的拆分列构建 config
      if (row.type === 'mysql' || row.type === 'postgres') {
        config = {
          host: row.host,
          port: row.port,
          user: row.db_user,
          // 解密密码
          password: row.db_password ? decrypt(row.db_password) : '',
          database: row.db_name
        };
      } else if (row.type === 'file') {
        config = {
          path: this.toAbsolutePath(row.file_path),
          fileType: 'csv' // 默认
        };
        // 尝试从 JSON config 获取更多信息
        try {
          const jsonConfig = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
          if (jsonConfig) {
            config.fileType = jsonConfig.fileType || 'csv';
            config.originalName = jsonConfig.originalName;
            config.encrypted = jsonConfig.encrypted;
            config.files = jsonConfig.files;
          }
        } catch (e) { }
      } else {
        config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
      }
    } else {
      // 回退到旧的 JSON config
      config = typeof row.config === 'string' ? JSON.parse(row.config) : row.config;
    }

    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      type: row.type,
      config,
      visibility: row.visibility || 'private',
      approvalStatus: row.approval_status,
      datasetId: row.dataset_id
    };
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
            user_id VARCHAR(36) NOT NULL,
            datasource_id VARCHAR(36) NOT NULL,
            messages MEDIUMTEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_datasource (datasource_id),
            INDEX idx_user (user_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
      } else {
        // 检查是否需要添加 user_id 列（迁移旧表）
        try {
          const [columns] = await this.pool.execute(
            `SHOW COLUMNS FROM chat_history LIKE 'user_id'`
          );

          if ((columns as any[]).length === 0) {
            console.log('检测到 chat_history 表缺少 user_id 列，正在添加...');
            await this.pool.execute(`ALTER TABLE chat_history ADD COLUMN user_id VARCHAR(36) NOT NULL DEFAULT '' AFTER id`);
            await this.pool.execute(`ALTER TABLE chat_history ADD INDEX idx_user (user_id)`);
            console.log('成功添加 user_id 列到 chat_history 表');
          }
        } catch (e: any) {
          console.error('chat_history 表迁移失败:', e.message);
        }
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
