/**
 * AI统计服务
 * 使用 MySQL 存储对话历史和统计数据
 */

import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../../src/admin/core/database';
import type { 
  AIUsageStats, 
  ConversationHistory, 
  ConversationQueryParams, 
  PaginatedResult,
  UserStats
} from './types';

export class AIStatsService {
  // ==================== 对话记录 ====================

  async recordConversation(data: Omit<ConversationHistory, 'id' | 'createdAt'>): Promise<ConversationHistory> {
    const id = uuidv4();
    const now = new Date();

    await pool.execute(
      `INSERT INTO sys_chat_history 
       (id, user_id, username, datasource_id, datasource_name, question, answer, sql_query, tokens_used, response_time, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.userId,
        data.username || null,
        data.datasourceId,
        data.datasourceName || null,
        data.question,
        data.answer,
        data.sqlQuery || null,
        data.tokensUsed || 0,
        data.responseTime || 0,
        data.status || 'success',
        now
      ]
    );

    return {
      ...data,
      id,
      createdAt: now.getTime(),
    };
  }

  async getConversationById(userId: string, id: string): Promise<ConversationHistory | null> {
    const [rows] = await pool.execute(
      'SELECT * FROM sys_chat_history WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    const records = rows as any[];
    if (records.length === 0) return null;

    return this.mapRowToConversation(records[0]);
  }

  async deleteConversation(userId: string, id: string): Promise<void> {
    const [result] = await pool.execute(
      'DELETE FROM sys_chat_history WHERE id = ? AND user_id = ?',
      [id, userId]
    ) as any;

    if (result.affectedRows === 0) {
      throw new Error('对话记录不存在');
    }
  }

  // ==================== 对话查询 ====================

  async queryConversations(params: ConversationQueryParams): Promise<PaginatedResult<ConversationHistory>> {
    const { userId, datasourceId, keyword, startTime, endTime, page = 1, pageSize = 20 } = params;

    let whereClause = '1=1';
    const queryParams: any[] = [];

    if (userId) {
      whereClause += ' AND user_id = ?';
      queryParams.push(userId);
    }
    if (datasourceId) {
      whereClause += ' AND datasource_id = ?';
      queryParams.push(datasourceId);
    }
    if (keyword) {
      whereClause += ' AND (question LIKE ? OR answer LIKE ?)';
      queryParams.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (startTime) {
      whereClause += ' AND created_at >= ?';
      queryParams.push(new Date(startTime));
    }
    if (endTime) {
      whereClause += ' AND created_at <= ?';
      queryParams.push(new Date(endTime));
    }

    // 获取总数
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM sys_chat_history WHERE ${whereClause}`,
      queryParams
    );
    const total = (countResult as any)[0].total;

    // 获取分页数据
    const offset = (page - 1) * pageSize;
    const limitClause = `LIMIT ${offset}, ${pageSize}`;
    const [rows] = await pool.execute(
      `SELECT * FROM sys_chat_history WHERE ${whereClause} ORDER BY created_at DESC ${limitClause}`,
      queryParams
    );

    const list = (rows as any[]).map(row => this.mapRowToConversation(row));

    return { list, total, page, pageSize };
  }

  // ==================== 使用统计 ====================

  async getUsageStats(startTime: number, endTime: number): Promise<AIUsageStats> {
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    // 从 sys_chat_history 表读取数据
    const [sessionsResult] = await pool.execute(
      `SELECT ch.*, u.username 
       FROM sys_chat_history ch
       LEFT JOIN sys_users u ON ch.user_id = u.id
       WHERE ch.created_at >= ? AND ch.created_at <= ?`,
      [startDate, endDate]
    );

    const sessions = sessionsResult as any[];

    // 统计数据
    let totalRequests = sessions.length;
    let totalTokens = 0;
    const requestsByDayMap = new Map<string, number>();
    const tokensByDayMap = new Map<string, number>();
    const userStatsMap = new Map<string, { username: string; requests: number; tokens: number }>();

    for (const session of sessions) {
      const sessionDate = new Date(session.created_at).toISOString().split('T')[0];
      const username = session.username || session.user_id || 'unknown';
      const userId = session.user_id;
      const tokens = session.tokens_used || 0;

      totalTokens += tokens;

      // 按天统计
      requestsByDayMap.set(sessionDate, (requestsByDayMap.get(sessionDate) || 0) + 1);
      tokensByDayMap.set(sessionDate, (tokensByDayMap.get(sessionDate) || 0) + tokens);

      // 按用户统计
      const userStats = userStatsMap.get(userId) || { username, requests: 0, tokens: 0 };
      userStats.requests++;
      userStats.tokens += tokens;
      userStatsMap.set(userId, userStats);
    }

    // 转换为数组
    const requestsByDay = Array.from(requestsByDayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const tokensByDay = Array.from(tokensByDayMap.entries())
      .map(([date, tokens]) => ({ date, tokens }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const topUsers = Array.from(userStatsMap.entries())
      .map(([userId, stats]) => ({ userId, ...stats }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);



    // 估算成本 (假设 $0.002 per 1K tokens)
    const estimatedCost = (totalTokens / 1000) * 0.002;

    return {
      totalRequests,
      totalTokens,
      estimatedCost,
      requestsByDay,
      tokensByDay,
      topUsers,
    };
  }

  // ==================== 用户统计 ====================

  async getUserStats(userId: string, startTime: number, endTime: number): Promise<UserStats> {
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    const [result] = await pool.execute(
      `SELECT 
        COUNT(*) as totalRequests,
        COALESCE(SUM(tokens_used), 0) as totalTokens,
        COALESCE(AVG(response_time), 0) as avgResponseTime
       FROM sys_chat_history 
       WHERE user_id = ? AND created_at >= ? AND created_at <= ?`,
      [userId, startDate, endDate]
    );

    const stats = (result as any)[0];
    return {
      totalRequests: Number(stats.totalRequests),
      totalTokens: Number(stats.totalTokens),
      avgResponseTime: Number(stats.avgResponseTime),
    };
  }

  // ==================== 辅助方法 ====================

  private mapRowToConversation(row: any): ConversationHistory {
    return {
      id: row.id,
      userId: row.user_id,
      username: row.username || undefined,
      datasourceId: row.datasource_id,
      datasourceName: row.datasource_name || undefined,
      question: row.question,
      answer: row.answer,
      sqlQuery: row.sql_query || undefined,
      tokensUsed: row.tokens_used,
      responseTime: row.response_time,
      status: row.status,
      createdAt: new Date(row.created_at).getTime(),
    };
  }

  // ==================== 测试辅助 ====================

  async clearAll(): Promise<void> {
    await pool.execute('DELETE FROM sys_chat_history');
  }
}

export const aiStatsService = new AIStatsService();
