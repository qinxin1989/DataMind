/**
 * 性能报告生成器
 * 自动生成每日和每周性能报告
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../../admin/core/database';

/**
 * 报告类型
 */
export type ReportType = 'daily' | 'weekly';

/**
 * 报告接口
 */
export interface PerformanceReport {
  id: string;
  type: ReportType;
  period_start: Date;
  period_end: Date;
  content: string;
  created_at?: Date;
}

/**
 * 报告生成器类
 */
export class ReportGenerator {
  /**
   * 生成每日报告
   */
  public async generateDailyReport(date?: Date): Promise<PerformanceReport> {
    const targetDate = date || new Date();
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    const content = await this.generateDailyContent(startDate, endDate);

    const report: PerformanceReport = {
      id: uuidv4(),
      type: 'daily',
      period_start: startDate,
      period_end: endDate,
      content
    };

    await this.saveReport(report);
    return report;
  }

  /**
   * 生成每周报告
   */
  public async generateWeeklyReport(date?: Date): Promise<PerformanceReport> {
    const targetDate = date || new Date();
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    const content = await this.generateWeeklyContent(startDate, endDate);

    const report: PerformanceReport = {
      id: uuidv4(),
      type: 'weekly',
      period_start: startDate,
      period_end: endDate,
      content
    };

    await this.saveReport(report);
    return report;
  }

  /**
   * 生成每日报告内容
   */
  private async generateDailyContent(startDate: Date, endDate: Date): Promise<string> {
    const db = getDatabase();
    const dateStr = startDate.toISOString().split('T')[0];

    let content = `# 性能日报 - ${dateStr}\n\n`;
    content += `**报告周期**: ${startDate.toLocaleString()} ~ ${endDate.toLocaleString()}\n\n`;

    // API 性能统计
    const [apiStats] = await db.query<any[]>(
      `SELECT 
        COUNT(*) as total_requests,
        AVG(duration) as avg_duration,
        MIN(duration) as min_duration,
        MAX(duration) as max_duration,
        SUM(CASE WHEN JSON_EXTRACT(metadata, '$.statusCode') >= 400 THEN 1 ELSE 0 END) as errors
       FROM performance_metrics
       WHERE type = 'api' AND created_at BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    const apiStat = apiStats[0] || {};
    const errorRate = apiStat.total_requests > 0 ? (apiStat.errors / apiStat.total_requests * 100).toFixed(2) : '0.00';

    content += `## API 性能统计\n\n`;
    content += `- 总请求数: ${apiStat.total_requests || 0}\n`;
    content += `- 平均响应时间: ${(apiStat.avg_duration || 0).toFixed(2)}ms\n`;
    content += `- 最快响应: ${(apiStat.min_duration || 0).toFixed(2)}ms\n`;
    content += `- 最慢响应: ${(apiStat.max_duration || 0).toFixed(2)}ms\n`;
    content += `- 错误数: ${apiStat.errors || 0}\n`;
    content += `- 错误率: ${errorRate}%\n\n`;

    // 数据库性能统计
    const [dbStats] = await db.query<any[]>(
      `SELECT 
        COUNT(*) as total_queries,
        AVG(duration) as avg_duration,
        MIN(duration) as min_duration,
        MAX(duration) as max_duration
       FROM performance_metrics
       WHERE type = 'database' AND created_at BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    const dbStat = dbStats[0] || {};

    content += `## 数据库性能统计\n\n`;
    content += `- 总查询数: ${dbStat.total_queries || 0}\n`;
    content += `- 平均查询时间: ${(dbStat.avg_duration || 0).toFixed(2)}ms\n`;
    content += `- 最快查询: ${(dbStat.min_duration || 0).toFixed(2)}ms\n`;
    content += `- 最慢查询: ${(dbStat.max_duration || 0).toFixed(2)}ms\n\n`;

    // 慢查询 Top 10
    const [slowQueries] = await db.query<any[]>(
      `SELECT name, duration, metadata
       FROM performance_metrics
       WHERE type = 'database' AND created_at BETWEEN ? AND ?
       ORDER BY duration DESC
       LIMIT 10`,
      [startDate, endDate]
    );

    if (slowQueries.length > 0) {
      content += `## 慢查询 Top 10\n\n`;
      content += `| 排名 | 查询时间(ms) | SQL |\n`;
      content += `|------|-------------|-----|\n`;
      slowQueries.forEach((q, i) => {
        const sql = q.metadata ? JSON.parse(q.metadata).sql : 'N/A';
        const shortSql = sql.length > 50 ? sql.substring(0, 50) + '...' : sql;
        content += `| ${i + 1} | ${q.duration.toFixed(2)} | ${shortSql} |\n`;
      });
      content += `\n`;
    }

    // 性能告警汇总
    const [alerts] = await db.query<any[]>(
      `SELECT severity, COUNT(*) as count
       FROM performance_alerts
       WHERE created_at BETWEEN ? AND ?
       GROUP BY severity`,
      [startDate, endDate]
    );

    if (alerts.length > 0) {
      content += `## 性能告警汇总\n\n`;
      alerts.forEach(a => {
        content += `- ${a.severity}: ${a.count}次\n`;
      });
      content += `\n`;
    }

    // 系统资源使用
    const [sysStats] = await db.query<any[]>(
      `SELECT 
        AVG(memory_percentage) as avg_memory,
        MAX(memory_percentage) as max_memory,
        AVG(cpu_usage) as avg_cpu,
        MAX(cpu_usage) as max_cpu
       FROM system_metrics
       WHERE created_at BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    const sysStat = sysStats[0] || {};

    content += `## 系统资源使用\n\n`;
    content += `- 平均内存使用率: ${(sysStat.avg_memory || 0).toFixed(2)}%\n`;
    content += `- 峰值内存使用率: ${(sysStat.max_memory || 0).toFixed(2)}%\n`;
    content += `- 平均CPU使用率: ${(sysStat.avg_cpu || 0).toFixed(2)}%\n`;
    content += `- 峰值CPU使用率: ${(sysStat.max_cpu || 0).toFixed(2)}%\n\n`;

    content += `---\n\n`;
    content += `*报告生成时间: ${new Date().toLocaleString()}*\n`;

    return content;
  }

  /**
   * 生成每周报告内容
   */
  private async generateWeeklyContent(startDate: Date, endDate: Date): Promise<string> {
    const db = getDatabase();
    const weekStr = `${startDate.toISOString().split('T')[0]} ~ ${endDate.toISOString().split('T')[0]}`;

    let content = `# 性能周报 - ${weekStr}\n\n`;
    content += `**报告周期**: ${startDate.toLocaleString()} ~ ${endDate.toLocaleString()}\n\n`;

    // 本周 vs 上周对比
    const lastWeekStart = new Date(startDate);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(endDate);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

    const [thisWeekApi] = await db.query<any[]>(
      `SELECT AVG(duration) as avg_duration FROM performance_metrics
       WHERE type = 'api' AND created_at BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    const [lastWeekApi] = await db.query<any[]>(
      `SELECT AVG(duration) as avg_duration FROM performance_metrics
       WHERE type = 'api' AND created_at BETWEEN ? AND ?`,
      [lastWeekStart, lastWeekEnd]
    );

    const thisWeekAvg = thisWeekApi[0]?.avg_duration || 0;
    const lastWeekAvg = lastWeekApi[0]?.avg_duration || 0;
    const change = lastWeekAvg > 0 ? ((thisWeekAvg - lastWeekAvg) / lastWeekAvg * 100).toFixed(2) : '0.00';
    const trend = parseFloat(change) > 0 ? '↑' : parseFloat(change) < 0 ? '↓' : '→';

    content += `## 性能趋势分析\n\n`;
    content += `### API 响应时间\n\n`;
    content += `- 本周平均: ${thisWeekAvg.toFixed(2)}ms\n`;
    content += `- 上周平均: ${lastWeekAvg.toFixed(2)}ms\n`;
    content += `- 变化: ${trend} ${Math.abs(parseFloat(change))}%\n\n`;

    // 每日趋势
    const [dailyTrend] = await db.query<any[]>(
      `SELECT DATE(created_at) as date, AVG(duration) as avg_duration
       FROM performance_metrics
       WHERE type = 'api' AND created_at BETWEEN ? AND ?
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [startDate, endDate]
    );

    if (dailyTrend.length > 0) {
      content += `### 每日趋势\n\n`;
      content += `| 日期 | 平均响应时间(ms) |\n`;
      content += `|------|------------------|\n`;
      dailyTrend.forEach(d => {
        content += `| ${d.date} | ${d.avg_duration.toFixed(2)} |\n`;
      });
      content += `\n`;
    }

    // 优化建议
    content += `## 优化建议\n\n`;
    if (parseFloat(change) > 10) {
      content += `- ⚠️ API 响应时间较上周增加 ${Math.abs(parseFloat(change))}%,建议排查性能瓶颈\n`;
    }
    if (thisWeekAvg > 200) {
      content += `- ⚠️ API 平均响应时间超过 200ms,建议优化慢接口\n`;
    }

    content += `\n---\n\n`;
    content += `*报告生成时间: ${new Date().toLocaleString()}*\n`;

    return content;
  }

  /**
   * 保存报告到数据库
   */
  private async saveReport(report: PerformanceReport): Promise<void> {
    const db = getDatabase();

    await db.query(
      `INSERT INTO performance_reports (id, type, period_start, period_end, content)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE content = VALUES(content)`,
      [report.id, report.type, report.period_start, report.period_end, report.content]
    );
  }
}

// 导出单例
export const reportGenerator = new ReportGenerator();
