import mysql from 'mysql2/promise';
import { BaseDataSource } from './base';
import { TableSchema, ColumnInfo, QueryResult } from './types';

type DatabaseConfig = {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
};

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
      user: this.config.username,
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
        user: this.config.username,
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

  protected async fetchSchema(): Promise<TableSchema[]> {
    if (!this.connection) await this.connect();

    const [tables] = await this.connection!.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME NOT IN ('datasource_config', 'chat_history')`,
      [this.config.database]
    );

    const tableNames = (tables as any[]).map(t => t.TABLE_NAME);
    if (tableNames.length === 0) return [];

    // 批量查询所有表的列信息 (1 次查询替代 N 次)
    const [allColumns] = await this.connection!.query(
      `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_COMMENT 
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (?)
       ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [this.config.database, tableNames]
    );

    const columnsByTable = new Map<string, ColumnInfo[]>();
    for (const col of allColumns as any[]) {
      const tName = col.TABLE_NAME;
      if (!columnsByTable.has(tName)) columnsByTable.set(tName, []);
      columnsByTable.get(tName)!.push({
        name: col.COLUMN_NAME,
        type: col.DATA_TYPE,
        nullable: col.IS_NULLABLE === 'YES',
        isPrimaryKey: col.COLUMN_KEY === 'PRI',
        comment: col.COLUMN_COMMENT || undefined,
      });
    }

    // 并行查询样例数据
    const samplePromises = tableNames.map(async (tableName) => {
      try {
        const [rows] = await this.connection!.query(
          `SELECT * FROM \`${tableName}\` LIMIT 3`
        );
        return { tableName, data: rows as any[] };
      } catch {
        return { tableName, data: [] };
      }
    });
    const sampleResults = await Promise.all(samplePromises);
    const sampleByTable = new Map(sampleResults.map(r => [r.tableName, r.data]));

    return tableNames.map(tableName => ({
      name: tableName,
      tableName,
      columns: columnsByTable.get(tableName) || [],
      sampleData: sampleByTable.get(tableName) || [],
    }));
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
