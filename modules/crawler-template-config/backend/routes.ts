/**
 * 采集模板配置路由
 */

import { Router, Request, Response } from 'express';
import { CrawlerTemplateConfigService } from './service';
import { getConnection } from '../../../src/admin/core/database';

const router = Router();
const service = new CrawlerTemplateConfigService();

/**
 * 获取所有采集模板
 */
router.get('/api/crawler/templates', async (req: Request, res: Response) => {
  const connection = await getConnection();
  try {
    const templates = await service.getTemplates(connection);
    res.json({
      success: true,
      data: templates
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '获取模板列表失败'
    });
  } finally {
    connection.release();
  }
});

/**
 * 根据ID获取采集模板
 */
router.get('/api/crawler/templates/:id', async (req: Request, res: Response) => {
  const connection = await getConnection();
  try {
    const id = parseInt(req.params.id);
    const template = await service.getTemplate(connection, id);
    
    if (!template) {
      res.status(404).json({
        success: false,
        message: '模板不存在'
      });
      return;
    }
    
    res.json({
      success: true,
      data: template
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '获取模板失败'
    });
  } finally {
    connection.release();
  }
});

/**
 * 创建采集模板
 */
router.post('/api/crawler/templates', async (req: Request, res: Response) => {
  const connection = await getConnection();
  try {
    const userId = (req as any).user?.id || 1;
    const template = await service.createTemplate(connection, req.body, userId);
    
    res.json({
      success: true,
      data: template,
      message: '模板创建成功'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '创建模板失败'
    });
  } finally {
    connection.release();
  }
});

/**
 * 更新采集模板
 */
router.put('/api/crawler/templates/:id', async (req: Request, res: Response) => {
  const connection = await getConnection();
  try {
    const id = parseInt(req.params.id);
    const template = await service.updateTemplate(connection, id, req.body);
    
    res.json({
      success: true,
      data: template,
      message: '模板更新成功'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '更新模板失败'
    });
  } finally {
    connection.release();
  }
});

/**
 * 删除采集模板
 */
router.delete('/api/crawler/templates/:id', async (req: Request, res: Response) => {
  const connection = await getConnection();
  try {
    const id = parseInt(req.params.id);
    await service.deleteTemplate(connection, id);
    
    res.json({
      success: true,
      message: '模板删除成功'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '删除模板失败'
    });
  } finally {
    connection.release();
  }
});

/**
 * 测试采集模板
 */
router.post('/api/crawler/templates/test', async (req: Request, res: Response) => {
  const connection = await getConnection();
  try {
    const result = await service.testTemplate(connection, req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '测试失败'
    });
  } finally {
    connection.release();
  }
});

/**
 * 预览采集数据
 */
router.post('/api/crawler/preview', async (req: Request, res: Response) => {
  const connection = await getConnection();
  try {
    const result = await service.previewData(connection, req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '预览失败'
    });
  } finally {
    connection.release();
  }
});

/**
 * 验证选择器
 */
router.post('/api/crawler/validate-selector', async (req: Request, res: Response) => {
  const connection = await getConnection();
  try {
    const result = await service.validateSelector(connection, req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '验证失败'
    });
  } finally {
    connection.release();
  }
});

/**
 * AI智能分析
 */
router.post('/api/crawler/ai-analyze', async (req: Request, res: Response) => {
  const connection = await getConnection();
  try {
    const result = await service.aiAnalyze(connection, req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'AI分析失败'
    });
  } finally {
    connection.release();
  }
});

/**
 * 诊断采集问题
 */
router.post('/api/crawler/diagnose', async (req: Request, res: Response) => {
  const connection = await getConnection();
  try {
    const result = await service.diagnose(connection, req.body);
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '诊断失败'
    });
  } finally {
    connection.release();
  }
});

export default router;
