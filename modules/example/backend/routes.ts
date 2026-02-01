/**
 * 示例模块路由
 */

import { Router } from 'express';
import type { Pool } from 'mysql2/promise';
import { ExampleService } from './service';
import type { CreateExampleDto, UpdateExampleDto, ExampleListQuery } from './types';

export function createExampleRoutes(db: Pool): Router {
  const router = Router();
  const service = new ExampleService(db);

  /**
   * 获取示例列表
   * GET /example
   */
  router.get('/', async (req, res) => {
    try {
      const query: ExampleListQuery = {
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
        status: req.query.status as 'active' | 'inactive' | undefined,
        keyword: req.query.keyword as string | undefined
      };

      const userId = (req as any).user?.id;
      const result = await service.getList(query, userId);

      res.json({
        code: 200,
        message: 'success',
        data: result
      });
    } catch (error: any) {
      console.error('Failed to get example list:', error);
      res.status(500).json({
        code: 500,
        message: error.message || 'Failed to get example list'
      });
    }
  });

  /**
   * 根据ID获取示例
   * GET /example/:id
   */
  router.get('/:id', async (req, res) => {
    try {
      const item = await service.getById(req.params.id);

      if (!item) {
        return res.status(404).json({
          code: 404,
          message: 'Example item not found'
        });
      }

      res.json({
        code: 200,
        message: 'success',
        data: item
      });
    } catch (error: any) {
      console.error('Failed to get example item:', error);
      res.status(500).json({
        code: 500,
        message: error.message || 'Failed to get example item'
      });
    }
  });

  /**
   * 创建示例
   * POST /example
   */
  router.post('/', async (req, res) => {
    try {
      const data: CreateExampleDto = req.body;

      // 验证必需字段
      if (!data.title) {
        return res.status(400).json({
          code: 400,
          message: 'Title is required'
        });
      }

      const userId = (req as any).user?.id;
      const item = await service.create(data, userId);

      res.json({
        code: 200,
        message: 'Example item created successfully',
        data: item
      });
    } catch (error: any) {
      console.error('Failed to create example item:', error);
      res.status(500).json({
        code: 500,
        message: error.message || 'Failed to create example item'
      });
    }
  });

  /**
   * 更新示例
   * PUT /example/:id
   */
  router.put('/:id', async (req, res) => {
    try {
      const data: UpdateExampleDto = req.body;
      const item = await service.update(req.params.id, data);

      res.json({
        code: 200,
        message: 'Example item updated successfully',
        data: item
      });
    } catch (error: any) {
      console.error('Failed to update example item:', error);
      const status = error.message === 'Example item not found' ? 404 : 500;
      res.status(status).json({
        code: status,
        message: error.message || 'Failed to update example item'
      });
    }
  });

  /**
   * 删除示例
   * DELETE /example/:id
   */
  router.delete('/:id', async (req, res) => {
    try {
      await service.delete(req.params.id);

      res.json({
        code: 200,
        message: 'Example item deleted successfully'
      });
    } catch (error: any) {
      console.error('Failed to delete example item:', error);
      const status = error.message === 'Example item not found' ? 404 : 500;
      res.status(status).json({
        code: status,
        message: error.message || 'Failed to delete example item'
      });
    }
  });

  /**
   * 批量删除示例
   * POST /example/batch-delete
   */
  router.post('/batch-delete', async (req, res) => {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          code: 400,
          message: 'Invalid ids parameter'
        });
      }

      const count = await service.batchDelete(ids);

      res.json({
        code: 200,
        message: `${count} example items deleted successfully`,
        data: { count }
      });
    } catch (error: any) {
      console.error('Failed to batch delete example items:', error);
      res.status(500).json({
        code: 500,
        message: error.message || 'Failed to batch delete example items'
      });
    }
  });

  return router;
}
