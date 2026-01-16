/**
 * 角色管理 API 路由
 */

import { Router, Request, Response } from 'express';
import { permissionService } from '../../services/permissionService';
import { requirePermission } from '../../middleware/permission';
import type { ApiResponse } from '../../types';

const router = Router();

function success<T>(data: T): ApiResponse<T> {
  return { success: true, data, timestamp: Date.now() };
}

function error(code: string, message: string): ApiResponse {
  return { success: false, error: { code, message }, timestamp: Date.now() };
}

/** GET /roles - 获取角色列表 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const roles = await permissionService.getAllRoles();
    res.json(success(roles));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/** GET /roles/:id - 获取角色详情 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const role = await permissionService.getRoleById(req.params.id);
    if (!role) {
      return res.status(404).json(error('RES_NOT_FOUND', '角色不存在'));
    }
    res.json(success(role));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/** POST /roles - 创建角色 */
router.post('/', requirePermission('role:create'), async (req: Request, res: Response) => {
  try {
    const { name, code, description, permissionCodes, menuIds, status } = req.body;
    if (!name || !code) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '角色名称和编码不能为空'));
    }
    const role = await permissionService.createRole({
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

/** PUT /roles/:id - 更新角色 */
router.put('/:id', requirePermission('role:update'), async (req: Request, res: Response) => {
  try {
    const { name, description, permissionCodes, menuIds, status } = req.body;
    const role = await permissionService.updateRole(req.params.id, {
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

/** DELETE /roles/:id - 删除角色 */
router.delete('/:id', requirePermission('role:delete'), async (req: Request, res: Response) => {
  try {
    await permissionService.deleteRole(req.params.id);
    res.json(success({ message: '删除成功' }));
  } catch (err: any) {
    if (err.message.includes('not found')) {
      return res.status(404).json(error('RES_NOT_FOUND', '角色不存在'));
    }
    if (err.message.includes('system role')) {
      return res.status(400).json(error('BIZ_OPERATION_FAILED', '系统角色不能删除'));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/** GET /permissions - 获取所有权限列表 */
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
