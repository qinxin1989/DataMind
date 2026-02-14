/**
 * 模块管理 API 路由
 * 提供模块列表查询、启用/禁用等管理接口
 */

import { Router, Request, Response } from 'express';
import { moduleRegistry } from '../../module-system/core/ModuleRegistry';

const router = Router();

/**
 * GET /modules - 获取所有模块列表
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const modules = await moduleRegistry.getAllModules();

    const list = modules.map(m => ({
      name: m.manifest.name,
      displayName: m.manifest.displayName,
      version: m.manifest.version,
      description: m.manifest.description || '',
      author: m.manifest.author || '',
      type: m.manifest.type || 'business',
      category: m.manifest.category || '',
      tags: m.manifest.tags || [],
      status: m.status,
      error: m.error || null,
      hasBackend: !!m.manifest.backend,
      hasFrontend: !!m.manifest.frontend,
      menuCount: m.manifest.menus?.length || 0,
      permissionCount: m.manifest.permissions?.length || 0,
      apiCount: m.manifest.api?.endpoints?.length || 0,
      dependencies: m.manifest.dependencies || {},
    }));

    // 按 type 排序：system > business > tool
    const typeOrder: Record<string, number> = { system: 0, business: 1, tool: 2 };
    list.sort((a, b) => (typeOrder[a.type] ?? 99) - (typeOrder[b.type] ?? 99));

    res.json({ success: true, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /modules/:name - 获取单个模块详情
 */
router.get('/:name', async (req: Request, res: Response) => {
  try {
    const moduleInfo = await moduleRegistry.getModule(req.params.name);
    if (!moduleInfo) {
      return res.status(404).json({ success: false, error: '模块不存在' });
    }

    res.json({
      success: true,
      data: {
        name: moduleInfo.manifest.name,
        displayName: moduleInfo.manifest.displayName,
        version: moduleInfo.manifest.version,
        description: moduleInfo.manifest.description,
        author: moduleInfo.manifest.author,
        type: moduleInfo.manifest.type,
        category: moduleInfo.manifest.category,
        tags: moduleInfo.manifest.tags,
        status: moduleInfo.status,
        error: moduleInfo.error,
        dependencies: moduleInfo.manifest.dependencies,
        menus: moduleInfo.manifest.menus,
        permissions: moduleInfo.manifest.permissions,
        api: moduleInfo.manifest.api,
        backend: moduleInfo.manifest.backend ? { entry: moduleInfo.manifest.backend.entry, routesPrefix: moduleInfo.manifest.backend.routes?.prefix } : null,
        frontend: moduleInfo.manifest.frontend ? { entry: moduleInfo.manifest.frontend.entry } : null,
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /modules/:name/enable - 启用模块
 */
router.put('/:name/enable', async (req: Request, res: Response) => {
  try {
    const { lifecycleManagerInstance } = await import('../../index');
    if (!lifecycleManagerInstance) {
      return res.status(503).json({ success: false, error: '模块系统尚未初始化' });
    }

    await lifecycleManagerInstance.enable(req.params.name);
    res.json({ success: true, message: `模块 ${req.params.name} 已启用` });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * PUT /modules/:name/disable - 禁用模块
 */
router.put('/:name/disable', async (req: Request, res: Response) => {
  try {
    const { lifecycleManagerInstance } = await import('../../index');
    if (!lifecycleManagerInstance) {
      return res.status(503).json({ success: false, error: '模块系统尚未初始化' });
    }

    await lifecycleManagerInstance.disable(req.params.name);
    res.json({ success: true, message: `模块 ${req.params.name} 已禁用` });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
