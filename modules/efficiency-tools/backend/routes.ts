/**
 * 效率工具路由
 */

import express from 'express';
import { EfficiencyToolsService } from './service';
import type {
  SqlFormatRequest,
  DataConvertRequest,
  RegexTestRequest,
  UserTemplate
} from './types';

export function createEfficiencyToolsRoutes(service: EfficiencyToolsService): express.Router {
  const router = express.Router();

  /**
   * POST /sql/format - SQL 格式化
   */
  router.post('/sql/format', async (req, res) => {
    try {
      const request: SqlFormatRequest = req.body;
      const result = await service.formatSql(request);
      res.json(result);
    } catch (error: any) {
      console.error('SQL格式化错误:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'SQL格式化失败'
      });
    }
  });

  /**
   * POST /data/convert - 数据转换
   */
  router.post('/data/convert', async (req, res) => {
    try {
      const request: DataConvertRequest = req.body;
      const result = await service.convertData(request);
      res.json(result);
    } catch (error: any) {
      console.error('数据转换错误:', error);
      res.status(500).json({
        success: false,
        error: error.message || '数据转换失败'
      });
    }
  });

  /**
   * POST /regex/test - 正则测试
   */
  router.post('/regex/test', async (req, res) => {
    try {
      const request: RegexTestRequest = req.body;
      const result = await service.testRegex(request);
      res.json(result);
    } catch (error: any) {
      console.error('正则测试错误:', error);
      res.status(500).json({
        success: false,
        error: error.message || '正则测试失败'
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
        userId
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
      await service.updateTemplate(id, userId, req.body);

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
      await service.deleteTemplate(id, userId);

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
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: '未授权' });
      }

      const id = req.params.id;
      const template = await service.getTemplate(id, userId);

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
      if (!userId) {
        return res.status(401).json({ error: '未授权' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const type = req.query.type as any;
      const keyword = req.query.keyword as string;

      const result = await service.queryTemplates({
        userId,
        page,
        pageSize,
        type,
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

  return router;
}
