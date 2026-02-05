import mysql from 'mysql2/promise';
import { BaseDataSource } from './base';
import { DatabaseConfig, TableSchema, ColumnInfo, QueryResult } from '../types';

export class MySQLDataSource extends BaseDataSource {
  private connection: mysql.Connection | null = null;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    // 如果已有连接，先检查是否有效
    if (this.connection) {
      try {
        await this.connection.ping();
        return;
      } catch {
        this.connection = null;
      }
    }
    
    this.connection = await mysql.createConnection({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      connectTimeout: 10000,
    });
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const conn = await mysql.createConnection({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        connectTimeout: 5000,
        // MySQL 8.0+ 认证支持
        authPlugins: undefined,
      });
      await conn.ping();
      await conn.end();
      return true;
    } catch (error: any) {
      console.error('MySQL连接测试失败:', error.message);
      throw new Error(`MySQL连接失败: ${error.message}`);
    }
  }

  async getSchema(): Promise<TableSchema[]> {
    if (!this.connection) await this.connect();
    
    const [tables] = await this.connection!.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME NOT IN ('datasource_config', 'chat_history')`,
      [this.config.database]
    );

    const schemas: TableSchema[] = [];
    for (const table of tables as any[]) {
      const tableName = table.TABLE_NAME;
      const [columns] = await this.connection!.query(
        `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_COMMENT 
         FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [this.config.database, tableName]
      );

      const columnInfos: ColumnInfo[] = (columns as any[]).map(col => ({
        name: col.COLUMN_NAME,
        type: col.DATA_TYPE,
        nullable: col.IS_NULLABLE === 'YES',
        isPrimaryKey: col.COLUMN_KEY === 'PRI',
        comment: col.COLUMN_COMMENT || undefined,
      }));

      // 获取样例数据
      const [sampleData] = await this.connection!.query(
        `SELECT * FROM \`${tableName}\` LIMIT 3`
      );

      schemas.push({ tableName, columns: columnInfos, sampleData: sampleData as any[] });
    }
    return schemas;
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    try {
      if (!this.connection) await this.connect();
      const [rows] = await this.connection!.query(sql);
      return { success: true, data: rows as any[], sql, rowCount: (rows as any[]).length };
    } catch (error: any) {
      return { success: false, error: error.message, sql };
    }
  }
}
