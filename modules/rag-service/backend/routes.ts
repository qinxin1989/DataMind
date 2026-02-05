/**
 * RAG 知识库服务路由
 */

import { Router, Request, Response } from 'express';
import type { Pool } from 'mysql2/promise';
import { RagService } from './service';

export function createRagRoutes(db: Pool, aiConfigs?: any[]) {
  const router = Router();

  // 为每个请求创建服务实例
  const getService = (req: Request): RagService => {
    const userId = (req as any).user?.id || 'system';
    const service = new RagService(db, userId);

    // 异步初始化（首次调用时）
    if (aiConfigs && aiConfigs.length > 0) {
      service.initialize(aiConfigs).catch(console.error);
    }

    return service;
  };

  /**
   * GET /stats - 获取知识库统计
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const service = getService(req);
      const stats = await service.getStats();
      res.json({ success: true, data: stats });
    } catch (error: any) {
      console.error('[RAG] Get stats error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /documents - 获取文档列表
   */
  router.get('/documents', async (req: Request, res: Response) => {
    try {
      const service = getService(req);
      const query = {
        page: parseInt(req.query.page as string) || 1,
        pageSize: parseInt(req.query.pageSize as string) || 10,
        keyword: req.query.keyword as string,
        type: req.query.type as any,
        categoryId: req.query.categoryId as string,
        status: req.query.status as string
      };
      const result = await service.getDocumentList(query);
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('[RAG] Get documents error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /documents - 创建文档
   */
  router.post('/documents', async (req: Request, res: Response) => {
    try {
      const service = getService(req);
      const doc = await service.createDocument(req.body);
      res.json({ success: true, data: doc });
    } catch (error: any) {
      console.error('[RAG] Create document error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /documents/:id - 删除文档
   */
  router.delete('/documents/:id', async (req: Request, res: Response) => {
    try {
      const service = getService(req);
      await service.deleteDocument(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[RAG] Delete document error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /query - 知识问答
   */
  router.post('/query', async (req: Request, res: Response) => {
    try {
      const service = getService(req);
      const result = await service.query(req.body);
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('[RAG] Query error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /search - 搜索知识
   */
  router.post('/search', async (req: Request, res: Response) => {
    try {
      const service = getService(req);
      const { query, limit } = req.body;
      const results = await service.search(query, limit);
      res.json({ success: true, data: results });
    } catch (error: any) {
      console.error('[RAG] Search error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /categories - 获取分类列表
   */
  router.get('/categories', async (req: Request, res: Response) => {
    try {
      const service = getService(req);
      const categories = await service.getCategories();
      res.json({ success: true, data: categories });
    } catch (error: any) {
      console.error('[RAG] Get categories error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /categories - 创建分类
   */
  router.post('/categories', async (req: Request, res: Response) => {
    try {
      const service = getService(req);
      const { name, description, parentId } = req.body;
      const category = await service.createCategory(name, description, parentId);
      res.json({ success: true, data: category });
    } catch (error: any) {
      console.error('[RAG] Create category error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

export default createRagRoutes;