/**
 * 菜单管理 API 路由
 */

import { Router, Request, Response } from 'express';
import { menuService } from './service';

const router = Router();

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  timestamp: number;
}

function success<T>(data: T): ApiResponse<T> {
  return { success: true, data, timestamp: Date.now() };
}

function error(code: string, message: string): ApiResponse {
  return { success: false, error: { code, message }, timestamp: Date.now() };
}

/**
 * GET /menus - 获取菜单列表
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { tree } = req.query;
    
    if (tree === 'true') {
      const menuTree = await menuService.getMenuTree();
      return res.json(success(menuTree));
    }
    
    const menus = await menuService.getAllMenus();
    res.json(success(menus));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /menus/tree - 获取菜单树
 */
router.get('/tree', async (req: Request, res: Response) => {
  try {
    const menuTree = await menuService.getMenuTree();
    res.json(success(menuTree));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /menus/user/:userId - 获取用户菜单树
 */
router.get('/user/:userId', async (req: Request, res: Response) => {
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
router.get('/:id', async (req: Request, res: Response) => {
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
router.post('/', async (req: Request, res: Response) => {
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
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * PUT /menus/:id - 更新菜单
 */
router.put('/:id', async (req: Request, res: Response) => {
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
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await menuService.deleteMenu(req.params.id);
    res.json(success({ message: '删除成功' }));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', '菜单不存在'));
    }
    if (err.message.includes('系统菜单')) {
      return res.status(400).json(error('BIZ_OPERATION_FAILED', '系统菜单不能删除'));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /menus/batch/delete - 批量删除菜单
 */
router.post('/batch/delete', async (req: Request, res: Response) => {
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
router.put('/:id/visibility', async (req: Request, res: Response) => {
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
router.post('/sort', async (req: Request, res: Response) => {
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
