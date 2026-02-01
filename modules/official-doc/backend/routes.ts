/**
 * 公文写作路由
 */

import express from 'express';
import { OfficialDocService } from './service';
import type {
  DocGenerationRequest,
  OfficialDocTemplate
} from './types';

export function createOfficialDocRoutes(service: OfficialDocService): express.Router {
  const router = express.Router();

  /**
   * POST /generate - 生成公文
   */
  router.post('/generate', async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: '未授权' });
      }

      const request: DocGenerationRequest = req.body;
      const result = await service.generateDoc(request, userId);

      res.json(result);
    } catch (error: any) {
      console.error('生成公文错误:', error);
      res.status(500).json({
        success: false,
        error: error.message || '生成公文失败'
      });
    }
  });

  /**
   * POST /templates - 创建模板
   */
  router.post('/templates', async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: '未授权' });
      }

      const template = await service.createTemplate({
        ...req.body,
        userId,
        isSystem: false
      });

      res.json({
        success: true,
        data: template
      });
    } catch (error: any) {
      console.error('创建模板错误:', error);
      res.status(500).json({
        success: false,
        error: error.message || '创建模板失败'
      });
    }
  });

  /**
   * PUT /templates/:id - 更新模板
   */
  router.put('/templates/:id', async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: '未授权' });
      }

      const id = req.params.id;
      await service.updateTemplate(id, req.body);

      res.json({
        success: true,
        message: '更新成功'
      });
    } catch (error: any) {
      console.error('更新模板错误:', error);
      res.status(500).json({
        success: false,
        error: error.message || '更新模板失败'
      });
    }
  });

  /**
   * DELETE /templates/:id - 删除模板
   */
  router.delete('/templates/:id', async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: '未授权' });
      }

      const id = req.params.id;
      await service.deleteTemplate(id);

      res.json({
        success: true,
        message: '删除成功'
      });
    } catch (error: any) {
      console.error('删除模板错误:', error);
      res.status(500).json({
        success: false,
        error: error.message || '删除模板失败'
      });
    }
  });

  /**
   * GET /templates/:id - 获取模板
   */
  router.get('/templates/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const template = await service.getTemplate(id);

      if (!template) {
        return res.status(404).json({ error: '模板不存在' });
      }

      res.json({
        success: true,
        data: template
      });
    } catch (error: any) {
      console.error('获取模板错误:', error);
      res.status(500).json({
        success: false,
        error: error.message || '获取模板失败'
      });
    }
  });

  /**
   * GET /templates - 查询模板
   */
  router.get('/templates', async (req, res) => {
    try {
      const userId = (req as any).user?.id;

      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const type = req.query.type as any;
      const isSystem = req.query.isSystem === 'true' ? true : req.query.isSystem === 'false' ? false : undefined;
      const isPublic = req.query.isPublic === 'true' ? true : req.query.isPublic === 'false' ? false : undefined;
      const keyword = req.query.keyword as string;

      const result = await service.queryTemplates({
        userId,
        page,
        pageSize,
        type,
        isSystem,
        isPublic,
        keyword
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('查询模板错误:', error);
      res.status(500).json({
        success: false,
        error: error.message || '查询模板失败'
      });
    }
  });

  /**
   * GET /history - 获取历史记录
   */
  router.get('/history', async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: '未授权' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const type = req.query.type as any;
      const status = req.query.status as any;
      const startDate = req.query.startDate ? parseInt(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? parseInt(req.query.endDate as string) : undefined;

      const result = await service.getHistory({
        userId,
        page,
        pageSize,
        type,
        status,
        startDate,
        endDate
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('获取历史记录错误:', error);
      res.status(500).json({
        success: false,
        error: error.message || '获取历史记录失败'
      });
    }
  });

  /**
   * DELETE /history/:id - 删除历史记录
   */
  router.delete('/history/:id', async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: '未授权' });
      }

      const id = req.params.id;
      await service.deleteHistory(id, userId);

      res.json({
        success: true,
        message: '删除成功'
      });
    } catch (error: any) {
      console.error('删除历史记录错误:', error);
      res.status(500).json({
        success: false,
        error: error.message || '删除失败'
      });
    }
  });

  /**
   * POST /cleanup - 清理过期历史（管理员）
   */
  router.post('/cleanup', async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      if (!userId || userRole !== 'admin') {
        return res.status(403).json({ error: '权限不足' });
      }

      const count = await service.cleanupExpiredHistory();

      res.json({
        success: true,
        message: `已清理 ${count} 条过期记录`
      });
    } catch (error: any) {
      console.error('清理过期历史错误:', error);
      res.status(500).json({
        success: false,
        error: error.message || '清理失败'
      });
    }
  });

  return router;
}
