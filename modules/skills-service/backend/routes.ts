/**
 * 技能服务路由
 * 直接导出 router，与模块加载器兼容
 */

import { Router, Request, Response } from 'express';
import { skillsService } from './service';
import { requirePermission } from '../../../src/admin/middleware/permission';
import { success, error } from '../../../src/admin/utils/response';
import type { SkillCategory, SkillContext } from './types';

const router = Router();

/**
 * GET / - 获取技能列表
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as SkillCategory | undefined;
    const result = skillsService.getSkillList(category);
    res.json(success(result));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /categories - 获取技能分类
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = skillsService.getRegistry().getCategories();
    res.json(success(categories));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /capabilities - 获取 Agent 能力
 */
router.get('/capabilities', async (req: Request, res: Response) => {
  try {
    const capabilities = skillsService.getCapabilities();
    res.json(success(capabilities));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /stats - 获取技能统计
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = skillsService.getStats();
    res.json(success(stats));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /descriptions - 获取技能描述（供 AI 使用）
 */
router.get('/descriptions', async (req: Request, res: Response) => {
  try {
    const descriptions = skillsService.getSkillDescriptions();
    res.json(success(descriptions));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /mcp-tools - 获取 MCP 工具定义
 */
router.get('/mcp-tools', async (req: Request, res: Response) => {
  try {
    const tools = skillsService.getMCPTools();
    res.json(success(tools));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /:name - 获取技能详情
 */
router.get('/:name', async (req: Request, res: Response) => {
  try {
    const skill = skillsService.getSkill(req.params.name);
    if (!skill) {
      return res.status(404).json(error('RES_NOT_FOUND', '技能不存在'));
    }
    res.json(success({
      name: skill.name,
      displayName: skill.displayName,
      description: skill.description,
      category: skill.category,
      parameters: skill.parameters
    }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /:name/execute - 执行技能
 */
router.post('/:name/execute', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const { params, context } = req.body;
    const userId = (req as any).user?.id || 'system';

    const skillContext: SkillContext = {
      ...context,
      userId,
      workDir: process.cwd()
    };

    const startTime = Date.now();
    const result = await skillsService.executeSkill(req.params.name, params || {}, skillContext);
    const executionTime = Date.now() - startTime;

    res.json(success({ result, executionTime }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /execute - 执行技能（兼容旧路由，技能名在 body 中）
 */
router.post('/execute', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const { skill, params } = req.body;
    if (!skill) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '请指定技能名称'));
    }

    const userId = (req as any).user?.id || 'system';
    const skillContext: SkillContext = {
      userId,
      workDir: process.cwd()
    };

    const result = await skillsService.executeSkill(skill, params || {}, skillContext);
    res.json(success(result));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /batch - 批量执行技能
 */
router.post('/batch', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const { tasks } = req.body;
    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '请提供任务列表'));
    }

    const userId = (req as any).user?.id || 'system';
    const results: any[] = [];

    for (const task of tasks) {
      const { skill, params } = task;
      const skillContext: SkillContext = { userId, workDir: process.cwd() };
      const result = await skillsService.executeSkill(skill, params || {}, skillContext);
      results.push({ skill, ...result });
    }

    res.json(success({
      results,
      total: results.length,
      succeeded: results.filter((r: any) => r.success).length
    }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

// 默认导出 router
export default router;

// 命名导出
export { router };

// 工厂函数（向后兼容）
export function createSkillsRoutes() {
  return router;
}
