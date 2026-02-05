/**
 * 技能服务路由
 * 直接导出 router，与模块加载器兼容
 */

import { Router, Request, Response } from 'express';
import { skillsService } from './service';
import type { SkillCategory, SkillContext } from './types';

const router = Router();

/**
 * GET / - 获取技能列表
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as SkillCategory | undefined;
    const result = skillsService.getSkillList(category);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Skills] Get skills error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /categories - 获取技能分类
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = skillsService.getRegistry().getCategories();
    res.json({ success: true, data: categories });
  } catch (error: any) {
    console.error('[Skills] Get categories error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /capabilities - 获取 Agent 能力
 */
router.get('/capabilities', async (req: Request, res: Response) => {
  try {
    const capabilities = skillsService.getCapabilities();
    res.json({ success: true, data: capabilities });
  } catch (error: any) {
    console.error('[Skills] Get capabilities error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /stats - 获取技能统计
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = skillsService.getStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error('[Skills] Get stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /descriptions - 获取技能描述（供 AI 使用）
 */
router.get('/descriptions', async (req: Request, res: Response) => {
  try {
    const descriptions = skillsService.getSkillDescriptions();
    res.json({ success: true, data: descriptions });
  } catch (error: any) {
    console.error('[Skills] Get descriptions error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /mcp-tools - 获取 MCP 工具定义
 */
router.get('/mcp-tools', async (req: Request, res: Response) => {
  try {
    const tools = skillsService.getMCPTools();
    res.json({ success: true, data: tools });
  } catch (error: any) {
    console.error('[Skills] Get MCP tools error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /:name - 获取技能详情
 */
router.get('/:name', async (req: Request, res: Response) => {
  try {
    const skill = skillsService.getSkill(req.params.name);
    if (!skill) {
      return res.status(404).json({ error: '技能不存在' });
    }
    res.json({
      success: true,
      data: {
        name: skill.name,
        displayName: skill.displayName,
        description: skill.description,
        category: skill.category,
        parameters: skill.parameters
      }
    });
  } catch (error: any) {
    console.error('[Skills] Get skill error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /:name/execute - 执行技能
 */
router.post('/:name/execute', async (req: Request, res: Response) => {
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

    res.json({
      success: true,
      data: {
        result,
        executionTime
      }
    });
  } catch (error: any) {
    console.error('[Skills] Execute skill error:', error);
    res.status(500).json({ error: error.message });
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