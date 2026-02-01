/**
 * 审计日志模块路由
 */

import { Router, Request, Response } from 'express';
import { AuditLogService } from './service';
import type { ApiResponse } from '../../../src/admin/types';

const router = Router();

/** 成功响应 */
function success<T>(data: T): ApiResponse<T> {
  return { success: true, data, timestamp: Date.now() };
}

/** 错误响应 */
function error(code: string, message: string): ApiResponse {
  return { success: false, error: { code, message }, timestamp: Date.now() };
}

/**
 * 初始化路由
 */
export function initRoutes(db: any): Router {
  const service = new AuditLogService(db);

  // ==================== 日志管理 ====================

  /**
   * GET /api/modules/audit-log/logs - 获取审计日志列表
   */
  router.get('/logs', async (req: Request, res: Response) => {
    try {
      const {
        userId,
        action,
        resourceType,
        status,
        startDate,
        endDate,
        page,
        pageSize
      } = req.query;

      const result = await service.queryLogs({
        userId: userId as string,
        action: action as string,
        resourceType: resourceType as string,
        status: status as any,
        startDate: startDate ? Number(startDate) : undefined,
        endDate: endDate ? Number(endDate) : undefined,
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined
      });

      res.json(success(result));
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  /**
   * GET /api/modules/audit-log/logs/:id - 获取日志详情
   */
  router.get('/logs/:id', async (req: Request, res: Response) => {
    try {
      const log = await service.getLog(req.params.id);
      if (!log) {
        return res.status(404).json(error('RES_NOT_FOUND', '日志不存在'));
      }
      res.json(success(log));
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  /**
   * POST /api/modules/audit-log/logs - 创建审计日志
   */
  router.post('/logs', async (req: Request, res: Response) => {
    try {
      const log = await service.createLog(req.body);
      res.status(201).json(success(log));
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  /**
   * DELETE /api/modules/audit-log/logs/:id - 删除日志
   */
  router.delete('/logs/:id', async (req: Request, res: Response) => {
    try {
      await service.deleteLog(req.params.id);
      res.json(success({ message: '删除成功' }));
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  // ==================== 日志统计 ====================

  /**
   * GET /api/modules/audit-log/stats - 获取日志统计
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      const stats = await service.getStats(
        startDate ? Number(startDate) : undefined,
        endDate ? Number(endDate) : undefined
      );
      res.json(success(stats));
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  // ==================== 日志导出 ====================

  /**
   * POST /api/modules/audit-log/export - 导出日志
   */
  router.post('/export', async (req: Request, res: Response) => {
    try {
      const content = await service.exportLogs(req.body);
      const format = req.body.format || 'json';
      
      res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=audit-logs.${format}`);
      res.send(content);
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  // ==================== 日志清理 ====================

  /**
   * POST /api/modules/audit-log/cleanup - 清理过期日志
   */
  router.post('/cleanup', async (req: Request, res: Response) => {
    try {
      const count = await service.cleanupLogs(req.body);
      res.json(success({ count, message: `已清理 ${count} 条日志` }));
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  return router;
}

export default router;
