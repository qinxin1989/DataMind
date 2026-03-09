import mysql from 'mysql2/promise';
import { BaseDataSource } from './base';
import { DatabaseConfig, TableSchema, ColumnInfo, QueryResult } from '../types';

export class MySQLDataSource extends BaseDataSource {
  private pool: mysql.Pool | null = null;
  private connection: mysql.Connection | null = null;
  private config: DatabaseConfig;

  private readonly queryTimeoutMs: number;
  private readonly slowQueryThresholdMs: number;
  private readonly enableSlowQueryLog: boolean;
  private readonly explainOnSlowQuery: boolean;

  constructor(config: DatabaseConfig) {
    super();
    this.config = config;

    // 默认：查询超时 120s，慢查询阈值 2000ms，日志默认开启
    const timeoutSec = Number(process.env.DATAMIND_MYSQL_QUERY_TIMEOUT_SECONDS ?? '120');
    this.queryTimeoutMs = Number.isFinite(timeoutSec) && timeoutSec > 0 ? timeoutSec * 1000 : 120_000;

    const slowMs = Number(process.env.DATAMIND_SLOW_QUERY_MS ?? '2000');
    this.slowQueryThresholdMs = Number.isFinite(slowMs) && slowMs >= 0 ? slowMs : 2000;

    const slowLogEnv = (process.env.DATAMIND_SLOW_QUERY_LOG ?? '1').toLowerCase();
    this.enableSlowQueryLog = !(slowLogEnv === '0' || slowLogEnv === 'false' || slowLogEnv === 'off');

    const explainEnv = (process.env.DATAMIND_MYSQL_EXPLAIN_SLOW ?? '0').toLowerCase();
    this.explainOnSlowQuery = !(explainEnv === '0' || explainEnv === 'false' || explainEnv === 'off');
  }

  async connect(): Promise<void> {
    // 优先初始化连接池（避免单连接长时间占用导致的 server-side 断开 / inactivity timeout）
    if (!this.pool) {
      this.pool = mysql.createPool({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 10000,
        enableKeepAlive: true as any,
        keepAliveInitialDelay: 0 as any,
      } as any);
    }

    // 兼容旧逻辑：仍允许 fetchSchema 使用 this.connection，但若没有则从 pool 获取一个临时连接
    if (!this.connection && this.pool) {
      this.connection = await this.pool.getConnection();
      try {
        await this.connection.ping();
      } catch {
        try { (this.connection as any).release?.(); } catch { /* ignore */ }
        this.connection = null;
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        (this.connection as any).release?.();
      } catch {
        await this.connection.end();
      }
      this.connection = null;
    }
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
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

  protected async fetchSchema(): Promise<TableSchema[]> {
    if (!this.connection) await this.connect();

    // 1. 查询所有表名 (1 次查询)
    const [tables] = await this.connection!.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME NOT IN ('datasource_config', 'chat_history')`,
      [this.config.database]
    );

    const tableNames = (tables as any[]).map(t => t.TABLE_NAME);
    if (tableNames.length === 0) return [];

    // 2. 批量查询所有表的列信息 (1 次查询，替代 N 次)
    const [allColumns] = await this.connection!.query(
      `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_COMMENT 
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (?)
       ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [this.config.database, tableNames]
    );

    // 按表名分组列信息
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

    // 3. 并行查询所有表的样例数据 (N 次查询，但并行执行)
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

    // 4. 组装结果
    return tableNames.map(tableName => ({
      tableName,
      columns: columnsByTable.get(tableName) || [],
      sampleData: sampleByTable.get(tableName) || [],
    }));
  }

  async executeQuery(sql: string, signal?: AbortSignal): Promise<QueryResult> {
    try {
      if (!this.pool) await this.connect();
      
      const start = Date.now();

      // 每次查询从 pool 获取独立连接，防止长链路/中间态导致的连接被服务端断开
      const conn = await this.pool!.getConnection();
      let destroyed = false;
      
      // 设置取消监听：取消时主动断开连接以中止服务端正在执行的语句
      let cancelHandler: (() => void) | undefined;
      const cancelPromise = signal ? new Promise<never>((_, reject) => {
        cancelHandler = () => {
          try {
            // destroy 会触发 socket 断开，通常能打断长时间执行的查询
            (conn as any).destroy?.();
            destroyed = true;
          } catch {
            // ignore
          }
          reject(new Error('Query cancelled'));
        };
        signal.addEventListener('abort', cancelHandler);
      }) : undefined;

      const queryPromise = conn.query({ sql, timeout: this.queryTimeoutMs });
      
      // 竞速执行查询或等待取消
      const queryOrCancel = cancelPromise
        ? Promise.race([queryPromise, cancelPromise])
        : queryPromise;

      const [rows] = await queryOrCancel;
      
      // 清理取消监听
      if (cancelHandler && signal) {
        signal.removeEventListener('abort', cancelHandler);
      }

      if (!destroyed) {
        try {
          (conn as any).release?.();
        } catch {
          // ignore
        }
      }
      
      const costMs = Date.now() - start;

      if (this.enableSlowQueryLog && costMs >= this.slowQueryThresholdMs) {
        console.warn(`[MySQLDataSource] 慢查询 ${costMs}ms (rows=${(rows as any[]).length})`);
        console.warn(`[MySQLDataSource] SQL: ${sql}`);

        if (this.explainOnSlowQuery && /^\s*select\b/i.test(sql)) {
          try {
            // 使用独立连接执行 EXPLAIN，避免复用 schema 连接或已释放的连接导致异常
            const explainConn = await this.pool!.getConnection();
            try {
              const [plan] = await explainConn.query({ sql: `EXPLAIN ${sql}`, timeout: Math.min(this.queryTimeoutMs, 30_000) });
              console.warn(`[MySQLDataSource] EXPLAIN: ${JSON.stringify(plan)}`);
            } finally {
              try { (explainConn as any).release?.(); } catch { /* ignore */ }
            }
          } catch (e: any) {
            console.warn(`[MySQLDataSource] EXPLAIN 失败: ${e.message}`);
          }
        }
      }

      return { success: true, data: rows as any[], sql, rowCount: (rows as any[]).length };
    } catch (error: any) {
      // 尽量释放取消监听，避免后续影响连接池
      try {
        if (signal) {
          // 这里无法拿到 cancelHandler 作用域外的引用时就忽略；上面成功路径已移除
        }
      } catch {
        // ignore
      }

      const msg = error?.message || String(error);
      const code = error?.code ? String(error.code) : '';
      const errno = typeof error?.errno !== 'undefined' ? String(error.errno) : '';
      const extra = [code && `code=${code}`, errno && `errno=${errno}`].filter(Boolean).join(' ');
      // 如果是取消错误，返回特定状态
      if (msg.includes('cancelled')) {
        console.warn(`[MySQLDataSource] 查询被取消: ${sql.substring(0, 100)}...`);
        return { success: false, error: 'Query cancelled', sql, cancelled: true };
      }

      // 连接已关闭/被 destroy 的典型错误，自动重试一次（重新取连接执行）
      if (msg.includes('closed state') || msg.includes('Cannot enqueue') || msg.includes('PROTOCOL_ENQUEUE_AFTER_QUIT')) {
        try {
          console.warn(`[MySQLDataSource] 连接已关闭，重试一次: ${msg}`);
          if (!this.pool) await this.connect();
          const retryConn = await this.pool!.getConnection();
          try {
            const [rows] = await retryConn.query({ sql, timeout: this.queryTimeoutMs });
            return { success: true, data: rows as any[], sql, rowCount: (rows as any[]).length };
          } finally {
            try { (retryConn as any).release?.(); } catch { /* ignore */ }
          }
        } catch (retryError: any) {
          const retryMsg = retryError?.message || String(retryError);
          console.error(`[MySQLDataSource] 重试仍失败: ${retryMsg}`);
        }
      }

      console.error(`[MySQLDataSource] 查询失败: ${msg}${extra ? ` (${extra})` : ''}`);
      return { success: false, error: msg, sql };
    }
  }
}
