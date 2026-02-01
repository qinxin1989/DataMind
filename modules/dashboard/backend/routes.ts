/**
 * Dashboard Routes
 * 大屏管理路由
 */

import { Router, Request, Response } from 'express';
import { DashboardService } from './service';

export function createDashboardRoutes(service: DashboardService): Router {
  const router = Router();

  /**
   * GET /api/dashboards
   * 获取大屏列表
   */
  router.get('/', (req: Request, res: Response) => {
    try {
      const params = {
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
        status: req.query.status as any,
        createdBy: req.query.createdBy as string,
        keyword: req.query.keyword as string,
      };

      const result = service.getList(params);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/dashboards/stats
   * 获取统计信息
   */
  router.get('/stats', (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const stats = service.getStats(userId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/dashboards/:id
   * 获取大屏详情
   */
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const dashboard = service.getById(req.params.id);
      if (!dashboard) {
        return res.status(404).json({ error: '大屏不存在' });
      }
      res.json(dashboard);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/dashboards
   * 创建大屏
   */
  router.post('/', (req: Request, res: Response) => {
    try {
      const createdBy = (req as any).user?.id || 'system';
      const dashboard = service.create(req.body, createdBy);
      res.json(dashboard);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/dashboards/:id
   * 更新大屏
   */
  router.put('/:id', (req: Request, res: Response) => {
    try {
      const dashboard = service.update(req.params.id, req.body);
      if (!dashboard) {
        return res.status(404).json({ error: '大屏不存在' });
      }
      res.json(dashboard);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/dashboards/:id
   * 删除大屏
   */
  router.delete('/:id', (req: Request, res: Response) => {
    try {
      const success = service.delete(req.params.id);
      if (!success) {
        return res.status(404).json({ error: '大屏不存在' });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/dashboards/:id/publish
   * 发布大屏
   */
  router.post('/:id/publish', (req: Request, res: Response) => {
    try {
      const publishedBy = (req as any).user?.id || 'system';
      const dashboard = service.publish(req.params.id, { publishedBy });
      if (!dashboard) {
        return res.status(404).json({ error: '大屏不存在' });
      }
      res.json(dashboard);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/dashboards/:id/unpublish
   * 取消发布大屏
   */
  router.post('/:id/unpublish', (req: Request, res: Response) => {
    try {
      const dashboard = service.unpublish(req.params.id);
      if (!dashboard) {
        return res.status(404).json({ error: '大屏不存在' });
      }
      res.json(dashboard);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/dashboards/:id/archive
   * 归档大屏
   */
  router.post('/:id/archive', (req: Request, res: Response) => {
    try {
      const dashboard = service.archive(req.params.id);
      if (!dashboard) {
        return res.status(404).json({ error: '大屏不存在' });
      }
      res.json(dashboard);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/dashboards/:id/charts
   * 添加图表
   */
  router.post('/:id/charts', (req: Request, res: Response) => {
    try {
      const dashboard = service.addChart(req.params.id, req.body);
      if (!dashboard) {
        return res.status(404).json({ error: '大屏不存在' });
      }
      res.json(dashboard);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * PUT /api/dashboards/:id/charts/:chartId
   * 更新图表
   */
  router.put('/:id/charts/:chartId', (req: Request, res: Response) => {
    try {
      const dashboard = service.updateChart(
        req.params.id,
        req.params.chartId,
        req.body
      );
      if (!dashboard) {
        return res.status(404).json({ error: '大屏或图表不存在' });
      }
      res.json(dashboard);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/dashboards/:id/charts/:chartId
   * 删除图表
   */
  router.delete('/:id/charts/:chartId', (req: Request, res: Response) => {
    try {
      const dashboard = service.deleteChart(req.params.id, req.params.chartId);
      if (!dashboard) {
        return res.status(404).json({ error: '大屏或图表不存在' });
      }
      res.json(dashboard);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
