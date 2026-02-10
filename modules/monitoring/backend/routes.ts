/**
 * 性能监控路由
 */

import { Router, Request, Response } from 'express';
import { monitoringService } from './service';
import { requirePermission } from '../../../src/admin/middleware/permission';
import { success, error } from '../../../src/admin/utils/response';

const router = Router();

/**
 * GET /metrics - 获取实时性能指标
 */
router.get('/metrics', requirePermission('system:view'), async (_req: Request, res: Response) => {
  try {
    const metrics = await monitoringService.getRealtimeMetrics();
    res.json(success(metrics));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /metrics/history - 获取历史性能数据
 */
router.get('/metrics/history', requirePermission('system:view'), async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const metrics = await monitoringService.getHistoryMetrics(hours);
    res.json(success(metrics));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /slow-queries - 获取慢查询列表
 */
router.get('/slow-queries', requirePermission('system:view'), async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const queries = await monitoringService.getSlowQueries(limit);
    res.json(success(queries));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /alerts - 获取性能告警列表
 */
router.get('/alerts', requirePermission('system:view'), async (req: Request, res: Response) => {
  try {
    const resolved = req.query.resolved === 'true';
    const limit = parseInt(req.query.limit as string) || 100;
    const alerts = await monitoringService.getAlerts(resolved, limit);
    res.json(success(alerts));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /reports - 获取性能报告列表
 */
router.get('/reports', requirePermission('system:view'), async (req: Request, res: Response) => {
  try {
    const type = req.query.type as 'daily' | 'weekly' | undefined;
    const limit = parseInt(req.query.limit as string) || 30;
    const reports = await monitoringService.getReports(type, limit);
    res.json(success(reports));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /reports/:id - 获取性能报告详情
 */
router.get('/reports/:id', requirePermission('system:view'), async (req: Request, res: Response) => {
  try {
    const report = await monitoringService.getReportById(req.params.id);
    if (!report) {
      return res.status(404).json(error('RES_NOT_FOUND', '报告不存在'));
    }
    res.json(success(report));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /reports/daily - 手动生成每日报告
 */
router.post('/reports/daily', requirePermission('system:config'), async (_req: Request, res: Response) => {
  try {
    const { reportGenerator } = require('../../../src/core/monitoring/ReportGenerator');
    const report = await reportGenerator.generateDailyReport();
    res.json(success(report));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /reports/weekly - 手动生成每周报告
 */
router.post('/reports/weekly', requirePermission('system:config'), async (_req: Request, res: Response) => {
  try {
    const { reportGenerator } = require('../../../src/core/monitoring/ReportGenerator');
    const report = await reportGenerator.generateWeeklyReport();
    res.json(success(report));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

export default router;
export { router };
