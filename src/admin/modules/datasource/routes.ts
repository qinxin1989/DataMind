/**
 * 数据源管理 API 路由
 */

import { Router, Request, Response } from 'express';
import { datasourceService, DatasourceType, DatasourceVisibility, ApprovalStatus } from './datasourceService';
import { requirePermission, requireAdmin } from '../../middleware/permission';
import { permissionService } from '../../services/permissionService';
import type { ApiResponse } from '../../types';

const router = Router();

/** 成功响应 */
function success<T>(data: T): ApiResponse<T> {
  return { success: true, data, timestamp: Date.now() };
}

/** 错误响应 */
function error(code: string, message: string): ApiResponse {
  return { success: false, error: { code, message }, timestamp: Date.now() };
}

/** 检查用户是否为管理员 */
async function isUserAdmin(userId: string): Promise<boolean> {
  return await permissionService.hasAnyPermission(userId, ['*', 'admin:access', 'datasource:approve']);
}

/**
 * GET /datasources - 获取数据源列表
 */
router.get('/', requirePermission('datasource:view'), async (req: Request, res: Response) => {
  try {
    const isAdmin = await isUserAdmin(req.user!.id);
    const params = {
      keyword: req.query.keyword as string,
      type: req.query.type as DatasourceType,
      group: req.query.group as string,
      tag: req.query.tag as string,
      status: req.query.status as 'active' | 'inactive' | 'error',
      visibility: req.query.visibility as DatasourceVisibility,
      approvalStatus: req.query.approvalStatus as ApprovalStatus,
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20,
      currentUserId: req.user!.id,
      isAdmin,
    };

    const result = await datasourceService.queryDatasources(params);
    
    // 隐藏密码
    const safeList = result.list.map(ds => ({
      ...ds,
      password: ds.password ? '******' : undefined,
    }));

    res.json(success({ ...result, list: safeList }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /datasources/groups - 获取分组列表
 */
router.get('/groups', requirePermission('datasource:view'), async (req: Request, res: Response) => {
  try {
    const groups = await datasourceService.getGroups();
    res.json(success(groups));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /datasources/tags - 获取标签列表
 */
router.get('/tags', requirePermission('datasource:view'), async (req: Request, res: Response) => {
  try {
    const tags = await datasourceService.getTags();
    res.json(success(tags));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /datasources/stats - 获取所有数据源统计
 */
router.get('/stats', requirePermission('datasource:view'), async (req: Request, res: Response) => {
  try {
    const stats = await datasourceService.getAllStats();
    res.json(success(stats));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /datasources/:id - 获取单个数据源
 */
router.get('/:id', requirePermission('datasource:view'), async (req: Request, res: Response) => {
  try {
    const datasource = await datasourceService.getDatasourceById(req.params.id);
    if (!datasource) {
      return res.status(404).json(error('RES_NOT_FOUND', '数据源不存在'));
    }
    
    // 隐藏密码
    const safe = { ...datasource, password: datasource.password ? '******' : undefined };
    res.json(success(safe));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /datasources - 创建数据源
 */
router.post('/', requirePermission('datasource:create'), async (req: Request, res: Response) => {
  try {
    const { name, type, host, port, database, username, password, options, group, tags, visibility } = req.body;

    if (!name || !type || !host || !port || !database) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少必要参数'));
    }

    const datasource = await datasourceService.createDatasource({
      name,
      type,
      host,
      port,
      database,
      username,
      password,
      options,
      group,
      tags: tags || [],
      ownerId: req.user!.id,
      visibility: visibility || 'private',
    });

    res.status(201).json(success(datasource));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * PUT /datasources/:id - 更新数据源
 */
router.put('/:id', requirePermission('datasource:update'), async (req: Request, res: Response) => {
  try {
    const datasource = await datasourceService.updateDatasource(req.params.id, req.body);
    res.json(success(datasource));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * DELETE /datasources/:id - 删除数据源
 */
router.delete('/:id', requirePermission('datasource:delete'), async (req: Request, res: Response) => {
  try {
    await datasourceService.deleteDatasource(req.params.id);
    res.json(success({ message: '删除成功' }));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /datasources/:id/test - 测试数据源连接
 */
router.post('/:id/test', requirePermission('datasource:update'), async (req: Request, res: Response) => {
  try {
    const result = await datasourceService.testConnection(req.params.id);
    res.json(success(result));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /datasources/test-config - 测试配置（不保存）
 */
router.post('/test-config', requirePermission('datasource:create'), async (req: Request, res: Response) => {
  try {
    const result = await datasourceService.testConnectionConfig(req.body);
    res.json(success(result));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /datasources/:id/stats - 获取数据源统计
 */
router.get('/:id/stats', requirePermission('datasource:view'), async (req: Request, res: Response) => {
  try {
    const stats = await datasourceService.getStats(req.params.id);
    if (!stats) {
      return res.status(404).json(error('RES_NOT_FOUND', '统计数据不存在'));
    }
    res.json(success(stats));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * PUT /datasources/:id/group - 设置分组
 */
router.put('/:id/group', requirePermission('datasource:update'), async (req: Request, res: Response) => {
  try {
    const { group } = req.body;
    const datasource = await datasourceService.setGroup(req.params.id, group);
    res.json(success(datasource));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /datasources/:id/tags - 添加标签
 */
router.post('/:id/tags', requirePermission('datasource:update'), async (req: Request, res: Response) => {
  try {
    const { tag } = req.body;
    if (!tag) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少 tag 参数'));
    }
    const datasource = await datasourceService.addTag(req.params.id, tag);
    res.json(success(datasource));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * DELETE /datasources/:id/tags/:tag - 删除标签
 */
router.delete('/:id/tags/:tag', requirePermission('datasource:update'), async (req: Request, res: Response) => {
  try {
    const datasource = await datasourceService.removeTag(req.params.id, req.params.tag);
    res.json(success(datasource));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

// ==================== 可见性和审核相关 API ====================

/**
 * PUT /datasources/:id/visibility - 更新数据源可见性
 */
router.put('/:id/visibility', requirePermission('datasource:update'), async (req: Request, res: Response) => {
  try {
    const { visibility } = req.body;
    if (!visibility || !['private', 'public'].includes(visibility)) {
      return res.status(400).json(error('VALID_PARAM_INVALID', '可见性参数无效'));
    }

    const datasource = await datasourceService.updateVisibility(
      req.params.id,
      visibility,
      req.user!.id
    );
    res.json(success(datasource));
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
 * GET /datasources/pending-approvals - 获取待审核的数据源列表（管理员）
 */
router.get('/pending-approvals', requirePermission('datasource:approve'), async (_req: Request, res: Response) => {
  try {
    const page = parseInt(_req.query.page as string) || 1;
    const pageSize = parseInt(_req.query.pageSize as string) || 20;
    const result = await datasourceService.getPendingApprovals(page, pageSize);
    
    // 隐藏密码
    const safeList = result.list.map(ds => ({
      ...ds,
      password: ds.password ? '******' : undefined,
    }));

    res.json(success({ ...result, list: safeList }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /datasources/:id/approve - 审核通过数据源（管理员）
 */
router.post('/:id/approve', requirePermission('datasource:approve'), async (req: Request, res: Response) => {
  try {
    const { comment } = req.body;
    const datasource = await datasourceService.approveDatasource(
      req.params.id,
      true,
      req.user!.id,
      comment
    );
    res.json(success(datasource));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', err.message));
    }
    if (err.message.includes('不在待审核状态') || err.message.includes('只有公共')) {
      return res.status(400).json(error('VALID_PARAM_INVALID', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /datasources/:id/reject - 审核拒绝数据源（管理员）
 */
router.post('/:id/reject', requirePermission('datasource:approve'), async (req: Request, res: Response) => {
  try {
    const { comment } = req.body;
    if (!comment) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '拒绝时必须填写原因'));
    }
    const datasource = await datasourceService.approveDatasource(
      req.params.id,
      false,
      req.user!.id,
      comment
    );
    res.json(success(datasource));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', err.message));
    }
    if (err.message.includes('不在待审核状态') || err.message.includes('只有公共')) {
      return res.status(400).json(error('VALID_PARAM_INVALID', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

export default router;
