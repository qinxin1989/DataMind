/**
 * 审计日志模块路由
 */

import { Router, Request, Response } from 'express';
import { AuditLogService } from './service';
import { requirePermission } from '../../../src/admin/middleware/permission';
import { success, error } from '../../../src/admin/utils/response';

/**
 * 初始化路由
 */
export function initRoutes(db: any): Router {
  const router = Router();
  const service = new AuditLogService(db);

  // ==================== 日志查询 ====================

  /**
   * GET / - 查询审计日志
   */
  router.get('/', requirePermission('audit:view'), async (req: Request, res: Response) => {
    try {
      const result = await service.queryLogs({
        userId: req.query.userId as string,
        action: req.query.action as string,
        resourceType: req.query.resourceType as string,
        status: req.query.status as any,
        startDate: req.query.startTime ? Number(req.query.startTime) : (req.query.startDate ? Number(req.query.startDate) : undefined),
        endDate: req.query.endTime ? Number(req.query.endTime) : (req.query.endDate ? Number(req.query.endDate) : undefined),
        page: req.query.page ? Number(req.query.page) : 1,
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20,
      });
      res.json(success(result));
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  /**
   * GET /logs - 获取审计日志列表
   */
  router.get('/logs', requirePermission('audit:view'), async (req: Request, res: Response) => {
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
   * GET /logs/:id - 获取日志详情
   */
  router.get('/logs/:id', requirePermission('audit:view'), async (req: Request, res: Response) => {
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
   * POST /logs - 创建审计日志
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
   * DELETE /logs/:id - 删除日志
   */
  router.delete('/logs/:id', requirePermission('audit:delete'), async (req: Request, res: Response) => {
    try {
      await service.deleteLog(req.params.id);
      res.json(success({ message: '删除成功' }));
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  // ==================== 日志统计 ====================

  /**
   * GET /stats - 获取日志统计
   */
  router.get('/stats', requirePermission('audit:view'), async (req: Request, res: Response) => {
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
   * GET /export - 导出审计日志
   */
  router.get('/export', requirePermission('audit:export'), async (req: Request, res: Response) => {
    try {
      const options = {
        format: (req.query.format as 'csv' | 'json') || 'json',
        userId: req.query.userId as string,
        action: req.query.action as string,
        startDate: req.query.startTime ? Number(req.query.startTime) : undefined,
        endDate: req.query.endTime ? Number(req.query.endTime) : undefined,
      };
      const content = await service.exportLogs(options);

      if (options.format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
      } else {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.json');
      }
      res.send(content);
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  /**
   * POST /export - 导出日志（POST方式）
   */
  router.post('/export', requirePermission('audit:export'), async (req: Request, res: Response) => {
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

  // ==================== 用户操作轨迹 ====================

  /**
   * GET /user/:userId/trail - 获取用户操作轨迹
   */
  router.get('/user/:userId/trail', requirePermission('audit:view'), async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const startTime = req.query.startTime
        ? parseInt(req.query.startTime as string)
        : Date.now() - 24 * 60 * 60 * 1000;
      const endTime = req.query.endTime
        ? parseInt(req.query.endTime as string)
        : Date.now();

      const trail = await service.getUserTrail(userId, startTime, endTime);
      res.json(success(trail));
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  // ==================== 对话历史 API ====================

  /**
   * GET /chat-history - 查询对话历史
   */
  router.get('/chat-history', requirePermission('audit:view'), async (req: Request, res: Response) => {
    try {
      const currentUser = (req as any).user;
      const isAdmin = currentUser?.role === 'admin' || currentUser?.permissions?.includes('*');

      let userId = req.query.userId as string;
      if (!isAdmin) {
        userId = currentUser?.id || currentUser?.userId;
      }

      const params = {
        userId,
        datasourceId: req.query.datasourceId as string,
        keyword: req.query.keyword as string,
        startTime: req.query.startTime ? parseInt(req.query.startTime as string) : undefined,
        endTime: req.query.endTime ? parseInt(req.query.endTime as string) : undefined,
        page: parseInt(req.query.page as string) || 1,
        pageSize: parseInt(req.query.pageSize as string) || 20,
      };

      const result = await service.queryChatHistory(params);
      res.json(success(result));
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  /**
   * GET /chat-history/stats - 获取对话历史统计
   */
  router.get('/chat-history/stats', requirePermission('audit:view'), async (req: Request, res: Response) => {
    try {
      const startTime = req.query.startTime ? parseInt(req.query.startTime as string) : undefined;
      const endTime = req.query.endTime ? parseInt(req.query.endTime as string) : undefined;
      const stats = await service.getChatStats(startTime, endTime);
      res.json(success(stats));
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  /**
   * DELETE /chat-history/:id - 删除对话历史
   */
  router.delete('/chat-history/:id', requirePermission('audit:delete'), async (req: Request, res: Response) => {
    try {
      await service.deleteChatHistory(req.params.id);
      res.json(success({ message: '删除成功' }));
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  // ==================== 日志清理 ====================

  /**
   * POST /cleanup - 清理过期日志
   */
  router.post('/cleanup', requirePermission('audit:delete'), async (req: Request, res: Response) => {
    try {
      const count = await service.cleanupLogs(req.body);
      res.json(success({ count, message: `已清理 ${count} 条日志` }));
    } catch (err: any) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  });

  return router;
}
