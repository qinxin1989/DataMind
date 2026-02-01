/**
 * 爬虫管理路由
 */

import { Router, Request, Response } from 'express';
import { crawlerManagementService } from './service';

const router = Router();

/**
 * GET /crawler/templates - 获取模板列表
 */
router.get('/crawler/templates', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    const templates = await crawlerManagementService.getTemplates(userId);
    res.json({ success: true, data: templates });
  } catch (error: any) {
    console.error('[CrawlerManagement] Get templates error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /crawler/templates - 保存模板
 */
router.post('/crawler/templates', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    const templateId = await crawlerManagementService.saveTemplate(userId, req.body);
    res.json({ success: true, data: { id: templateId } });
  } catch (error: any) {
    console.error('[CrawlerManagement] Save template error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /crawler/templates/:id - 删除模板
 */
router.delete('/crawler/templates/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    await crawlerManagementService.deleteTemplate(req.params.id, userId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[CrawlerManagement] Delete template error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /crawler/tasks - 获取任务列表
 */
router.get('/crawler/tasks', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    const tasks = await crawlerManagementService.getTasks(userId);
    res.json({ success: true, data: tasks });
  } catch (error: any) {
    console.error('[CrawlerManagement] Get tasks error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /crawler/tasks/:id/toggle - 切换任务状态
 */
router.post('/crawler/tasks/:id/toggle', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    const { status } = req.body;
    if (!status || !['active', 'paused'].includes(status)) {
      return res.status(400).json({ error: '无效的状态' });
    }

    await crawlerManagementService.toggleTask(req.params.id, userId, status);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[CrawlerManagement] Toggle task error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /crawler/results - 获取采集结果列表
 */
router.get('/crawler/results', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const results = await crawlerManagementService.getResults(userId, limit);
    res.json({ success: true, data: results });
  } catch (error: any) {
    console.error('[CrawlerManagement] Get results error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /crawler/results/:id - 获取采集结果详情
 */
router.get('/crawler/results/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    const details = await crawlerManagementService.getResultDetails(req.params.id, userId);
    // 转换为前端需要的格式
    const data = details.map(row => row.data);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('[CrawlerManagement] Get result details error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /crawler/results/:id - 删除采集结果
 */
router.delete('/crawler/results/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    await crawlerManagementService.deleteResult(req.params.id, userId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[CrawlerManagement] Delete result error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /execute - 执行技能
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: '未授权' });
    }

    const result = await crawlerManagementService.executeSkill(userId, req.body);
    res.json(result);
  } catch (error: any) {
    console.error('[CrawlerManagement] Execute skill error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
