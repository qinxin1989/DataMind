/**
 * 菜单管理 API 路由
 */

import { Router, Request, Response } from 'express';
import { menuService } from './service';
import { requirePermission } from '../../../src/admin/middleware/permission';
import { success, error } from '../../../src/admin/utils/response';

const router = Router();

/**
 * GET /menus - 获取菜单列表
 */
router.get('/', requirePermission('menu:view'), async (req: Request, res: Response) => {
  try {
    const { type } = req.query;

    if (type === 'flat') {
      const menus = await menuService.getAllMenus();
      return res.json(success(menus));
    }

    const menuTree = await menuService.getMenuTree();
    res.json(success(menuTree));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /menus/tree - 获取菜单树
 */
router.get('/tree', requirePermission('menu:view'), async (req: Request, res: Response) => {
  try {
    const menuTree = await menuService.getMenuTree();
    res.json(success(menuTree));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /menus/user - 获取当前用户菜单树
 */
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

/**
 * GET /menus/user/:userId - 获取指定用户菜单 tree
 */
router.get('/user/:userId', requirePermission('menu:view'), async (req: Request, res: Response) => {
  try {
    const menuTree = await menuService.getUserMenuTree(req.params.userId);
    res.json(success(menuTree));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /menus/:id - 获取菜单详情
 */
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

/**
 * POST /menus - 创建菜单
 */
router.post('/', requirePermission('menu:create'), async (req: Request, res: Response) => {
  try {
    const { title, path, icon, parentId, order, visible, permission, menuType, externalUrl, openMode, moduleCode } = req.body;

    if (!title) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '菜单标题不能为空'));
    }

    const menu = await menuService.createMenu({
      title,
      path,
      icon,
      parentId,
      order,
      visible,
      permission,
      menuType,
      externalUrl,
      openMode,
      moduleCode,
    });

    res.status(201).json(success(menu));
  } catch (err: any) {
    if (err.message.includes('层级')) {
      return res.status(400).json(error('BIZ_OPERATION_FAILED', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * PUT /menus/:id - 更新菜单
 */
router.put('/:id', requirePermission('menu:update'), async (req: Request, res: Response) => {
  try {
    const { title, path, icon, parentId, order, visible, permission, menuType, externalUrl, openMode, moduleCode } = req.body;

    const menu = await menuService.updateMenu(req.params.id, {
      title,
      path,
      icon,
      parentId,
      order,
      visible,
      permission,
      menuType,
      externalUrl,
      openMode,
      moduleCode,
    });

    res.json(success(menu));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', '菜单不存在'));
    }
    if (err.message.includes('系统菜单')) {
      return res.status(400).json(error('BIZ_OPERATION_FAILED', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * DELETE /menus/:id - 删除菜单
 */
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

/**
 * POST /menus/batch/delete - 批量删除菜单
 */
router.post('/batch/delete', requirePermission('menu:delete'), async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '请选择要删除的菜单'));
    }

    await menuService.batchDeleteMenus(ids);
    res.json(success({ message: `成功删除 ${ids.length} 个菜单` }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * PUT /menus/:id/visibility - 切换菜单可见性
 */
router.put('/:id/visibility', requirePermission('menu:update'), async (req: Request, res: Response) => {
  try {
    const menu = await menuService.toggleVisibility(req.params.id);
    res.json(success(menu));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', '菜单不存在'));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /menus/sort - 更新菜单排序
 */
router.post('/sort', requirePermission('menu:update'), async (req: Request, res: Response) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '排序数据格式错误'));
    }

    await menuService.updateMenuOrder(items);
    res.json(success({ message: '排序更新成功' }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

export default router;
