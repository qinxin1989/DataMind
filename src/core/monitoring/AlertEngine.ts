/**
 * 性能告警引擎
 * 根据告警规则自动检测性能问题并发送告警
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../../admin/core/database';

/**
 * 告警严重程度
 */
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * 告警规则接口
 */
export interface AlertRule {
  id: string;
  name: string;
  type: 'api' | 'database' | 'module' | 'system';
  metric: string;
  operator: '>' | '<' | '=' | '>=' | '<=';
  threshold: number;
  duration: number; // 持续时间(秒)
  severity: AlertSeverity;
  enabled: boolean;
}

/**
 * 告警接口
 */
export interface Alert {
  id: string;
  rule_id: string;
  rule_name: string;
  severity: AlertSeverity;
  message: string;
  metadata?: Record<string, any>;
  resolved: boolean;
  resolved_at?: Date;
  created_at?: Date;
}

/**
 * 告警引擎类
 */
export class AlertEngine {
  private checkInterval = 60000; // 1分钟检查一次
  private checkTimer: NodeJS.Timeout | null = null;
  private alertHistory: Map<string, Date> = new Map(); // 记录告警历史,避免重复告警

  constructor() {
    this.startAlertChecking();
  }

  /**
   * 启动告警检查
   */
  private startAlertChecking(): void {
    this.checkTimer = setInterval(() => {
      this.checkAlerts();
    }, this.checkInterval);
  }

  /**
   * 停止告警检查
   */
  public stopAlertChecking(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  /**
   * 检查所有告警规则
   */
  private async checkAlerts(): Promise<void> {
    try {
      const db = getDatabase();

      // 获取所有启用的告警规则
      const [rules] = await db.query<AlertRule[]>(
        'SELECT * FROM alert_rules WHERE enabled = TRUE'
      );

      for (const rule of rules) {
        await this.checkRule(rule);
      }
    } catch (error) {
      console.error('Failed to check alerts:', error);
    }
  }

  /**
   * 检查单个告警规则
   */
  private async checkRule(rule: AlertRule): Promise<void> {
    try {
      const db = getDatabase();
      const now = new Date();
      const durationMs = rule.duration * 1000;
      const checkTime = new Date(now.getTime() - durationMs);

      let triggered = false;
      let value: number = 0;
      let metadata: Record<string, any> = {};

      // 根据规则类型检查指标
      switch (rule.type) {
        case 'api':
          ({ triggered, value, metadata } = await this.checkApiMetric(rule, checkTime));
          break;
        case 'database':
          ({ triggered, value, metadata } = await this.checkDatabaseMetric(rule, checkTime));
          break;
        case 'module':
          ({ triggered, value, metadata } = await this.checkModuleMetric(rule, checkTime));
          break;
        case 'system':
          ({ triggered, value, metadata } = await this.checkSystemMetric(rule, checkTime));
          break;
      }

      // 如果触发告警
      if (triggered) {
        await this.triggerAlert(rule, value, metadata);
      } else {
        // 如果未触发,检查是否需要解决之前的告警
        await this.resolveAlert(rule.id);
      }
    } catch (error) {
      console.error(`Failed to check rule ${rule.id}:`, error);
    }
  }

  /**
   * 检查 API 指标
   */
  private async checkApiMetric(rule: AlertRule, checkTime: Date): Promise<{ triggered: boolean; value: number; metadata: Record<string, any> }> {
    const db = getDatabase();

    if (rule.metric === 'response_time') {
      // 检查平均响应时间
      const [rows] = await db.query<any[]>(
        `SELECT AVG(duration) as avg_duration, COUNT(*) as count
         FROM performance_metrics
         WHERE type = 'api' AND created_at >= ?`,
        [checkTime]
      );

      const avgDuration = rows[0]?.avg_duration || 0;
      const count = rows[0]?.count || 0;

      return {
        triggered: this.compareValue(avgDuration, rule.operator, rule.threshold) && count > 0,
        value: avgDuration,
        metadata: { count, metric: 'response_time' }
      };
    } else if (rule.metric === 'error_rate') {
      // 检查错误率
      const [totalRows] = await db.query<any[]>(
        `SELECT COUNT(*) as total FROM performance_metrics WHERE type = 'api' AND created_at >= ?`,
        [checkTime]
      );

      const [errorRows] = await db.query<any[]>(
        `SELECT COUNT(*) as errors FROM performance_metrics
         WHERE type = 'api' AND created_at >= ?
         AND JSON_EXTRACT(metadata, '$.statusCode') >= 400`,
        [checkTime]
      );

      const total = totalRows[0]?.total || 0;
      const errors = errorRows[0]?.errors || 0;
      const errorRate = total > 0 ? (errors / total) * 100 : 0;

      return {
        triggered: this.compareValue(errorRate, rule.operator, rule.threshold) && total > 0,
        value: errorRate,
        metadata: { total, errors, metric: 'error_rate' }
      };
    }

    return { triggered: false, value: 0, metadata: {} };
  }

  /**
   * 检查数据库指标
   */
  private async checkDatabaseMetric(rule: AlertRule, checkTime: Date): Promise<{ triggered: boolean; value: number; metadata: Record<string, any> }> {
    const db = getDatabase();

    if (rule.metric === 'query_time') {
      // 检查平均查询时间
      const [rows] = await db.query<any[]>(
        `SELECT AVG(duration) as avg_duration, COUNT(*) as count
         FROM performance_metrics
         WHERE type = 'database' AND created_at >= ?`,
        [checkTime]
      );

      const avgDuration = rows[0]?.avg_duration || 0;
      const count = rows[0]?.count || 0;

      return {
        triggered: this.compareValue(avgDuration, rule.operator, rule.threshold) && count > 0,
        value: avgDuration,
        metadata: { count, metric: 'query_time' }
      };
    }

    return { triggered: false, value: 0, metadata: {} };
  }

  /**
   * 检查模块指标
   */
  private async checkModuleMetric(rule: AlertRule, checkTime: Date): Promise<{ triggered: boolean; value: number; metadata: Record<string, any> }> {
    const db = getDatabase();

    if (rule.metric === 'load_time') {
      // 检查模块加载时间
      const [rows] = await db.query<any[]>(
        `SELECT MAX(duration) as max_duration, name
         FROM performance_metrics
         WHERE type = 'module' AND created_at >= ?
         GROUP BY name
         ORDER BY max_duration DESC
         LIMIT 1`,
        [checkTime]
      );

      const maxDuration = rows[0]?.max_duration || 0;
      const moduleName = rows[0]?.name || '';

      return {
        triggered: this.compareValue(maxDuration, rule.operator, rule.threshold),
        value: maxDuration,
        metadata: { moduleName, metric: 'load_time' }
      };
    }

    return { triggered: false, value: 0, metadata: {} };
  }

  /**
   * 检查系统指标
   */
  private async checkSystemMetric(rule: AlertRule, checkTime: Date): Promise<{ triggered: boolean; value: number; metadata: Record<string, any> }> {
    const db = getDatabase();

    if (rule.metric === 'memory_usage') {
      // 检查内存使用率
      const [rows] = await db.query<any[]>(
        `SELECT AVG(memory_percentage) as avg_memory
         FROM system_metrics
         WHERE created_at >= ?`,
        [checkTime]
      );

      const avgMemory = rows[0]?.avg_memory || 0;

      return {
        triggered: this.compareValue(avgMemory, rule.operator, rule.threshold),
        value: avgMemory,
        metadata: { metric: 'memory_usage' }
      };
    } else if (rule.metric === 'cpu_usage') {
      // 检查 CPU 使用率
      const [rows] = await db.query<any[]>(
        `SELECT AVG(cpu_usage) as avg_cpu
         FROM system_metrics
         WHERE created_at >= ?`,
        [checkTime]
      );

      const avgCpu = rows[0]?.avg_cpu || 0;

      return {
        triggered: this.compareValue(avgCpu, rule.operator, rule.threshold),
        value: avgCpu,
        metadata: { metric: 'cpu_usage' }
      };
    }

    return { triggered: false, value: 0, metadata: {} };
  }

  /**
   * 比较值
   */
  private compareValue(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case '>':
        return value > threshold;
      case '<':
        return value < threshold;
      case '=':
        return value === threshold;
      case '>=':
        return value >= threshold;
      case '<=':
        return value <= threshold;
      default:
        return false;
    }
  }

  /**
   * 触发告警
   */
  private async triggerAlert(rule: AlertRule, value: number, metadata: Record<string, any>): Promise<void> {
    // 检查是否在冷却期内 (避免重复告警)
    const lastAlert = this.alertHistory.get(rule.id);
    if (lastAlert && Date.now() - lastAlert.getTime() < 300000) { // 5分钟冷却期
      return;
    }

    try {
      const db = getDatabase();

      // 检查是否已有未解决的告警
      const [existing] = await db.query<any[]>(
        'SELECT id FROM performance_alerts WHERE rule_id = ? AND resolved = FALSE LIMIT 1',
        [rule.id]
      );

      if (existing.length > 0) {
        return; // 已有未解决的告警,不重复创建
      }

      // 创建告警
      const alert: Alert = {
        id: uuidv4(),
        rule_id: rule.id,
        rule_name: rule.name,
        severity: rule.severity,
        message: this.generateAlertMessage(rule, value, metadata),
        metadata: { ...metadata, value },
        resolved: false
      };

      await db.query(
        `INSERT INTO performance_alerts (id, rule_id, rule_name, severity, message, metadata, resolved)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [alert.id, alert.rule_id, alert.rule_name, alert.severity, alert.message, JSON.stringify(alert.metadata), alert.resolved]
      );

      // 记录告警历史
      this.alertHistory.set(rule.id, new Date());

      // 发送通知 (集成通知中心)
      await this.sendNotification(alert);

      console.log(`Alert triggered: ${alert.message}`);
    } catch (error) {
      console.error('Failed to trigger alert:', error);
    }
  }

  /**
   * 解决告警
   */
  private async resolveAlert(ruleId: string): Promise<void> {
    try {
      const db = getDatabase();

      await db.query(
        `UPDATE performance_alerts
         SET resolved = TRUE, resolved_at = NOW()
         WHERE rule_id = ? AND resolved = FALSE`,
        [ruleId]
      );
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  }

  /**
   * 生成告警消息
   */
  private generateAlertMessage(rule: AlertRule, value: number, metadata: Record<string, any>): string {
    const unit = this.getMetricUnit(rule.metric);
    return `${rule.name}: 当前值 ${value.toFixed(2)}${unit}, 阈值 ${rule.threshold}${unit}`;
  }

  /**
   * 获取指标单位
   */
  private getMetricUnit(metric: string): string {
    switch (metric) {
      case 'response_time':
      case 'query_time':
      case 'load_time':
        return 'ms';
      case 'error_rate':
      case 'memory_usage':
      case 'cpu_usage':
        return '%';
      default:
        return '';
    }
  }

  /**
   * 发送通知
   */
  private async sendNotification(alert: Alert): Promise<void> {
    // TODO: 集成通知中心模块
    // 可以发送系统通知、邮件、Webhook 等
    console.log(`Notification sent for alert: ${alert.id}`);
  }
}

// 导出单例
export const alertEngine = new AlertEngine();

// 进程退出时停止告警检查
process.on('beforeExit', () => {
  alertEngine.stopAlertChecking();
});
