/**
 * 性能指标收集器
 * 用于收集系统各项性能指标
 */

import { v4 as uuidv4 } from 'uuid';
import * as os from 'os';
import { getDatabase } from '../../admin/core/database';

/**
 * 性能指标类型
 */
export type MetricType = 'api' | 'database' | 'module' | 'frontend' | 'system';

/**
 * 性能指标接口
 */
export interface PerformanceMetric {
  id: string;
  type: MetricType;
  name: string;
  duration?: number;
  metadata?: Record<string, any>;
  created_at?: Date;
}

/**
 * 系统指标接口
 */
export interface SystemMetrics {
  id: string;
  memory_used: number;
  memory_total: number;
  memory_percentage: number;
  cpu_usage: number;
  created_at?: Date;
}

/**
 * API 性能指标
 */
export interface ApiMetric {
  method: string;
  path: string;
  duration: number;
  statusCode: number;
  userId?: string;
}

/**
 * 数据库性能指标
 */
export interface DatabaseMetric {
  sql: string;
  duration: number;
  rows?: number;
}

/**
 * 模块性能指标
 */
export interface ModuleMetric {
  moduleName: string;
  operation: 'load' | 'register' | 'enable' | 'disable';
  duration: number;
}

/**
 * 性能指标收集器类
 */
export class PerformanceCollector {
  private batchSize = 100;
  private batchInterval = 5000; // 5秒
  private metricsBatch: PerformanceMetric[] = [];
  private systemMetricsBatch: SystemMetrics[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private lastCpuUsage: NodeJS.CpuUsage | null = null;

  constructor() {
    this.startBatchTimer();
  }

  /**
   * 启动批量写入定时器
   */
  private startBatchTimer(): void {
    this.batchTimer = setInterval(() => {
      this.flushBatch();
    }, this.batchInterval);
  }

  /**
   * 停止批量写入定时器
   */
  public stopBatchTimer(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
    this.flushBatch();
  }

  /**
   * 刷新批量数据到数据库
   */
  private async flushBatch(): Promise<void> {
    if (this.metricsBatch.length === 0 && this.systemMetricsBatch.length === 0) {
      return;
    }

    try {
      const db = getDatabase();

      // 批量插入性能指标
      if (this.metricsBatch.length > 0) {
        const metrics = [...this.metricsBatch];
        this.metricsBatch = [];

        const values = metrics.map(m => [
          m.id,
          m.type,
          m.name,
          m.duration || null,
          m.metadata ? JSON.stringify(m.metadata) : null
        ]);

        await db.query(
          `INSERT INTO performance_metrics (id, type, name, duration, metadata) VALUES ?`,
          [values]
        );
      }

      // 批量插入系统指标
      if (this.systemMetricsBatch.length > 0) {
        const systemMetrics = [...this.systemMetricsBatch];
        this.systemMetricsBatch = [];

        const values = systemMetrics.map(m => [
          m.id,
          m.memory_used,
          m.memory_total,
          m.memory_percentage,
          m.cpu_usage
        ]);

        await db.query(
          `INSERT INTO system_metrics (id, memory_used, memory_total, memory_percentage, cpu_usage) VALUES ?`,
          [values]
        );
      }
    } catch (error) {
      console.error('Failed to flush performance metrics batch:', error);
    }
  }

  /**
   * 记录性能指标
   */
  private recordMetric(metric: PerformanceMetric): void {
    this.metricsBatch.push(metric);

    // 如果批量达到阈值,立即刷新
    if (this.metricsBatch.length >= this.batchSize) {
      this.flushBatch();
    }
  }

  /**
   * 记录 API 性能指标
   */
  public recordApiMetric(metric: ApiMetric): void {
    this.recordMetric({
      id: uuidv4(),
      type: 'api',
      name: `${metric.method} ${metric.path}`,
      duration: metric.duration,
      metadata: {
        method: metric.method,
        path: metric.path,
        statusCode: metric.statusCode,
        userId: metric.userId
      }
    });
  }

  /**
   * 记录数据库性能指标
   */
  public recordDatabaseMetric(metric: DatabaseMetric): void {
    // 只记录慢查询 (> 10ms)
    if (metric.duration < 10) {
      return;
    }

    this.recordMetric({
      id: uuidv4(),
      type: 'database',
      name: 'query',
      duration: metric.duration,
      metadata: {
        sql: metric.sql.substring(0, 500), // 限制 SQL 长度
        rows: metric.rows
      }
    });
  }

  /**
   * 记录模块性能指标
   */
  public recordModuleMetric(metric: ModuleMetric): void {
    this.recordMetric({
      id: uuidv4(),
      type: 'module',
      name: `${metric.moduleName}:${metric.operation}`,
      duration: metric.duration,
      metadata: {
        moduleName: metric.moduleName,
        operation: metric.operation
      }
    });
  }

  /**
   * 记录前端性能指标
   */
  public recordFrontendMetric(name: string, duration: number, metadata?: Record<string, any>): void {
    this.recordMetric({
      id: uuidv4(),
      type: 'frontend',
      name,
      duration,
      metadata
    });
  }

  /**
   * 获取系统指标
   */
  private getSystemMetrics(): SystemMetrics {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryPercentage = (usedMemory / totalMemory) * 100;

    // 计算 CPU 使用率
    const cpuUsage = this.calculateCpuUsage();

    return {
      id: uuidv4(),
      memory_used: usedMemory,
      memory_total: totalMemory,
      memory_percentage: parseFloat(memoryPercentage.toFixed(2)),
      cpu_usage: cpuUsage
    };
  }

  /**
   * 计算 CPU 使用率
   */
  private calculateCpuUsage(): number {
    const currentUsage = process.cpuUsage();

    if (!this.lastCpuUsage) {
      this.lastCpuUsage = currentUsage;
      return 0;
    }

    const userDiff = currentUsage.user - this.lastCpuUsage.user;
    const systemDiff = currentUsage.system - this.lastCpuUsage.system;
    const totalDiff = userDiff + systemDiff;

    // 转换为百分比 (微秒转秒,除以核心数)
    const cpuCount = os.cpus().length;
    const usage = (totalDiff / 1000000 / this.batchInterval * 1000) / cpuCount * 100;

    this.lastCpuUsage = currentUsage;

    return parseFloat(Math.min(usage, 100).toFixed(2));
  }

  /**
   * 收集系统指标
   */
  public collectSystemMetrics(): void {
    const metrics = this.getSystemMetrics();
    this.systemMetricsBatch.push(metrics);

    // 如果批量达到阈值,立即刷新
    if (this.systemMetricsBatch.length >= this.batchSize) {
      this.flushBatch();
    }
  }

  /**
   * 启动系统指标收集
   */
  public startSystemMetricsCollection(interval: number = 60000): NodeJS.Timeout {
    // 每分钟收集一次系统指标
    return setInterval(() => {
      this.collectSystemMetrics();
    }, interval);
  }
}

// 导出单例
export const performanceCollector = new PerformanceCollector();

// 启动系统指标收集
performanceCollector.startSystemMetricsCollection();

// 进程退出时刷新批量数据
process.on('beforeExit', () => {
  performanceCollector.stopBatchTimer();
});
