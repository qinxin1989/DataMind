/**
 * 数据源管理路由
 */

import { Router, Request, Response } from 'express';
import type { Pool } from 'mysql2/promise';
import { DataSourceService } from './service';

export function createDataSourceRoutes(db: Pool) {
    const router = Router();

    // 获取服务实例
    const getService = (req: Request): DataSourceService => {
        const userId = (req as any).user?.id || 'system';
        return new DataSourceService(db, userId);
    };

    /**
     * GET / - 获取数据源列表
     */
    router.get('/', async (req: Request, res: Response) => {
        try {
            const service = getService(req);
            const query = {
                page: parseInt(req.query.page as string) || 1,
                pageSize: parseInt(req.query.pageSize as string) || 10,
                keyword: req.query.keyword as string,
                type: req.query.type as any,
                visibility: req.query.visibility as any
            };
            const result = await service.getList(query);
            res.json({ success: true, data: result });
        } catch (error: any) {
            console.error('[DataSource] Get list error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /:id - 获取数据源详情
     */
    router.get('/:id', async (req: Request, res: Response) => {
        try {
            const service = getService(req);
            const ds = await service.getById(req.params.id);
            if (!ds) {
                return res.status(404).json({ error: '数据源不存在' });
            }
            res.json({ success: true, data: ds });
        } catch (error: any) {
            console.error('[DataSource] Get by id error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST / - 创建数据源
     */
    router.post('/', async (req: Request, res: Response) => {
        try {
            const service = getService(req);
            const ds = await service.create(req.body);
            res.json({ success: true, data: ds });
        } catch (error: any) {
            console.error('[DataSource] Create error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * PUT /:id - 更新数据源
     */
    router.put('/:id', async (req: Request, res: Response) => {
        try {
            const service = getService(req);
            const ds = await service.update(req.params.id, req.body);
            res.json({ success: true, data: ds });
        } catch (error: any) {
            console.error('[DataSource] Update error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * DELETE /:id - 删除数据源
     */
    router.delete('/:id', async (req: Request, res: Response) => {
        try {
            const service = getService(req);
            await service.delete(req.params.id);
            res.json({ success: true });
        } catch (error: any) {
            console.error('[DataSource] Delete error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /:id/test - 测试连接
     */
    router.post('/:id/test', async (req: Request, res: Response) => {
        try {
            const service = getService(req);
            const result = await service.testConnection(req.params.id);
            res.json({ success: true, data: result });
        } catch (error: any) {
            console.error('[DataSource] Test connection error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /:id/schemas - 获取表结构
     */
    router.get('/:id/schemas', async (req: Request, res: Response) => {
        try {
            const service = getService(req);
            const schemas = await service.getSchemas(req.params.id);
            res.json({ success: true, data: schemas });
        } catch (error: any) {
            console.error('[DataSource] Get schemas error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /:id/query - 执行查询
     */
    router.post('/:id/query', async (req: Request, res: Response) => {
        try {
            const service = getService(req);
            const { sql } = req.body;
            const result = await service.executeQuery(req.params.id, sql);
            res.json({ success: true, data: result });
        } catch (error: any) {
            console.error('[DataSource] Query error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /:id/approve - 审核数据源
     */
    router.post('/:id/approve', async (req: Request, res: Response) => {
        try {
            const service = getService(req);
            const { approved, reason } = req.body;
            await service.approve(req.params.id, approved, reason);
            res.json({ success: true });
        } catch (error: any) {
            console.error('[DataSource] Approve error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
}

export default createDataSourceRoutes;