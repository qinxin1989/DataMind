/**
 * 审计日志服务
 * 实现操作日志的记录、查询和导出
 * 包含对话历史管理
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../core/database';
import type { AuditLog, AuditAction, AuditQueryParams, PaginatedResult } from '../../types';

const DATA_DIR = path.join(process.cwd(), 'data');
const AUDIT_DIR = path.join(DATA_DIR, 'audit-logs');

// 对话历史记录类型
export interface ChatHistoryRecord {
  id: string;
  userId: string;
  username: string;
  datasourceId: string;
  datasourceName: string;
  question: string;
  answer: string;
  sqlQuery?: string;
  tokensUsed: number;
  responseTime: number;
  status: 'success' | 'error';
  createdAt: number;
}

export interface ChatHistoryQueryParams {
  userId?: string;
  datasourceId?: string;
  keyword?: string;
  startTime?: number;
  endTime?: number;
  page: number;
  pageSize: number;
}

export class AuditService {
  constructor() {
    this.ensureDataDir();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(AUDIT_DIR)) {
      fs.mkdirSync(AUDIT_DIR, { recursive: true });
    }
  }

  private getLogFile(date: Date): string {
    const dateStr = date.toISOString().split('T')[0];
    return path.join(AUDIT_DIR, `${dateStr}.json`);
  }

  private readLogsFromFile(filePath: string): AuditLog[] {
    if (!fs.existsSync(filePath)) return [];
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return [];
    }
  }

  private writeLogsToFile(filePath: string, logs: AuditLog[]): void {
    fs.writeFileSync(filePath, JSON.stringify(logs, null, 2));
  }

  // ==================== 日志记录 ====================

  async log(entry: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    const log: AuditLog = {
      ...entry,
      id: uuidv4(),
      timestamp: Date.now(),
    };

    const filePath = this.getLogFile(new Date());
    const logs = this.readLogsFromFile(filePath);
    logs.push(log);
    this.writeLogsToFile(filePath, logs);

    return log;
  }

  // ==================== 日志查询 ====================

  async query(params: AuditQueryParams): Promise<PaginatedResult<AuditLog>> {
    const { userId, action, resourceType, startTime, endTime, page, pageSize } = params;
    
    // 获取时间范围内的所有日志文件
    const start = startTime ? new Date(startTime) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endTime ? new Date(endTime) : new Date();
    
    let allLogs: AuditLog[] = [];
    const current = new Date(start);
    
    while (current <= end) {
      const filePath = this.getLogFile(current);
      const logs = this.readLogsFromFile(filePath);
      allLogs = allLogs.concat(logs);
      current.setDate(current.getDate() + 1);
    }

    // 过滤
    let filtered = allLogs;
    
    if (userId) {
      filtered = filtered.filter(l => l.userId === userId);
    }
    if (action) {
      filtered = filtered.filter(l => l.action === action);
    }
    if (resourceType) {
      filtered = filtered.filter(l => l.resourceType === resourceType);
    }
    if (startTime) {
      filtered = filtered.filter(l => l.timestamp >= startTime);
    }
    if (endTime) {
      filtered = filtered.filter(l => l.timestamp <= endTime);
    }

    // 按时间倒序
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    const total = filtered.length;
    const startIdx = (page - 1) * pageSize;
    const list = filtered.slice(startIdx, startIdx + pageSize);

    return { list, total, page, pageSize };
  }


  // ==================== 日志导出 ====================

  async export(params: AuditQueryParams, format: 'csv' | 'json'): Promise<string> {
    const result = await this.query({ ...params, page: 1, pageSize: 10000 });
    const logs = result.list;

    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    }

    // CSV 格式
    const headers = ['ID', '用户ID', '用户名', '操作', '资源类型', '资源ID', 'IP', '时间'];
    const rows = logs.map(l => [
      l.id,
      l.userId,
      l.username,
      l.action,
      l.resourceType,
      l.resourceId,
      l.ip,
      new Date(l.timestamp).toISOString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(v => `"${v || ''}"`).join(',')),
    ].join('\n');

    return csvContent;
  }

  // ==================== 用户操作轨迹 ====================

  async getUserTrail(userId: string, startTime: number, endTime: number): Promise<AuditLog[]> {
    const result = await this.query({
      userId,
      startTime,
      endTime,
      page: 1,
      pageSize: 1000,
    });
    return result.list;
  }

  // ==================== 统计 ====================

  async getStats(startTime: number, endTime: number): Promise<{
    totalLogs: number;
    byAction: Record<string, number>;
    byUser: { userId: string; username: string; count: number }[];
  }> {
    const result = await this.query({ startTime, endTime, page: 1, pageSize: 100000 });
    const logs = result.list;

    const byAction: Record<string, number> = {};
    const byUserMap: Map<string, { username: string; count: number }> = new Map();

    for (const log of logs) {
      // 按操作统计
      byAction[log.action] = (byAction[log.action] || 0) + 1;

      // 按用户统计
      const userStats = byUserMap.get(log.userId) || { username: log.username, count: 0 };
      userStats.count++;
      byUserMap.set(log.userId, userStats);
    }

    const byUser = Array.from(byUserMap.entries())
      .map(([userId, stats]) => ({ userId, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalLogs: logs.length,
      byAction,
      byUser,
    };
  }

  // ==================== 对话历史管理 ====================

  /**
   * 记录对话历史
   */
  async logChat(record: Omit<ChatHistoryRecord, 'id' | 'createdAt'>): Promise<ChatHistoryRecord> {
    const id = uuidv4();
    const createdAt = Date.now();

    await pool.execute(
      `INSERT INTO sys_chat_history 
       (id, user_id, username, datasource_id, datasource_name, question, answer, sql_query, tokens_used, response_time, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, record.userId, record.username, record.datasourceId, record.datasourceName,
       record.question, record.answer, record.sqlQuery || null, record.tokensUsed, record.responseTime, record.status]
    );

    return { ...record, id, createdAt };
  }

  /**
   * 查询对话历史（从 chat_history 表读取）
   */
  async queryChatHistory(params: ChatHistoryQueryParams): Promise<PaginatedResult<ChatHistoryRecord>> {
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
      whereClause += ' AND ch.messages LIKE ?';
      queryParams.push(`%${keyword}%`);
    }
    if (startTime) {
      whereClause += ' AND ch.created_at >= FROM_UNIXTIME(?)';
      queryParams.push(Math.floor(startTime / 1000));
    }
    if (endTime) {
      whereClause += ' AND ch.created_at <= FROM_UNIXTIME(?)';
      queryParams.push(Math.floor(endTime / 1000));
    }

    // 获取所有会话数据（不分页，因为需要展开消息）
    const [rows] = await pool.query(
      `SELECT ch.*, u.username, dc.name as datasource_name
       FROM chat_history ch
       LEFT JOIN users u ON ch.user_id = u.id
       LEFT JOIN datasource_config dc ON ch.datasource_id = dc.id
       WHERE ${whereClause} 
       ORDER BY ch.updated_at DESC`,
      queryParams
    );

    // 解析消息并转换为对话历史记录
    const allRecords: ChatHistoryRecord[] = [];
    for (const row of rows as any[]) {
      try {
        const messages = typeof row.messages === 'string' ? JSON.parse(row.messages) : row.messages;
        // 每个会话可能有多轮对话
        for (let i = 0; i < messages.length; i += 2) {
          const userMsg = messages[i];
          const assistantMsg = messages[i + 1];
          if (userMsg && assistantMsg) {
            allRecords.push({
              id: `${row.id}-${i}`,
              userId: row.user_id,
              username: row.username || '未知用户',
              datasourceId: row.datasource_id,
              datasourceName: row.datasource_name || '未知数据源',
              question: userMsg.content,
              answer: assistantMsg.content,
              sqlQuery: assistantMsg.sql,
              tokensUsed: assistantMsg.tokensUsed || 0,
              responseTime: assistantMsg.responseTime || 0,
              status: 'success',
              createdAt: userMsg.timestamp || new Date(row.created_at).getTime(),
            });
          }
        }
      } catch (e) {
        // 解析失败，跳过
      }
    }

    // 按时间倒序排列
    allRecords.sort((a, b) => b.createdAt - a.createdAt);

    // 计算总数和分页
    const total = allRecords.length;
    const offset = (page - 1) * pageSize;
    const list = allRecords.slice(offset, offset + pageSize);

    return { list, total, page, pageSize };
  }

  /**
   * 获取对话历史统计
   */
  async getChatStats(startTime?: number, endTime?: number): Promise<{
    totalChats: number;
    totalTokens: number;
    avgResponseTime: number;
    successRate: number;
    byUser: { userId: string; username: string; count: number }[];
    byDatasource: { datasourceId: string; datasourceName: string; count: number }[];
  }> {
    let whereClause = '1=1';
    const queryParams: any[] = [];

    if (startTime) {
      whereClause += ' AND created_at >= FROM_UNIXTIME(?/1000)';
      queryParams.push(startTime);
    }
    if (endTime) {
      whereClause += ' AND created_at <= FROM_UNIXTIME(?/1000)';
      queryParams.push(endTime);
    }

    // 总体统计
    const [statsRows] = await pool.execute(
      `SELECT 
        COUNT(*) as total_chats,
        COALESCE(SUM(tokens_used), 0) as total_tokens,
        COALESCE(AVG(response_time), 0) as avg_response_time,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count
       FROM sys_chat_history WHERE ${whereClause}`,
      queryParams
    );
    const stats = (statsRows as any)[0];

    // 按用户统计
    const [userRows] = await pool.execute(
      `SELECT user_id, username, COUNT(*) as count 
       FROM sys_chat_history WHERE ${whereClause}
       GROUP BY user_id, username ORDER BY count DESC LIMIT 10`,
      queryParams
    );

    // 按数据源统计
    const [dsRows] = await pool.execute(
      `SELECT datasource_id, datasource_name, COUNT(*) as count 
       FROM sys_chat_history WHERE ${whereClause}
       GROUP BY datasource_id, datasource_name ORDER BY count DESC LIMIT 10`,
      queryParams
    );

    return {
      totalChats: stats.total_chats || 0,
      totalTokens: stats.total_tokens || 0,
      avgResponseTime: Math.round(stats.avg_response_time || 0),
      successRate: stats.total_chats > 0 ? (stats.success_count / stats.total_chats * 100) : 100,
      byUser: (userRows as any[]).map(r => ({ userId: r.user_id, username: r.username, count: r.count })),
      byDatasource: (dsRows as any[]).map(r => ({ datasourceId: r.datasource_id, datasourceName: r.datasource_name, count: r.count })),
    };
  }

  /**
   * 删除对话历史
   */
  async deleteChatHistory(id: string): Promise<void> {
    await pool.execute('DELETE FROM sys_chat_history WHERE id = ?', [id]);
  }

  // ==================== 便捷方法 ====================

  async logLogin(userId: string, username: string, ip: string, userAgent: string, success: boolean): Promise<AuditLog> {
    return this.log({
      userId,
      username,
      action: 'login',
      resourceType: 'session',
      resourceId: userId,
      ip,
      userAgent,
    });
  }

  async logCreate(userId: string, username: string, resourceType: string, resourceId: string, newValue: any, ip: string, userAgent: string): Promise<AuditLog> {
    return this.log({
      userId,
      username,
      action: 'create',
      resourceType,
      resourceId,
      newValue: JSON.stringify(newValue),
      ip,
      userAgent,
    });
  }

  async logUpdate(userId: string, username: string, resourceType: string, resourceId: string, oldValue: any, newValue: any, ip: string, userAgent: string): Promise<AuditLog> {
    return this.log({
      userId,
      username,
      action: 'update',
      resourceType,
      resourceId,
      oldValue: JSON.stringify(oldValue),
      newValue: JSON.stringify(newValue),
      ip,
      userAgent,
    });
  }

  async logDelete(userId: string, username: string, resourceType: string, resourceId: string, oldValue: any, ip: string, userAgent: string): Promise<AuditLog> {
    return this.log({
      userId,
      username,
      action: 'delete',
      resourceType,
      resourceId,
      oldValue: JSON.stringify(oldValue),
      ip,
      userAgent,
    });
  }

  // ==================== 测试辅助 ====================

  clearAll(): void {
    if (fs.existsSync(AUDIT_DIR)) {
      const files = fs.readdirSync(AUDIT_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(AUDIT_DIR, file));
      }
    }
  }
}

export const auditService = new AuditService();
