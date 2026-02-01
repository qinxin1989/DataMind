/**
 * 性能监控 API 路由
 */

import { Router } from 'express';
import { MonitoringService } from './service';
import { reportGenerator } from '../../../core/monitoring/ReportGenerator';

const router = Router();
const monitoringService = new MonitoringService();

/**
 * 获取实时性能指标
 * GET /api/monitoring/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await monitoringService.getRealtimeMetrics();
    res.json({
      success: true,
      data: metrics
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取历史性能数据
 * GET /api/monitoring/metrics/history?hours=24
 */
router.get('/metrics/history', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const metrics = await monitoringService.getHistoryMetrics(hours);
    res.json({
      success: true,
      data: metrics
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取慢查询列表
 * GET /api/monitoring/slow-queries?limit=50
 */
router.get('/slow-queries', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const queries = await monitoringService.getSlowQueries(limit);
    res.json({
      success: true,
      data: queries
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取性能告警列表
 * GET /api/monitoring/alerts?resolved=false&limit=100
 */
router.get('/alerts', async (req, res) => {
  try {
    const resolved = req.query.resolved === 'true';
    const limit = parseInt(req.query.limit as string) || 100;
    const alerts = await monitoringService.getAlerts(resolved, limit);
    res.json({
      success: true,
      data: alerts
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取性能报告列表
 * GET /api/monitoring/reports?type=daily&limit=30
 */
router.get('/reports', async (req, res) => {
  try {
    const type = req.query.type as 'daily' | 'weekly' | undefined;
    const limit = parseInt(req.query.limit as string) || 30;
    const reports = await monitoringService.getReports(type, limit);
    res.json({
      success: true,
      data: reports
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取性能报告详情
 * GET /api/monitoring/reports/:id
 */
router.get('/reports/:id', async (req, res) => {
  try {
    const report = await monitoringService.getReportById(req.params.id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: '报告不存在'
      });
    }
    res.json({
      success: true,
      data: report
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 手动生成每日报告
 * POST /api/monitoring/reports/daily
 */
router.post('/reports/daily', async (req, res) => {
  try {
    const report = await reportGenerator.generateDailyReport();
    res.json({
      success: true,
      data: report,
      message: '每日报告生成成功'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 手动生成每周报告
 * POST /api/monitoring/reports/weekly
 */
router.post('/reports/weekly', async (req, res) => {
  try {
    const report = await reportGenerator.generateWeeklyReport();
    res.json({
      success: true,
      data: report,
      message: '每周报告生成成功'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;
