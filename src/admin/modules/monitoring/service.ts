/**
 * 性能监控服务
 */

import { getDatabase } from '../../core/database';

export class MonitoringService {
  /**
   * 获取实时性能指标
   */
  async getRealtimeMetrics() {
    const db = getDatabase();
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // API 性能
    const [apiMetrics] = await db.query<any[]>(
      `SELECT AVG(duration) as avg_duration, COUNT(*) as count
       FROM performance_metrics
       WHERE type = 'api' AND created_at >= ?`,
      [fiveMinutesAgo]
    );

    // 数据库性能
    const [dbMetrics] = await db.query<any[]>(
      `SELECT AVG(duration) as avg_duration, COUNT(*) as count
       FROM performance_metrics
       WHERE type = 'database' AND created_at >= ?`,
      [fiveMinutesAgo]
    );

    // 系统指标
    const [sysMetrics] = await db.query<any[]>(
      `SELECT memory_percentage, cpu_usage
       FROM system_metrics
       ORDER BY created_at DESC
       LIMIT 1`
    );

    // QPS 计算
    const qps = (apiMetrics[0]?.count || 0) / 300; // 5分钟 = 300秒

    return {
      api: {
        avgDuration: apiMetrics[0]?.avg_duration || 0,
        qps: qps.toFixed(2)
      },
      database: {
        avgDuration: dbMetrics[0]?.avg_duration || 0,
        count: dbMetrics[0]?.count || 0
      },
      system: {
        memoryUsage: sysMetrics[0]?.memory_percentage || 0,
        cpuUsage: sysMetrics[0]?.cpu_usage || 0
      }
    };
  }

  /**
   * 获取历史性能数据
   */
  async getHistoryMetrics(hours: number = 24) {
    const db = getDatabase();
    const now = new Date();
    const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);

    const [metrics] = await db.query<any[]>(
      `SELECT 
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:00') as time,
        type,
        AVG(duration) as avg_duration
       FROM performance_metrics
       WHERE created_at >= ? AND type IN ('api', 'database')
       GROUP BY time, type
       ORDER BY time`,
      [startTime]
    );

    return metrics;
  }

  /**
   * 获取慢查询列表
   */
  async getSlowQueries(limit: number = 50) {
    const db = getDatabase();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [queries] = await db.query<any[]>(
      `SELECT name, duration, metadata, created_at
       FROM performance_metrics
       WHERE type = 'database' AND created_at >= ? AND duration > 100
       ORDER BY duration DESC
       LIMIT ?`,
      [oneDayAgo, limit]
    );

    return queries;
  }

  /**
   * 获取性能告警列表
   */
  async getAlerts(resolved: boolean = false, limit: number = 100) {
    const db = getDatabase();

    const [alerts] = await db.query<any[]>(
      `SELECT * FROM performance_alerts
       WHERE resolved = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [resolved, limit]
    );

    return alerts;
  }

  /**
   * 获取性能报告列表
   */
  async getReports(type?: 'daily' | 'weekly', limit: number = 30) {
    const db = getDatabase();

    let sql = 'SELECT * FROM performance_reports';
    const params: any[] = [];

    if (type) {
      sql += ' WHERE type = ?';
      params.push(type);
    }

    sql += ' ORDER BY period_start DESC LIMIT ?';
    params.push(limit);

    const [reports] = await db.query<any[]>(sql, params);
    return reports;
  }

  /**
   * 获取性能报告详情
   */
  async getReportById(id: string) {
    const db = getDatabase();

    const [reports] = await db.query<any[]>(
      'SELECT * FROM performance_reports WHERE id = ?',
      [id]
    );

    return reports[0] || null;
  }
}
