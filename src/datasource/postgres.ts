import { Client } from 'pg';
import { BaseDataSource } from './base';
import { DatabaseConfig, TableSchema, ColumnInfo, QueryResult } from '../types';

export class PostgresDataSource extends BaseDataSource {
  private client: Client | null = null;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    this.client = new Client({
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
    });
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.connect();
      await this.disconnect();
      return true;
    } catch {
      return false;
    }
  }

  async getSchema(): Promise<TableSchema[]> {
    if (!this.client) await this.connect();

    const tablesResult = await this.client!.query(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );

    const schemas: TableSchema[] = [];
    for (const table of tablesResult.rows) {
      const tableName = table.table_name;
      const columnsResult = await this.client!.query(
        `SELECT column_name, data_type, is_nullable, 
                (SELECT true FROM information_schema.table_constraints tc
                 JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
                 WHERE tc.table_name = c.table_name AND kcu.column_name = c.column_name 
                 AND tc.constraint_type = 'PRIMARY KEY') as is_primary
         FROM information_schema.columns c
         WHERE table_schema = 'public' AND table_name = $1`,
        [tableName]
      );

      const columnInfos: ColumnInfo[] = columnsResult.rows.map(col => ({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === 'YES',
        isPrimaryKey: col.is_primary === true,
      }));

      const sampleResult = await this.client!.query(`SELECT * FROM "${tableName}" LIMIT 3`);
      schemas.push({ tableName, columns: columnInfos, sampleData: sampleResult.rows });
    }
    return schemas;
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    try {
      if (!this.client) await this.connect();
      const result = await this.client!.query(sql);
      return { success: true, data: result.rows, sql, rowCount: result.rowCount || 0 };
    } catch (error: any) {
      return { success: false, error: error.message, sql };
    }
  }
}
