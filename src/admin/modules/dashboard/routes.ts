import { Router } from 'express';
import { DashboardService } from './dashboardService';

export function createDashboardRoutes(dashboardService: DashboardService): Router {
  const router = Router();

  // 获取所有大屏
  router.get('/', (req, res) => {
    try {
      const userId = req.user?.id;
      const dashboards = dashboardService.getAll(userId);
      res.json(dashboards);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取仪表板统计
  router.get('/stats', (req, res) => {
    try {
      const stats = {
        totalDashboards: dashboardService.getAll().length,
        totalCharts: dashboardService.getAll().reduce((sum, d) => sum + (d.charts?.length || 0), 0),
        activeUsers: 1,
        lastUpdated: new Date().toISOString()
      };
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取单个大屏
  router.get('/:id', (req, res) => {
    try {
      const dashboard = dashboardService.getById(req.params.id);
      if (!dashboard) {
        return res.status(404).json({ error: '大屏不存在' });
      }
      res.json(dashboard);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 创建大屏
  router.post('/', (req, res) => {
    try {
      const { name, description, datasourceId, datasourceName, charts, theme } = req.body;
      const dashboard = dashboardService.create({
        name,
        description,
        datasourceId,
        datasourceName,
        charts: charts || [],
        theme: theme || 'dark',
        createdBy: req.user?.id || 'unknown',
      });
      res.json(dashboard);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 更新大屏
  router.put('/:id', (req, res) => {
    try {
      const { name, description, charts, theme } = req.body;
      const dashboard = dashboardService.update(req.params.id, {
        name,
        description,
        charts,
        theme,
      });
      if (!dashboard) {
        return res.status(404).json({ error: '大屏不存在' });
      }
      res.json(dashboard);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 删除大屏
  router.delete('/:id', (req, res) => {
    try {
      const success = dashboardService.delete(req.params.id);
      if (!success) {
        return res.status(404).json({ error: '大屏不存在' });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
