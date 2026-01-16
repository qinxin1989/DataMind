/**
 * 菜单管理 API 路由
 */

import { Router, Request, Response } from 'express';
import { menuService } from './menuService';
import { requirePermission } from '../../middleware/permission';
import type { ApiResponse, CreateMenuRequest, UpdateMenuRequest } from '../../types';

const router = Router();

function success<T>(data: T): ApiResponse<T> {
  return { success: true, data, timestamp: Date.now() };
}

function error(code: string, message: string): ApiResponse {
  return { success: false, error: { code, message }, timestamp: Date.now() };
}

/** GET /menus - 获取完整菜单树 */
router.get('/', requirePermission('menu:view'), async (req: Request, res: Response) => {
  try {
    const tree = await menuService.getMenuTree();
    res.json(success(tree));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/** GET /menus/user - 获取当前用户菜单树 */
router.get('/user', async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json(error('AUTH_TOKEN_MISSING', '请先登录'));
    }
    const tree = await menuService.getUserMenuTree(req.user.id);
    res.json(success(tree));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/** GET /menus/tree - 获取完整菜单树（管理用） */
router.get('/tree', requirePermission('menu:view'), async (req: Request, res: Response) => {
  try {
    const tree = await menuService.getFullMenuTree();
    res.json(success(tree));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/** GET /menus/:id - 获取菜单详情 */
router.get('/:id', requirePermission('menu:view'), async (req: Request, res: Response) => {
  try {
    const menu = await menuService.getMenuById(req.params.id);
    if (!menu) {
      return res.status(404).json(error('RES_NOT_FOUND', '菜单不存在'));
    }
    res.json(success(menu));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/** POST /menus - 创建菜单 */
router.post('/', requirePermission('menu:create'), async (req: Request, res: Response) => {
  try {
    const data: CreateMenuRequest = req.body;
    if (!data.title) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '菜单标题不能为空'));
    }
    const menu = await menuService.createMenu(data);
    res.status(201).json(success(menu));
  } catch (err: any) {
    if (err.message.includes('层级')) {
      return res.status(400).json(error('BIZ_OPERATION_FAILED', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/** PUT /menus/:id - 更新菜单 */
router.put('/:id', requirePermission('menu:update'), async (req: Request, res: Response) => {
  try {
    const data: UpdateMenuRequest = req.body;
    const menu = await menuService.updateMenu(req.params.id, data);
    res.json(success(menu));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/** DELETE /menus/:id - 删除菜单 */
router.delete('/:id', requirePermission('menu:delete'), async (req: Request, res: Response) => {
  try {
    await menuService.deleteMenu(req.params.id);
    res.json(success({ message: '删除成功' }));
  } catch (err: any) {
    if (err.message.includes('不存在') || err.message.includes('系统菜单') || err.message.includes('子菜单')) {
      return res.status(400).json(error('BIZ_OPERATION_FAILED', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/** PUT /menus/order - 批量更新排序 */
router.put('/batch/order', requirePermission('menu:update'), async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '参数错误'));
    }
    await menuService.updateMenuOrder(items);
    res.json(success({ message: '更新成功' }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/** PUT /menus/:id/visibility - 设置菜单可见性 */
router.put('/:id/visibility', requirePermission('menu:update'), async (req: Request, res: Response) => {
  try {
    const { visible } = req.body;
    if (typeof visible !== 'boolean') {
      return res.status(400).json(error('VALID_PARAM_MISSING', '参数错误'));
    }
    const menu = await menuService.setMenuVisibility(req.params.id, visible);
    res.json(success(menu));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

export default router;
