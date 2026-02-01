/**
 * 审计日志服务
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  AuditLog,
  CreateLogRequest,
  LogQueryParams,
  LogQueryResult,
  LogStats,
  ExportOptions,
  CleanupOptions,
  AuditLogModuleConfig
} from './types';

export class AuditLogService {
  private db: any;
  private config: AuditLogModuleConfig;

  constructor(db: any, config?: Partial<AuditLogModuleConfig>) {
    this.db = db;
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
   * 创建审计日志
   */
  async createLog(request: CreateLogRequest): Promise<AuditLog> {
    const id = uuidv4();
    const now = Date.now();

    const query = `
      INSERT INTO audit_logs 
      (id, user_id, username, action, resource_type, resource_id, details, ip_address, user_agent, status, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.run(query, [
      id,
      request.userId,
      request.username,
      request.action,
      request.resourceType || null,
      request.resourceId || null,
      request.details || null,
      request.ipAddress || null,
      request.userAgent || null,
      request.status,
      request.errorMessage || null,
      now
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
    const query = 'SELECT * FROM audit_logs WHERE id = ?';
    const row = await this.db.get(query, [id]);
    return row ? this.mapRowToLog(row) : null;
  }

  /**
   * 查询日志
   */
  async queryLogs(params: LogQueryParams = {}): Promise<LogQueryResult> {
    const {
      userId,
      action,
      resourceType,
      status,
      startDate,
      endDate,
      page = 1,
      pageSize = 20
    } = params;

    // 构建查询条件
    const conditions: string[] = [];
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
      conditions.push('resource_type = ?');
      values.push(resourceType);
    }

    if (status) {
      conditions.push('status = ?');
      values.push(status);
    }

    if (startDate) {
      conditions.push('created_at >= ?');
      values.push(startDate);
    }

    if (endDate) {
      conditions.push('created_at <= ?');
      values.push(endDate);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // 获取总数
    const countQuery = `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`;
    const countResult = await this.db.get(countQuery, values);
    const total = countResult.total;

    // 获取数据
    const offset = (page - 1) * pageSize;
    const dataQuery = `
      SELECT * FROM audit_logs 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    const rows = await this.db.all(dataQuery, [...values, pageSize, offset]);

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
    const query = 'DELETE FROM audit_logs WHERE id = ?';
    await this.db.run(query, [id]);
  }

  // ==================== 日志统计 ====================

  /**
   * 获取日志统计
   */
  async getStats(startDate?: number, endDate?: number): Promise<LogStats> {
    const conditions: string[] = [];
    const values: any[] = [];

    if (startDate) {
      conditions.push('created_at >= ?');
      values.push(startDate);
    }

    if (endDate) {
      conditions.push('created_at <= ?');
      values.push(endDate);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // 总日志数
    const totalQuery = `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`;
    const totalResult = await this.db.get(totalQuery, values);
    const totalLogs = totalResult.total;

    // 成功日志数
    const successQuery = `SELECT COUNT(*) as count FROM audit_logs ${whereClause} ${whereClause ? 'AND' : 'WHERE'} status = 'success'`;
    const successResult = await this.db.get(successQuery, values);
    const successLogs = successResult.count;

    // 失败日志数
    const failedLogs = totalLogs - successLogs;

    // 热门操作
    const topActionsQuery = `
      SELECT action, COUNT(*) as count 
      FROM audit_logs ${whereClause}
      GROUP BY action 
      ORDER BY count DESC 
      LIMIT 10
    `;
    const topActions = await this.db.all(topActionsQuery, values);

    // 热门用户
    const topUsersQuery = `
      SELECT user_id, username, COUNT(*) as count 
      FROM audit_logs ${whereClause}
      GROUP BY user_id, username 
      ORDER BY count DESC 
      LIMIT 10
    `;
    const topUsers = await this.db.all(topUsersQuery, values);

    // 按日期统计
    const logsByDateQuery = `
      SELECT 
        DATE(created_at / 1000, 'unixepoch') as date,
        COUNT(*) as count 
      FROM audit_logs ${whereClause}
      GROUP BY date 
      ORDER BY date DESC 
      LIMIT 30
    `;
    const logsByDate = await this.db.all(logsByDateQuery, values);

    return {
      totalLogs,
      successLogs,
      failedLogs,
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
      '状态',
      '错误信息',
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
      log.status,
      log.errorMessage || '',
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
    const { beforeDate, status } = options;

    let query = 'DELETE FROM audit_logs WHERE created_at < ?';
    const values: any[] = [beforeDate];

    if (status) {
      query += ' AND status = ?';
      values.push(status);
    }

    const result = await this.db.run(query, values);
    return result.changes || 0;
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
    return {
      id: row.id,
      userId: row.user_id,
      username: row.username,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      details: row.details,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      status: row.status,
      errorMessage: row.error_message,
      createdAt: row.created_at
    };
  }
}
