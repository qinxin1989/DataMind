/**
 * 角色管理 API 路由
 */

import { Router, Request, Response } from 'express';
import { roleService } from './service';
import { requirePermission } from '../../../src/admin/middleware/permission';
import { success, error } from '../../../src/admin/utils/response';

const router = Router();

/**
 * GET /roles - 获取角色列表
 */
router.get('/', requirePermission('role:view'), async (req: Request, res: Response) => {
  try {
    const { keyword, status, page, pageSize } = req.query;

    // 如果有分页参数，使用分页查询
    if (page || pageSize) {
      const result = await roleService.queryRoles({
        keyword: keyword as string,
        status: status as 'active' | 'inactive',
        page: page ? parseInt(page as string) : 1,
        pageSize: pageSize ? parseInt(pageSize as string) : 10,
      });
      return res.json(success(result));
    }

    // 否则返回所有角色
    const roles = await roleService.getAllRoles();
    res.json(success(roles));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /roles/:id - 获取角色详情
 */
router.get('/:id', requirePermission('role:view'), async (req: Request, res: Response) => {
  try {
    const role = await roleService.getRoleById(req.params.id);
    if (!role) {
      return res.status(404).json(error('RES_NOT_FOUND', '角色不存在'));
    }
    res.json(success(role));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /roles - 创建角色
 */
router.post('/', requirePermission('role:create'), async (req: Request, res: Response) => {
  try {
    const { name, code, description, permissionCodes, menuIds, status } = req.body;

    if (!name || !code) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '角色名称和编码不能为空'));
    }

    const role = await roleService.createRole({
      name,
      code,
      description,
      permissionCodes: permissionCodes || [],
      menuIds: menuIds || [],
      status: status || 'active',
    });

    res.status(201).json(success(role));
  } catch (err: any) {
    if (err.message.includes('已存在')) {
      return res.status(400).json(error('BIZ_OPERATION_FAILED', '角色编码已存在'));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * PUT /roles/:id - 更新角色
 */
router.put('/:id', requirePermission('role:update'), async (req: Request, res: Response) => {
  try {
    const { name, description, permissionCodes, menuIds, status } = req.body;

    const role = await roleService.updateRole(req.params.id, {
      name,
      description,
      permissionCodes,
      menuIds,
      status,
    });

    res.json(success(role));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', '角色不存在'));
    }
    if (err.message.includes('系统角色')) {
      return res.status(400).json(error('BIZ_OPERATION_FAILED', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * DELETE /roles/:id - 删除角色
 */
router.delete('/:id', requirePermission('role:delete'), async (req: Request, res: Response) => {
  try {
    await roleService.deleteRole(req.params.id);
    res.json(success({ message: '删除成功' }));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', '角色不存在'));
    }
    if (err.message.includes('系统角色')) {
      return res.status(400).json(error('BIZ_OPERATION_FAILED', '系统角色不能删除'));
    }
    if (err.message.includes('正在被')) {
      return res.status(400).json(error('BIZ_OPERATION_FAILED', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /roles/batch/delete - 批量删除角色
 */
router.post('/batch/delete', requirePermission('role:delete'), async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '请选择要删除的角色'));
    }

    await roleService.batchDeleteRoles(ids);
    res.json(success({ message: `成功删除 ${ids.length} 个角色` }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /permissions/all - 获取所有权限列表
 */
router.get('/permissions/all', async (req: Request, res: Response) => {
  try {
    // 返回预定义的权限列表
    const permissions = [
      'user:view', 'user:create', 'user:update', 'user:delete',
      'role:view', 'role:create', 'role:update', 'role:delete',
      'menu:view', 'menu:create', 'menu:update', 'menu:delete',
      'datasource:view', 'datasource:create', 'datasource:update', 'datasource:delete',
      'ai:view', 'ai:config', 'ai:query',
      'system:view', 'system:config', 'system:backup',
      'audit:view', 'audit:export',
      'notification:view', 'notification:manage',
    ];
    res.json(success(permissions));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

export default router;
