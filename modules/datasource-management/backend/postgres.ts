import { Client, ClientConfig } from 'pg';
import { BaseDataSource } from './base';
import { DatabaseConfig, TableSchema, ColumnInfo, QueryResult } from '../types';

/**
 * PostgreSQL 数据源适配器
 * 支持 PostgreSQL 12、13、14、15、16、17 版本
 * 兼容 openGauss、KingbaseES 等国产数据库
 */
export class PostgresDataSource extends BaseDataSource {
  private client: Client | null = null;
  private config: DatabaseConfig;
  private serverVersion: string = '';
  private majorVersion: number = 0;

  constructor(config: DatabaseConfig) {
    super();
    this.config = config;
  }

  private getClientConfig(): ClientConfig {
    return {
      host: this.config.host,
      port: this.config.port,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      // 连接超时设置
      connectionTimeoutMillis: 10000,
      // 查询超时设置
      query_timeout: 30000,
      // SSL 配置（可选，某些云数据库需要）
      ssl: this.config.host?.includes('rds') || this.config.host?.includes('cloud') 
        ? { rejectUnauthorized: false } 
        : undefined,
    };
  }

  async connect(): Promise<void> {
    if (this.client) {
      return; // 已连接
    }
    
    this.client = new Client(this.getClientConfig());
    
    try {
      await this.client.connect();
      
      // 获取服务器版本
      const versionResult = await this.client.query('SELECT version()');
      this.serverVersion = versionResult.rows[0]?.version || '';
      
      // 解析主版本号
      const versionMatch = this.serverVersion.match(/PostgreSQL (\d+)/i) ||
                          this.serverVersion.match(/openGauss (\d+)/i) ||
                          this.serverVersion.match(/KingbaseES V(\d+)/i);
      this.majorVersion = versionMatch ? parseInt(versionMatch[1]) : 12;
      
      console.log(`PostgreSQL connected: ${this.serverVersion.substring(0, 80)}`);
      console.log(`Detected major version: ${this.majorVersion}`);
    } catch (error: any) {
      this.client = null;
      // 使用友好的错误信息
      throw new Error(this.formatError(error));
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.end();
      } catch (e) {
        // 忽略断开连接时的错误
      }
      this.client = null;
    }
  }

  async testConnection(): Promise<boolean> {
    const testClient = new Client(this.getClientConfig());
    
    try {
      await testClient.connect();
      
      // 执行简单查询验证连接
      const result = await testClient.query('SELECT 1 as test');
      if (result.rows[0]?.test !== 1) {
        throw new Error('连接验证失败');
      }
      
      // 获取版本信息
      const versionResult = await testClient.query('SELECT version()');
      console.log('PostgreSQL version:', versionResult.rows[0]?.version?.substring(0, 100));
      
      await testClient.end();
      return true;
    } catch (error: any) {
      console.error('PostgreSQL connection test failed:', error.message);
      try {
        await testClient.end();
      } catch (e) {
        // 忽略
      }
      // 使用友好的错误信息
      throw new Error(this.formatError(error));
    }
  }

  async getSchema(): Promise<TableSchema[]> {
    if (!this.client) await this.connect();

    // 获取所有 schema（不仅仅是 public）
    const schemasToQuery = ['public'];
    
    // 尝试获取当前用户的默认 schema
    try {
      const searchPathResult = await this.client!.query('SHOW search_path');
      const searchPath = searchPathResult.rows[0]?.search_path || 'public';
      const schemas = searchPath.split(',').map((s: string) => s.trim().replace(/"/g, ''));
      if (schemas.length > 0 && !schemas.includes('public')) {
        schemasToQuery.unshift(schemas[0]);
      }
    } catch (e) {
      // 忽略，使用默认 public
    }

    const allSchemas: TableSchema[] = [];

    for (const schemaName of schemasToQuery) {
      // 获取表列表（兼容不同版本）
      const tablesQuery = this.getTablesQuery(schemaName);
      const tablesResult = await this.client!.query(tablesQuery);

      for (const table of tablesResult.rows) {
        const tableName = table.table_name;
        
        try {
          // 获取列信息
          const columnsResult = await this.client!.query(
            this.getColumnsQuery(schemaName),
            [tableName]
          );

          const columnInfos: ColumnInfo[] = columnsResult.rows.map(col => ({
            name: col.column_name,
            type: this.normalizeDataType(col.data_type, col.udt_name),
            nullable: col.is_nullable === 'YES',
            isPrimaryKey: col.is_primary === true || col.is_primary === 't',
            comment: col.column_comment || undefined,
          }));

          // 获取样本数据（带错误处理）
          let sampleData: any[] = [];
          try {
            const sampleResult = await this.client!.query(
              `SELECT * FROM "${schemaName}"."${tableName}" LIMIT 3`
            );
            sampleData = sampleResult.rows;
          } catch (e) {
            // 某些表可能没有权限读取
            console.log(`Cannot read sample data from ${schemaName}.${tableName}`);
          }

          allSchemas.push({
            tableName: schemaName === 'public' ? tableName : `${schemaName}.${tableName}`,
            columns: columnInfos,
            sampleData,
          });
        } catch (e: any) {
          console.error(`Error getting schema for ${schemaName}.${tableName}:`, e.message);
        }
      }
    }

    return allSchemas;
  }

  // 获取表列表的 SQL（兼容不同版本）
  private getTablesQuery(schemaName: string): string {
    // 基础查询，兼容 PostgreSQL 12+
    return `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = '${schemaName}' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
  }

  // 获取列信息的 SQL（兼容不同版本）
  private getColumnsQuery(schemaName: string): string {
    // 兼容 PostgreSQL 12-17 的列信息查询
    return `
      SELECT 
        c.column_name,
        c.data_type,
        c.udt_name,
        c.is_nullable,
        c.column_default,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale,
        COALESCE(
          (SELECT true 
           FROM information_schema.table_constraints tc
           JOIN information_schema.key_column_usage kcu 
             ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
           WHERE tc.table_schema = '${schemaName}'
             AND tc.table_name = c.table_name 
             AND kcu.column_name = c.column_name 
             AND tc.constraint_type = 'PRIMARY KEY'
           LIMIT 1
          ), false
        ) as is_primary,
        (SELECT pg_catalog.col_description(
          (SELECT oid FROM pg_catalog.pg_class WHERE relname = c.table_name AND relnamespace = 
            (SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = '${schemaName}')
          ), c.ordinal_position
        )) as column_comment
      FROM information_schema.columns c
      WHERE c.table_schema = '${schemaName}' 
        AND c.table_name = $1
      ORDER BY c.ordinal_position
    `;
  }

  // 标准化数据类型名称
  private normalizeDataType(dataType: string, udtName?: string): string {
    // PostgreSQL 的 data_type 有时不够精确，需要结合 udt_name
    const type = dataType.toLowerCase();
    const udt = (udtName || '').toLowerCase();

    // 数组类型
    if (type === 'array' || udt.startsWith('_')) {
      return `${udt.replace(/^_/, '')}[]`;
    }

    // 用户自定义类型
    if (type === 'user-defined') {
      return udt || 'custom';
    }

    // 常见类型映射
    const typeMap: Record<string, string> = {
      'character varying': 'varchar',
      'character': 'char',
      'timestamp without time zone': 'timestamp',
      'timestamp with time zone': 'timestamptz',
      'time without time zone': 'time',
      'time with time zone': 'timetz',
      'double precision': 'float8',
      'real': 'float4',
    };

    return typeMap[type] || type;
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    try {
      if (!this.client) await this.connect();
      
      // 安全检查：只允许 SELECT 查询
      const trimmedSql = sql.trim().toLowerCase();
      if (!trimmedSql.startsWith('select') && 
          !trimmedSql.startsWith('with') &&
          !trimmedSql.startsWith('explain')) {
        return { 
          success: false, 
          error: '只允许执行 SELECT 查询', 
          sql 
        };
      }

      const result = await this.client!.query(sql);
      return { 
        success: true, 
        data: result.rows, 
        sql, 
        rowCount: result.rowCount || 0 
      };
    } catch (error: any) {
      return { 
        success: false, 
        error: this.formatError(error), 
        sql 
      };
    }
  }

  // 格式化错误信息
  private formatError(error: any): string {
    const code = error.code || '';
    const message = error.message || '未知错误';

    // PostgreSQL 错误代码映射
    const errorMessages: Record<string, string> = {
      '28P01': '用户名或密码错误',
      '28000': '认证失败',
      '3D000': '数据库不存在',
      '42P01': '表不存在',
      '42703': '列不存在',
      '42601': 'SQL 语法错误',
      '42501': '权限不足，请联系数据库管理员授权',
      '57P03': '服务器正在关闭',
      '08006': '连接失败',
      '08001': '无法建立连接',
      'ECONNREFUSED': '连接被拒绝，请检查主机和端口',
      'ETIMEDOUT': '连接超时',
      'ENOTFOUND': '无法解析主机名',
    };

    // 检查权限相关错误
    if (message.includes('permission denied')) {
      const tableMatch = message.match(/relation (\S+)/);
      const tableName = tableMatch ? tableMatch[1] : '某些表';
      return `权限不足：无法访问表 ${tableName}，请联系数据库管理员授权`;
    }

    return errorMessages[code] || message;
  }

  // 获取数据库版本信息
  async getVersion(): Promise<{ version: string; majorVersion: number }> {
    if (!this.client) await this.connect();
    return {
      version: this.serverVersion,
      majorVersion: this.majorVersion,
    };
  }

  // 获取数据库统计信息
  async getStats(): Promise<{
    databaseSize: string;
    tableCount: number;
    connectionCount: number;
  }> {
    if (!this.client) await this.connect();

    try {
      // 数据库大小
      const sizeResult = await this.client!.query(
        `SELECT pg_size_pretty(pg_database_size(current_database())) as size`
      );
      
      // 表数量
      const tableCountResult = await this.client!.query(
        `SELECT COUNT(*) as count FROM information_schema.tables 
         WHERE table_schema NOT IN ('pg_catalog', 'information_schema')`
      );
      
      // 连接数
      const connResult = await this.client!.query(
        `SELECT COUNT(*) as count FROM pg_stat_activity WHERE datname = current_database()`
      );

      return {
        databaseSize: sizeResult.rows[0]?.size || 'N/A',
        tableCount: parseInt(tableCountResult.rows[0]?.count) || 0,
        connectionCount: parseInt(connResult.rows[0]?.count) || 0,
      };
    } catch (e) {
      return {
        databaseSize: 'N/A',
        tableCount: 0,
        connectionCount: 0,
      };
    }
  }
}
