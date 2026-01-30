/**
 * Skills API Routes
 * 技能执行 API 路由
 */

import { Router, Request, Response } from 'express';
import { skillsRegistry } from '../../../agent/skills/registry';
import { datasourceService } from '../../modules/datasource/datasourceService';
import { createDataSource } from '../../../datasource';
import { DataSourceConfig } from '../../../types';
import { crawlerService } from '../../../agent/skills/crawler/service';

const router = Router();

// 将 Datasource 转换为 DataSourceConfig
function toDataSourceConfig(ds: any): DataSourceConfig {
  return {
    type: ds.type === 'postgresql' ? 'postgres' : ds.type,
    host: ds.host,
    port: ds.port,
    database: ds.database,
    user: ds.username,
    password: ds.password,
    ...ds.options
  };
}

/**
 * 获取所有技能列表
 * GET /api/skills
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;

    let skills;
    if (category) {
      skills = skillsRegistry.getByCategory(category as any);
    } else {
      skills = skillsRegistry.getAll();
    }

    const result = skills.map((s: any) => ({
      name: s.name,
      category: s.category,
      displayName: s.displayName,
      description: s.description,
      parameters: s.parameters
    }));

    res.json({
      success: true,
      data: result,
      total: result.length
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取技能分类
 * GET /api/skills/categories
 */
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const categories = skillsRegistry.getCategories();

    const result = categories.map((cat: any) => ({
      name: cat,
      skills: skillsRegistry.getByCategory(cat).length
    }));

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取单个技能详情
 * GET /api/skills/:name
 */
router.get('/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const skill = skillsRegistry.get(name);

    if (!skill) {
      return res.status(404).json({
        success: false,
        error: `技能不存在: ${name}`
      });
    }

    res.json({
      success: true,
      data: {
        name: skill.name,
        category: skill.category,
        displayName: skill.displayName,
        description: skill.description,
        parameters: skill.parameters
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 执行技能
 * POST /api/skills/execute
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { skill, params } = req.body;

    if (!skill) {
      return res.status(400).json({
        success: false,
        error: '请指定技能名称'
      });
    }

    // 构建执行上下文
    const context: any = {
      workDir: 'public/downloads',
      userId: (req as any).user?.id
    };

    // 如果有数据源ID，加载数据源
    if (params?.datasourceId) {
      try {
        const dsRecord = await datasourceService.getDatasourceById(params.datasourceId);
        if (dsRecord) {
          const dsConfig = toDataSourceConfig(dsRecord);
          const ds = createDataSource(dsConfig);
          context.dataSource = ds;
          context.schemas = await ds.getSchema();
          context.dbType = dsRecord.type;
        }
      } catch (e) {
        console.error('Failed to load datasource:', e);
      }
    }

    // 执行技能
    const result = await skillsRegistry.execute(skill, params || {}, context);

    res.json(result);
  } catch (error: any) {
    console.error('Skill execution error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 批量执行技能
 * POST /api/skills/batch
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { tasks } = req.body;

    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({
        success: false,
        error: '请提供任务列表'
      });
    }

    const results: any[] = [];

    for (const task of tasks) {
      const { skill, params } = task;

      const context: any = {
        workDir: 'public/downloads',
        userId: (req as any).user?.id
      };

      // 如果有数据源ID，加载数据源
      if (params?.datasourceId) {
        try {
          const dsRecord = await datasourceService.getDatasourceById(params.datasourceId);
          if (dsRecord) {
            const dsConfig = toDataSourceConfig(dsRecord);
            const ds = createDataSource(dsConfig);
            context.dataSource = ds;
            context.schemas = await ds.getSchema();
            context.dbType = dsRecord.type;
          }
        } catch (e) {
          console.error('Failed to load datasource:', e);
        }
      }

      const result = await skillsRegistry.execute(skill, params || {}, context);
      results.push({
        skill,
        ...result
      });
    }

    res.json({
      success: true,
      data: results,
      total: results.length,
      succeeded: results.filter((r: any) => r.success).length
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取爬虫模板列表
 */
router.get('/crawler/templates', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'admin';
    const templates = await crawlerService.getAllTemplates(userId);
    res.json({ success: true, data: templates });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 保存抓取模板
 */
router.post('/crawler/templates', async (req: Request, res: Response) => {
  const { name, url, department, data_type, selectors } = req.body;
  const userId = (req as any).user?.id || 'admin';

  try {
    const id = await crawlerService.saveTemplate({
      userId,
      name,
      url,
      department,
      data_type,
      containerSelector: selectors.container,
      fields: Object.entries(selectors.fields).map(([name, selector]: any) => ({ name, selector }))
    });
    res.json({ success: true, data: { id } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取定时任务列表
 */
router.get('/crawler/tasks', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'admin';
    const tasks = await crawlerService.getAllTasks(userId);
    res.json({ success: true, data: tasks });
  } catch (error: any) {
    console.error('获取定时任务列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 切换定时任务状态
 */
router.post('/crawler/tasks/:id/toggle', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await crawlerService.toggleTaskStatus(id, status);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取最近采集批次
 */
router.get('/crawler/results', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'admin';
    const results = await crawlerService.getRecentResults(userId);
    res.json({ success: true, data: results });
  } catch (error: any) {
    console.error('获取最近采集批次失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取具体批次的明细数据
 */
router.get('/crawler/results/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rows = await crawlerService.getResultRows(id);
    res.json({ success: true, data: rows });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 删除单次采集结果
 */
router.delete('/crawler/results/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await crawlerService.deleteResult(id);
    res.json({ success: true, message: '采集记录已删除' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 删除爬虫模板
 */
router.delete('/crawler/templates/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await crawlerService.deleteTemplate(id);
    res.json({ success: true, message: '模板删除成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
