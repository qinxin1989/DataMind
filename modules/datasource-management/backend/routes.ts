/**
 * 数据源管理路由
 * 直接导出 router，与模块加载器兼容
 */

import { Router, Request, Response } from 'express';
import { pool } from '../../../src/admin/core/database';
import { DataSourceService } from './service';
import { requirePermission } from '../../../src/admin/middleware/permission';
import { permissionService } from '../../../src/admin/services/permissionService';
import { success, error } from '../../../src/admin/utils/response';

const router = Router();

// 获取服务实例
const getService = (req: Request): DataSourceService => {
    const userId = (req as any).user?.id || 'system';
    return new DataSourceService(pool, userId);
};

/** 检查用户是否为管理员 */
async function isUserAdmin(userId: string): Promise<boolean> {
    return await permissionService.hasAnyPermission(userId, ['*', 'admin:access', 'datasource:approve']);
}

/** 隐藏密码字段 */
function hideSensitive(ds: any): any {
    return { ...ds, password: ds.password ? '******' : undefined };
}

/**
 * GET / - 获取数据源列表
 */
router.get('/', requirePermission('datasource:view'), async (req: Request, res: Response) => {
    try {
        const service = getService(req);
        const isAdmin = await isUserAdmin(req.user!.id);
        const query = {
            page: parseInt(req.query.page as string) || 1,
            pageSize: parseInt(req.query.pageSize as string) || 20,
            keyword: req.query.keyword as string,
            type: req.query.type as any,
            visibility: req.query.visibility as any,
            isAdmin,
        };
        const result = await service.getList(query);
        const safeItems = (result.items || []).map(hideSensitive);
        res.json(success({ ...result, items: safeItems }));
    } catch (err: any) {
        res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
});

/**
 * GET /groups - 获取分组列表
 */
router.get('/groups', requirePermission('datasource:view'), async (_req: Request, res: Response) => {
    try {
        const service = getService(_req);
        const groups = await service.getGroups();
        res.json(success(groups));
    } catch (err: any) {
        res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
});

/**
 * GET /tags - 获取标签列表
 */
router.get('/tags', requirePermission('datasource:view'), async (_req: Request, res: Response) => {
    try {
        const service = getService(_req);
        const tags = await service.getTags();
        res.json(success(tags));
    } catch (err: any) {
        res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
});

/**
 * GET /stats - 获取所有数据源统计
 */
router.get('/stats', requirePermission('datasource:view'), async (_req: Request, res: Response) => {
    try {
        const service = getService(_req);
        const stats = await service.getAllStats();
        res.json(success(stats));
    } catch (err: any) {
        res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
});

/**
 * GET /pending-approvals - 获取待审核的数据源列表（管理员）
 */
router.get('/pending-approvals', requirePermission('datasource:approve'), async (req: Request, res: Response) => {
    try {
        const service = getService(req);
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 20;
        const result = await service.getPendingApprovals(page, pageSize);
        const safeList = (result.items || []).map(hideSensitive);
        res.json(success({ ...result, items: safeList }));
    } catch (err: any) {
        res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
});

/**
 * GET /:id - 获取数据源详情
 */
router.get('/:id', requirePermission('datasource:view'), async (req: Request, res: Response) => {
    try {
        const service = getService(req);
        const ds = await service.getById(req.params.id);
        if (!ds) {
            return res.status(404).json(error('RES_NOT_FOUND', '数据源不存在'));
        }
        res.json(success(hideSensitive(ds)));
    } catch (err: any) {
        res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
});

/**
 * POST / - 创建数据源
 */
router.post('/', requirePermission('datasource:create'), async (req: Request, res: Response) => {
    try {
        const { name, type, host, port, database, username, password, options, group, tags, visibility } = req.body;
        if (!name || !type) {
            return res.status(400).json(error('VALID_PARAM_MISSING', '缺少必要参数'));
        }
        const service = getService(req);
        const ds = await service.create({
            name, type, host, port, database, username, password,
            description: req.body.description,
            apiUrl: req.body.apiUrl,
            apiKey: req.body.apiKey,
            filePath: req.body.filePath,
            visibility: visibility || 'private',
        });
        res.status(201).json(success(ds));
    } catch (err: any) {
        res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
});

/**
 * POST /test-config - 测试配置（不保存）
 */
router.post('/test-config', requirePermission('datasource:create'), async (req: Request, res: Response) => {
    try {
        const service = getService(req);
        const result = await service.testConnectionConfig(req.body);
        res.json(success(result));
    } catch (err: any) {
        res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
});

/**
 * PUT /:id - 更新数据源
 */
router.put('/:id', requirePermission('datasource:update'), async (req: Request, res: Response) => {
    try {
        const service = getService(req);
        const ds = await service.update(req.params.id, req.body);
        res.json(success(ds));
    } catch (err: any) {
        if (err.message.includes('不存在')) {
            return res.status(404).json(error('RES_NOT_FOUND', err.message));
        }
        res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
});

/**
 * DELETE /:id - 删除数据源
 */
router.delete('/:id', requirePermission('datasource:delete'), async (req: Request, res: Response) => {
    try {
        const service = getService(req);
        await service.delete(req.params.id);
        res.json(success({ message: '删除成功' }));
    } catch (err: any) {
        if (err.message.includes('不存在')) {
            return res.status(404).json(error('RES_NOT_FOUND', err.message));
        }
        res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
});

/**
 * POST /:id/test - 测试数据源连接
 */
router.post('/:id/test', requirePermission('datasource:update'), async (req: Request, res: Response) => {
    try {
        const service = getService(req);
        const result = await service.testConnection(req.params.id);
        res.json(success(result));
    } catch (err: any) {
        if (err.message.includes('不存在')) {
            return res.status(404).json(error('RES_NOT_FOUND', err.message));
        }
        res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
});

/**
 * GET /:id/schemas - 获取表结构
 */
router.get('/:id/schemas', requirePermission('datasource:view'), async (req: Request, res: Response) => {
    try {
        const service = getService(req);
        const schemas = await service.getSchemas(req.params.id);
        res.json(success(schemas));
    } catch (err: any) {
        res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
});

/**
 * POST /:id/query - 执行查询
 */
router.post('/:id/query', requirePermission('datasource:view'), async (req: Request, res: Response) => {
    try {
        const service = getService(req);
        const { sql } = req.body;
        const result = await service.executeQuery(req.params.id, sql);
        res.json(success(result));
    } catch (err: any) {
        res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
});

/**
 * GET /:id/stats - 获取数据源统计
 */
router.get('/:id/stats', requirePermission('datasource:view'), async (req: Request, res: Response) => {
    try {
        const service = getService(req);
        const stats = await service.getStats(req.params.id);
        if (!stats) {
            return res.status(404).json(error('RES_NOT_FOUND', '统计数据不存在'));
        }
        res.json(success(stats));
    } catch (err: any) {
        res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
});

/**
 * PUT /:id/group - 设置分组
 */
router.put('/:id/group', requirePermission('datasource:update'), async (req: Request, res: Response) => {
    try {
        const { group } = req.body;
        const service = getService(req);
        const ds = await service.setGroup(req.params.id, group);
        res.json(success(ds));
    } catch (err: any) {
        if (err.message.includes('不存在')) {
            return res.status(404).json(error('RES_NOT_FOUND', err.message));
        }
        res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
});

/**
 * POST /:id/tags - 添加标签
 */
router.post('/:id/tags', requirePermission('datasource:update'), async (req: Request, res: Response) => {
    try {
        const { tag } = req.body;
        if (!tag) {
            return res.status(400).json(error('VALID_PARAM_MISSING', '缺少 tag 参数'));
        }
        const service = getService(req);
        const ds = await service.addTag(req.params.id, tag);
        res.json(success(ds));
    } catch (err: any) {
        if (err.message.includes('不存在')) {
            return res.status(404).json(error('RES_NOT_FOUND', err.message));
        }
        res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
});

/**
 * DELETE /:id/tags/:tag - 删除标签
 */
router.delete('/:id/tags/:tag', requirePermission('datasource:update'), async (req: Request, res: Response) => {
    try {
        const service = getService(req);
        const ds = await service.removeTag(req.params.id, req.params.tag);
        res.json(success(ds));
    } catch (err: any) {
        if (err.message.includes('不存在')) {
            return res.status(404).json(error('RES_NOT_FOUND', err.message));
        }
        res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
});

/**
 * PUT /:id/visibility - 更新数据源可见性
 */
router.put('/:id/visibility', requirePermission('datasource:update'), async (req: Request, res: Response) => {
    try {
        const { visibility } = req.body;
        if (!visibility || !['private', 'public'].includes(visibility)) {
            return res.status(400).json(error('VALID_PARAM_INVALID', '可见性参数无效'));
        }
        const service = getService(req);
        const ds = await service.updateVisibility(req.params.id, visibility, req.user!.id);
        res.json(success(ds));
    } catch (err: any) {
        if (err.message.includes('不存在')) {
            return res.status(404).json(error('RES_NOT_FOUND', err.message));
        }
        if (err.message.includes('所有者')) {
            return res.status(403).json(error('PERM_ACCESS_DENIED', err.message));
        }
        res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
});

/**
 * POST /:id/approve - 审核通过数据源（管理员）
 */
router.post('/:id/approve', requirePermission('datasource:approve'), async (req: Request, res: Response) => {
    try {
        const { comment } = req.body;
        const service = getService(req);
        const ds = await service.approveDatasource(req.params.id, true, req.user!.id, comment);
        res.json(success(ds));
    } catch (err: any) {
        if (err.message.includes('不存在')) {
            return res.status(404).json(error('RES_NOT_FOUND', err.message));
        }
        if (err.message.includes('不在待审核') || err.message.includes('只有公共')) {
            return res.status(400).json(error('VALID_PARAM_INVALID', err.message));
        }
        res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
});

/**
 * POST /:id/reject - 审核拒绝数据源（管理员）
 */
router.post('/:id/reject', requirePermission('datasource:approve'), async (req: Request, res: Response) => {
    try {
        const { comment } = req.body;
        if (!comment) {
            return res.status(400).json(error('VALID_PARAM_MISSING', '拒绝时必须填写原因'));
        }
        const service = getService(req);
        const ds = await service.approveDatasource(req.params.id, false, req.user!.id, comment);
        res.json(success(ds));
    } catch (err: any) {
        if (err.message.includes('不存在')) {
            return res.status(404).json(error('RES_NOT_FOUND', err.message));
        }
        if (err.message.includes('不在待审核') || err.message.includes('只有公共')) {
            return res.status(400).json(error('VALID_PARAM_INVALID', err.message));
        }
        res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
});

// 默认导出 router
export default router;

// 命名导出
export { router };

// 工厂函数（向后兼容）
export function createDataSourceRoutes(db?: any) {
    return router;
}
