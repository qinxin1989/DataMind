/**
 * 性能监控系统测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PerformanceCollector } from '../../src/core/monitoring/PerformanceCollector';
import { AlertEngine } from '../../src/core/monitoring/AlertEngine';
import { ReportGenerator } from '../../src/core/monitoring/ReportGenerator';

describe('性能监控系统测试', () => {
  describe('PerformanceCollector - 性能指标收集', () => {
    it('应该能够记录 API 性能指标', () => {
      const collector = new PerformanceCollector();
      
      expect(() => {
        collector.recordApiMetric({
          method: 'GET',
          path: '/api/test',
          duration: 150,
          statusCode: 200
        });
      }).not.toThrow();
    });

    it('应该能够记录数据库性能指标', () => {
      const collector = new PerformanceCollector();
      
      expect(() => {
        collector.recordDatabaseMetric({
          sql: 'SELECT * FROM users',
          duration: 50,
          rows: 100
        });
      }).not.toThrow();
    });

    it('应该能够记录模块性能指标', () => {
      const collector = new PerformanceCollector();
      
      expect(() => {
        collector.recordModuleMetric({
          moduleName: 'test-module',
          operation: 'load',
          duration: 200
        });
      }).not.toThrow();
    });

    it('应该能够收集系统指标', () => {
      const collector = new PerformanceCollector();
      
      expect(() => {
        collector.collectSystemMetrics();
      }).not.toThrow();
    });

    it('应该过滤掉快速查询 (< 10ms)', () => {
      const collector = new PerformanceCollector();
      const initialBatchSize = (collector as any).metricsBatch.length;
      
      collector.recordDatabaseMetric({
        sql: 'SELECT 1',
        duration: 5
      });
      
      const finalBatchSize = (collector as any).metricsBatch.length;
      expect(finalBatchSize).toBe(initialBatchSize);
    });
  });

  describe('AlertEngine - 告警规则引擎', () => {
    it('应该能够创建告警引擎实例', () => {
      const engine = new AlertEngine();
      expect(engine).toBeDefined();
      engine.stopAlertChecking();
    });

    it('应该能够比较值', () => {
      const engine = new AlertEngine();
      const compareValue = (engine as any).compareValue.bind(engine);
      
      expect(compareValue(100, '>', 50)).toBe(true);
      expect(compareValue(100, '<', 50)).toBe(false);
      expect(compareValue(100, '=', 100)).toBe(true);
      expect(compareValue(100, '>=', 100)).toBe(true);
      expect(compareValue(100, '<=', 100)).toBe(true);
      
      engine.stopAlertChecking();
    });

    it('应该能够生成告警消息', () => {
      const engine = new AlertEngine();
      const generateMessage = (engine as any).generateAlertMessage.bind(engine);
      
      const rule = {
        name: 'API响应时间过长',
        metric: 'response_time',
        threshold: 200
      };
      
      const message = generateMessage(rule, 350, {});
      expect(message).toContain('API响应时间过长');
      expect(message).toContain('350');
      expect(message).toContain('200');
      
      engine.stopAlertChecking();
    });

    it('应该能够获取指标单位', () => {
      const engine = new AlertEngine();
      const getUnit = (engine as any).getMetricUnit.bind(engine);
      
      expect(getUnit('response_time')).toBe('ms');
      expect(getUnit('query_time')).toBe('ms');
      expect(getUnit('error_rate')).toBe('%');
      expect(getUnit('memory_usage')).toBe('%');
      
      engine.stopAlertChecking();
    });
  });

  describe('ReportGenerator - 报告生成器', () => {
    it('应该能够创建报告生成器实例', () => {
      const generator = new ReportGenerator();
      expect(generator).toBeDefined();
    });

    it('应该能够生成每日报告内容', async () => {
      const generator = new ReportGenerator();
      const generateContent = (generator as any).generateDailyContent.bind(generator);
      
      const startDate = new Date('2026-02-01T00:00:00');
      const endDate = new Date('2026-02-01T23:59:59');
      
      const content = await generateContent(startDate, endDate);
      
      expect(content).toContain('性能日报');
      expect(content).toContain('API 性能统计');
      expect(content).toContain('数据库性能统计');
      expect(content).toContain('系统资源使用');
    });

    it('应该能够生成每周报告内容', async () => {
      const generator = new ReportGenerator();
      const generateContent = (generator as any).generateWeeklyContent.bind(generator);
      
      const startDate = new Date('2026-01-26T00:00:00');
      const endDate = new Date('2026-02-01T23:59:59');
      
      const content = await generateContent(startDate, endDate);
      
      expect(content).toContain('性能周报');
      expect(content).toContain('性能趋势分析');
      expect(content).toContain('优化建议');
    });
  });

  describe('性能监控集成测试', () => {
    it('应该能够完整记录和查询性能指标', async () => {
      const collector = new PerformanceCollector();
      
      // 记录多个指标
      collector.recordApiMetric({
        method: 'GET',
        path: '/api/users',
        duration: 120,
        statusCode: 200
      });
      
      collector.recordDatabaseMetric({
        sql: 'SELECT * FROM users WHERE id = ?',
        duration: 45,
        rows: 1
      });
      
      collector.recordModuleMetric({
        moduleName: 'user-management',
        operation: 'load',
        duration: 180
      });
      
      // 验证批量数据
      const batchSize = (collector as any).metricsBatch.length;
      expect(batchSize).toBeGreaterThan(0);
    });

    it('应该能够批量刷新数据', async () => {
      const collector = new PerformanceCollector();
      
      // 记录大量指标触发批量刷新
      for (let i = 0; i < 150; i++) {
        collector.recordApiMetric({
          method: 'GET',
          path: `/api/test/${i}`,
          duration: 100 + i,
          statusCode: 200
        });
      }
      
      // 批量应该已经被刷新
      const batchSize = (collector as any).metricsBatch.length;
      expect(batchSize).toBeLessThan(150);
    });
  });
});
