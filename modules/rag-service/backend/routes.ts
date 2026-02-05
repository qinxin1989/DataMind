/**
 * RAG 知识库服务路由
 * 直接导出 router，与模块加载器兼容
 */

import { Router, Request, Response } from 'express';
import { pool } from '../../../src/admin/core/database';
import { aiConfigService } from '../../../src/admin/modules/ai/aiConfigService';
import { RagService } from './service';

const router = Router();

// 服务实例缓存（避免每次请求都初始化）
let cachedService: RagService | null = null;

// 获取服务实例
const getService = async (req: Request): Promise<RagService> => {
  const userId = (req as any).user?.id || 'system';

  if (!cachedService) {
    cachedService = new RagService(pool, userId);
    try {
      const aiConfigs = await aiConfigService.getAllConfigs();
      if (aiConfigs && aiConfigs.length > 0) {
        await cachedService.initialize(aiConfigs);
      }
    } catch (e) {
      console.error('[RAG] Failed to initialize service:', e);
    }
  }

  return cachedService;
};

/**
 * GET /stats - 获取知识库统计
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const service = await getService(req);
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
    const service = await getService(req);
    const query = {
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 10,
      keyword: req.query.keyword as string,
      type: req.query.type as any,
      categoryId: req.query.categoryId as string
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
    const service = await getService(req);
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
    const service = await getService(req);
    await service.deleteDocument(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[RAG] Delete document error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /query - 问答
 */
router.post('/query', async (req: Request, res: Response) => {
  try {
    const service = await getService(req);
    const { question, mode } = req.body;
    const result = await service.query({ question, mode });
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[RAG] Query error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /search - 搜索
 */
router.post('/search', async (req: Request, res: Response) => {
  try {
    const service = await getService(req);
    const { query: searchQuery, topK } = req.body;
    const results = await service.search(searchQuery, topK);
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
    const service = await getService(req);
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
    const service = await getService(req);
    const category = await service.createCategory(req.body);
    res.json({ success: true, data: category });
  } catch (error: any) {
    console.error('[RAG] Create category error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 默认导出 router（与模块加载器兼容）
export default router;

// 命名导出（保持向后兼容）
export { router };

// 工厂函数（向后兼容）
export function createRagRoutes(db?: any, aiConfigs?: any[]) {
  return router;
}