/**
 * 审计日志服务
 * 适配 MySQL 数据库与 sys_audit_logs 表
 */

import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../../src/admin/core/database';
import type {
  AuditLog,
  LogQueryParams,
  LogQueryResult,
  LogStats,
  ExportOptions,
  CleanupOptions,
  AuditLogModuleConfig,
  ChatHistoryRecord,
  ChatHistoryQueryParams
} from './types';

export class AuditLogService {
  private db: any;
  private config: AuditLogModuleConfig;

  constructor(db?: any, config?: Partial<AuditLogModuleConfig>) {
    this.db = db || pool;
    this.config = {
      retentionDays: 90,
      maxLogsPerQuery: 1000,
      enableAutoCleanup: true,
      autoCleanupInterval: 86400000, // 24小时
      ...config
    };
  }

  // ==================== 日志记录 ====================

  /**
   * 创建审计日志 (兼容旧版 log 方法)
   */
  async log(data: any): Promise<void> {
    const id = uuidv4();
    const {
      userId,
      username,
      action,
      resourceType,
      resourceId,
      newValue,
      oldValue,
      ip,
      userAgent,
      module = 'admin'
    } = data;

    const details = {
      old: oldValue,
      new: newValue
    };

    const query = `
      INSERT INTO sys_audit_logs 
      (id, user_id, username, action, module, target_type, target_id, details, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    await this.db.execute(query, [
      id,
      userId,
      username,
      action,
      module,
      resourceType || null,
      resourceId || null,
      JSON.stringify(details),
      ip || null,
      userAgent || null
    ]);
  }

  /**
   * 创建审计日志 (兼容 CreateLogRequest)
   */
  async createLog(request: any): Promise<AuditLog> {
    const id = uuidv4();

    const query = `
      INSERT INTO sys_audit_logs 
      (id, user_id, username, action, module, target_type, target_id, details, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    await this.db.execute(query, [
      id,
      request.userId,
      request.username,
      request.action,
      request.module || 'admin',
      request.resourceType || null,
      request.resourceId || null,
      request.details ? (typeof request.details === 'string' ? request.details : JSON.stringify(request.details)) : null,
      request.ipAddress || request.ip || null,
      request.userAgent || null
    ]);

    const log = await this.getLog(id);
    if (!log) {
      throw new Error('创建日志失败');
    }

    return log;
  }

  /**
   * 获取单个日志
   */
  async getLog(id: string): Promise<AuditLog | null> {
    const query = 'SELECT * FROM sys_audit_logs WHERE id = ?';
    const [rows]: any = await this.db.execute(query, [id]);
    return rows[0] ? this.mapRowToLog(rows[0]) : null;
  }

  /**
   * 查询日志
   */
  async queryLogs(params: LogQueryParams = {}): Promise<LogQueryResult> {
    const {
      userId,
      action,
      resourceType,
      status, // sys_audit_logs 没有 status 字段，暂忽略或映射到 details
      startDate,
      endDate,
      page = 1,
      pageSize = 20
    } = params;

    // 构建查询条件
    const conditions: string[] = ['1=1'];
    const values: any[] = [];

    if (userId) {
      conditions.push('user_id = ?');
      values.push(userId);
    }

    if (action) {
      conditions.push('action = ?');
      values.push(action);
    }

    if (resourceType) {
      conditions.push('target_type = ?');
      values.push(resourceType);
    }

    if (startDate) {
      conditions.push('created_at >= FROM_UNIXTIME(? / 1000)');
      values.push(startDate);
    }

    if (endDate) {
      conditions.push('created_at <= FROM_UNIXTIME(? / 1000)');
      values.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const params1 = values.map(v => v === undefined ? null : v);

    // 获取总数
    const countQuery = `SELECT COUNT(*) as total FROM sys_audit_logs ${whereClause}`;
    console.log('[AuditLog] Count Query:', countQuery, 'Params:', params1);
    const [countRows]: any = await this.db.execute(countQuery, params1);
    const total = countRows[0].total;

    // 获取数据 - LIMIT/OFFSET 不使用参数绑定，因可能导致Incorrect arguments错误
    const offset = (Number(page) - 1) * Number(pageSize);
    const dataQuery = `
      SELECT * FROM sys_audit_logs 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${Number(pageSize)} OFFSET ${offset}
    `;
    // 移除最后两个参数
    console.log('[AuditLog] Data Query:', dataQuery, 'Params:', params1);
    const [rows]: any = await this.db.execute(dataQuery, params1);

    return {
      total,
      page,
      pageSize,
      items: rows.map((row: any) => this.mapRowToLog(row))
    };
  }

  /**
   * 删除日志
   */
  async deleteLog(id: string): Promise<void> {
    const query = 'DELETE FROM sys_audit_logs WHERE id = ?';
    await this.db.execute(query, [id]);
  }

  // ==================== 日志统计 ====================

  /**
   * 获取日志统计
   */
  async getStats(startDate?: number, endDate?: number): Promise<LogStats> {
    const conditions: string[] = ['1=1'];
    const values: any[] = [];

    if (startDate) {
      conditions.push('created_at >= FROM_UNIXTIME(? / 1000)');
      values.push(startDate);
    }

    if (endDate) {
      conditions.push('created_at <= FROM_UNIXTIME(? / 1000)');
      values.push(endDate);
    }

    const whereClause = conditions.join(' AND ');

    // 总日志数
    const [totalRows]: any = await this.db.execute(`SELECT COUNT(*) as total FROM sys_audit_logs WHERE ${whereClause}`, values.map(v => v ?? null));
    const totalLogs = totalRows[0].total;

    // 热门操作
    const topActionsQuery = `
      SELECT action, COUNT(*) as count 
      FROM sys_audit_logs WHERE ${whereClause}
      GROUP BY action 
      ORDER BY count DESC 
      LIMIT 10
    `;
    const [topActions]: any = await this.db.execute(topActionsQuery, values.map(v => v ?? null));

    // 热门用户
    const topUsersQuery = `
      SELECT user_id, username, COUNT(*) as count 
      FROM sys_audit_logs WHERE ${whereClause}
      GROUP BY user_id, username 
      ORDER BY count DESC 
      LIMIT 10
    `;
    const [topUsers]: any = await this.db.execute(topUsersQuery, values.map(v => v ?? null));

    // 按日期统计
    const logsByDateQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count 
      FROM sys_audit_logs WHERE ${whereClause}
      GROUP BY date 
      ORDER BY date DESC 
      LIMIT 30
    `;
    const [logsByDate]: any = await this.db.execute(logsByDateQuery, values.map(v => v ?? null));

    return {
      totalLogs,
      successLogs: totalLogs, // 暂不区分成功失败
      failedLogs: 0,
      topActions: topActions.map((row: any) => ({
        action: row.action,
        count: row.count
      })),
      topUsers: topUsers.map((row: any) => ({
        userId: row.user_id,
        username: row.username,
        count: row.count
      })),
      logsByDate: logsByDate.map((row: any) => ({
        date: row.date,
        count: row.count
      }))
    };
  }

  // ==================== 日志导出 ====================

  /**
   * 导出日志
   */
  async exportLogs(options: ExportOptions): Promise<string> {
    const { format, startDate, endDate, userId, action } = options;

    // 查询日志
    const result = await this.queryLogs({
      userId,
      action,
      startDate,
      endDate,
      page: 1,
      pageSize: this.config.maxLogsPerQuery
    });

    if (format === 'json') {
      return JSON.stringify(result.items, null, 2);
    } else if (format === 'csv') {
      return this.convertToCSV(result.items);
    }

    throw new Error('不支持的导出格式');
  }

  /**
   * 转换为CSV格式
   */
  private convertToCSV(logs: AuditLog[]): string {
    if (logs.length === 0) {
      return '';
    }

    // CSV头部
    const headers = [
      'ID',
      '用户ID',
      '用户名',
      '操作',
      '资源类型',
      '资源ID',
      '详情',
      'IP地址',
      '用户代理',
      '创建时间'
    ];

    // CSV行
    const rows = logs.map(log => [
      log.id,
      log.userId,
      log.username,
      log.action,
      log.resourceType || '',
      log.resourceId || '',
      log.details || '',
      log.ipAddress || '',
      log.userAgent || '',
      new Date(log.createdAt).toISOString()
    ]);

    // 组合CSV
    const csvLines = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ];

    return csvLines.join('\n');
  }

  // ==================== 日志清理 ====================

  /**
   * 清理过期日志
   */
  async cleanupLogs(options: CleanupOptions): Promise<number> {
    const { beforeDate } = options;

    const query = 'DELETE FROM sys_audit_logs WHERE created_at < FROM_UNIXTIME(? / 1000)';
    const [result]: any = await this.db.execute(query, [beforeDate]);
    return result.affectedRows || 0;
  }

  /**
   * 自动清理过期日志
   */
  async autoCleanup(): Promise<number> {
    const beforeDate = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    return await this.cleanupLogs({ beforeDate });
  }

  // ==================== 辅助方法 ====================

  /**
   * 映射数据库行到日志对象
   */
  private mapRowToLog(row: any): AuditLog {
    const timestamp = row.created_at ? new Date(row.created_at).getTime() : Date.now();
    return {
      id: row.id,
      userId: row.user_id,
      username: row.username,
      action: row.action,
      module: row.module,
      resourceType: row.target_type,
      resourceId: row.target_id,
      details: typeof row.details === 'string' ? row.details : JSON.stringify(row.details),
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      status: 'success',
      createdAt: timestamp,
      // Compatibility fields for frontend
      ip: row.ip_address,
      timestamp: timestamp
    } as any;
  }

  // ==================== 用户操作轨迹 ====================

  async getUserTrail(userId: string, startTime: number, endTime: number): Promise<LogQueryResult> {
    return this.queryLogs({
      userId,
      startDate: startTime,
      endDate: endTime,
      page: 1,
      pageSize: 1000,
    });
  }

  // ==================== 对话历史管理 ====================

  async logChat(record: Omit<ChatHistoryRecord, 'id' | 'createdAt'>): Promise<ChatHistoryRecord> {
    const id = uuidv4();
    const createdAt = Date.now();

    await this.db.execute(
      `INSERT INTO sys_chat_history
       (id, user_id, username, datasource_id, datasource_name, question, answer, sql_query, tokens_used, response_time, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [id, record.userId, record.username, record.datasourceId, record.datasourceName,
        record.question, record.answer, record.sqlQuery || null, record.tokensUsed, record.responseTime, record.status]
    );

    return { ...record, id, createdAt };
  }

  async queryChatHistory(params: ChatHistoryQueryParams): Promise<{ list: ChatHistoryRecord[]; total: number; page: number; pageSize: number }> {
    const { userId, datasourceId, keyword, startTime, endTime, page, pageSize } = params;

    let whereClause = '1=1';
    const queryParams: any[] = [];

    if (userId) {
      whereClause += ' AND ch.user_id = ?';
      queryParams.push(userId);
    }
    if (datasourceId) {
      whereClause += ' AND ch.datasource_id = ?';
      queryParams.push(datasourceId);
    }
    if (keyword) {
      whereClause += ' AND (ch.question LIKE ? OR ch.answer LIKE ?)';
      queryParams.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (startTime) {
      whereClause += ' AND ch.created_at >= FROM_UNIXTIME(? / 1000)';
      queryParams.push(startTime);
    }
    if (endTime) {
      whereClause += ' AND ch.created_at <= FROM_UNIXTIME(? / 1000)';
      queryParams.push(endTime);
    }

    const [totalRows]: any = await this.db.query(
      `SELECT COUNT(*) as total FROM sys_chat_history ch WHERE ${whereClause}`,
      queryParams
    );
    const total = totalRows[0].total;

    const offset = (page - 1) * pageSize;
    const [rows]: any = await this.db.query(
      `SELECT ch.* FROM sys_chat_history ch
       WHERE ${whereClause}
       ORDER BY ch.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, pageSize, offset]
    );

    const list = (rows as any[]).map(row => ({
      id: row.id,
      userId: row.user_id,
      username: row.username || '未知用户',
      datasourceId: row.datasource_id,
      datasourceName: row.datasource_name || '未知数据源',
      question: row.question,
      answer: row.answer,
      sqlQuery: row.sql_query,
      tokensUsed: row.tokens_used || 0,
      responseTime: row.response_time || 0,
      status: row.status as 'success' | 'error',
      createdAt: new Date(row.created_at).getTime(),
    }));

    return { list, total, page, pageSize };
  }

  async getChatStats(startTime?: number, endTime?: number): Promise<any> {
    let whereClause = '1=1';
    const queryParams: any[] = [];

    if (startTime) {
      whereClause += ' AND created_at >= FROM_UNIXTIME(? / 1000)';
      queryParams.push(startTime);
    }
    if (endTime) {
      whereClause += ' AND created_at <= FROM_UNIXTIME(? / 1000)';
      queryParams.push(endTime);
    }

    const [statsRows]: any = await this.db.execute(
      `SELECT
        COUNT(*) as total_chats,
        COALESCE(SUM(tokens_used), 0) as total_tokens,
        COALESCE(AVG(response_time), 0) as avg_response_time,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count
       FROM sys_chat_history WHERE ${whereClause}`,
      queryParams
    );
    const stats = statsRows[0];

    return {
      totalChats: stats.total_chats || 0,
      totalTokens: stats.total_tokens || 0,
      avgResponseTime: Math.round(stats.avg_response_time || 0),
      successRate: stats.total_chats > 0 ? (stats.success_count / stats.total_chats * 100) : 100,
    };
  }

  async deleteChatHistory(id: string): Promise<void> {
    await this.db.execute('DELETE FROM sys_chat_history WHERE id = ?', [id]);
  }

  // ==================== 便捷方法 ====================

  async logLogin(userId: string, username: string, ip: string, userAgent: string): Promise<void> {
    await this.log({
      userId,
      username,
      action: 'login',
      resourceType: 'auth',
      ip,
      userAgent
    });
  }
}

export const auditService = new AuditLogService();
