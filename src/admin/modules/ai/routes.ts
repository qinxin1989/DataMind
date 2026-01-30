/**
 * AI 管理 API 路由
 */

import { Router, Request, Response } from 'express';
import { aiConfigService } from './aiConfigService';
import { aiStatsService } from './aiStatsService';
import { aiQAService } from '../ai-qa/aiQAService';
import { crawlerAssistantService } from './crawlerAssistantService';
import { requirePermission } from '../../middleware/permission';
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

// ==================== AI 配置管理 ====================

/**
 * GET /ai/configs - 获取所有 AI 配置
 */
router.get('/configs', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const configs = await aiConfigService.getProviderConfigs();
    // 隐藏 API Key
    const safeConfigs = configs.map(c => ({
      ...c,
      apiKey: c.apiKey ? '***' + c.apiKey.slice(-4) : '',
    }));
    res.json(success(safeConfigs));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /ai/configs/:id - 获取单个 AI 配置
 */
router.get('/configs/:id', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const config = await aiConfigService.getProviderConfigById(req.params.id);
    if (!config) {
      return res.status(404).json(error('RES_NOT_FOUND', 'AI 配置不存在'));
    }
    // 隐藏 API Key
    const safeConfig = {
      ...config,
      apiKey: config.apiKey ? '***' + config.apiKey.slice(-4) : '',
    };
    res.json(success(safeConfig));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /ai/configs - 创建 AI 配置
 */
router.post('/configs', requirePermission('ai:config'), async (req: Request, res: Response) => {
  try {
    const { name, provider, apiKey, apiEndpoint, model, maxTokens, temperature, isDefault } = req.body;

    if (!name || !provider || !apiKey || !model) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少必要参数'));
    }

    const config = await aiConfigService.createProviderConfig({
      name,
      provider,
      apiKey,
      apiEndpoint,
      model,
      maxTokens: maxTokens || 2048,
      temperature: temperature ?? 0.7,
      isDefault: isDefault || false,
      status: 'active',
    });

    // AI 配置更新后，重新加载 RAGEngine 和 AIAgent
    await aiQAService.reloadRAGEngine();
    await aiQAService.reloadAIAgent();

    res.status(201).json(success(config));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * PUT /ai/configs/priorities - 批量更新优先级（拖拽排序）
 * 注意：此路由必须在 /configs/:id 之前定义
 */
router.put('/configs/priorities', requirePermission('ai:config'), async (req: Request, res: Response) => {
  try {
    const { priorities } = req.body;
    if (!Array.isArray(priorities)) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少 priorities 数组'));
    }
    await aiConfigService.updatePriorities(priorities);

    // 优先级更新后，重新加载 RAGEngine 和 AIAgent
    await aiQAService.reloadRAGEngine();
    await aiQAService.reloadAIAgent();

    res.json(success({ message: '优先级更新成功' }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * PUT /ai/configs/:id - 更新 AI 配置
 */
router.put('/configs/:id', requirePermission('ai:config'), async (req: Request, res: Response) => {
  try {
    const config = await aiConfigService.updateProviderConfig(req.params.id, req.body);

    // AI 配置更新后，重新加载 RAGEngine 和 AIAgent
    await aiQAService.reloadRAGEngine();
    await aiQAService.reloadAIAgent();

    res.json(success(config));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * DELETE /ai/configs/:id - 删除 AI 配置
 */
router.delete('/configs/:id', requirePermission('ai:config'), async (req: Request, res: Response) => {
  try {
    await aiConfigService.deleteProviderConfig(req.params.id);

    // AI 配置删除后，重新加载 RAGEngine 和 AIAgent
    await aiQAService.reloadRAGEngine();
    await aiQAService.reloadAIAgent();

    res.json(success({ message: '删除成功' }));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', err.message));
    }
    if (err.message.includes('默认')) {
      return res.status(400).json(error('BIZ_CANNOT_DELETE_DEFAULT', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * PUT /ai/configs/:id/default - 设置默认配置
 */
router.put('/configs/:id/default', requirePermission('ai:config'), async (req: Request, res: Response) => {
  try {
    const config = await aiConfigService.setDefaultProvider(req.params.id);

    // 设置默认配置后，重新加载 AIAgent
    await aiQAService.reloadAIAgent();

    res.json(success(config));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /ai/configs/validate - 验证 API Key
 */
router.post('/configs/validate', requirePermission('ai:config'), async (req: Request, res: Response) => {
  try {
    const { provider, apiKey, apiEndpoint, configId, model } = req.body;

    let keyToValidate = apiKey;
    let endpointToValidate = apiEndpoint;
    let providerToValidate = provider;
    let modelToValidate = model;

    // 如果提供了 configId，从数据库获取真实的配置信息
    if (configId) {
      const config = await aiConfigService.getConfigById(configId);
      if (config) {
        keyToValidate = config.apiKey;
        endpointToValidate = endpointToValidate || config.baseUrl;
        providerToValidate = providerToValidate || config.provider;
        modelToValidate = modelToValidate || config.model;  // 获取模型
      } else {
        return res.status(404).json(error('RES_NOT_FOUND', '配置不存在'));
      }
    }

    if (!providerToValidate || !keyToValidate) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少必要参数'));
    }

    const result = await aiConfigService.validateApiKey(providerToValidate, keyToValidate, endpointToValidate, modelToValidate);
    res.json(success(result));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

// ==================== AI 使用统计 ====================

/**
 * GET /ai/stats - 获取使用统计
 */
router.get('/stats', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const startTime = req.query.startTime
      ? parseInt(req.query.startTime as string)
      : Date.now() - 30 * 24 * 60 * 60 * 1000;
    const endTime = req.query.endTime
      ? parseInt(req.query.endTime as string)
      : Date.now();

    const stats = await aiStatsService.getUsageStats(startTime, endTime);
    res.json(success(stats));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /ai/stats/user/:userId - 获取用户统计
 */
router.get('/stats/user/:userId', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const startTime = req.query.startTime
      ? parseInt(req.query.startTime as string)
      : Date.now() - 30 * 24 * 60 * 60 * 1000;
    const endTime = req.query.endTime
      ? parseInt(req.query.endTime as string)
      : Date.now();

    const stats = await aiStatsService.getUserStats(req.params.userId, startTime, endTime);
    res.json(success(stats));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

// ==================== 对话历史 ====================

/**
 * GET /ai/conversations - 查询对话历史
 */
router.get('/conversations', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const params = {
      userId: req.query.userId as string,
      datasourceId: req.query.datasourceId as string,
      keyword: req.query.keyword as string,
      startTime: req.query.startTime ? parseInt(req.query.startTime as string) : undefined,
      endTime: req.query.endTime ? parseInt(req.query.endTime as string) : undefined,
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20,
    };

    const result = await aiStatsService.queryConversations(params);
    res.json(success(result));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /ai/conversations/:userId/:id - 获取单个对话
 */
router.get('/conversations/:userId/:id', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const conversation = await aiStatsService.getConversationById(req.params.userId, req.params.id);
    if (!conversation) {
      return res.status(404).json(error('RES_NOT_FOUND', '对话记录不存在'));
    }
    res.json(success(conversation));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * DELETE /ai/conversations/:userId/:id - 删除对话
 */
router.delete('/conversations/:userId/:id', requirePermission('ai:config'), async (req: Request, res: Response) => {
  try {
    await aiStatsService.deleteConversation(req.params.userId, req.params.id);
    res.json(success({ message: '删除成功' }));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

// ==================== AI 爬虫助手 ====================

/**
 * POST /ai/crawler/analyze - 分析网页并生成选择器
 */
router.post('/crawler/analyze', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const { url, description } = req.body;

    if (!url) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少网址参数'));
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return res.status(400).json(error('VALID_PARAM_INVALID', '网址格式不正确'));
    }

    const userId = (req as any).user?.id || 'admin';
    const result = await crawlerAssistantService.analyzeWebpage(url, description || '提取页面主要内容');

    res.json(success(result));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /ai/crawler/preview - 预览爬虫效果
 */
router.post('/crawler/preview', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const { url, selectors } = req.body;

    if (!url || !selectors) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少必要参数'));
    }

    const data = await crawlerAssistantService.previewExtraction(url, selectors);
    res.json(success(data));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /ai/crawler/proxy - 网页预览代理
 */
router.get('/crawler/proxy', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const url = req.query.url as string;
    if (!url) {
      return res.status(400).send('URL missing');
    }

    const html = await crawlerAssistantService.getProxyHtml(url);

    // 发送 HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // 移除安全策略，允许嵌入本地 iframe
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.send(html);
  } catch (err: any) {
    res.status(500).send(`Proxy failed: ${err.message}`);
  }
});

/**
 * POST /ai/crawler/template - 保存爬虫模板
 */
router.post('/crawler/template', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const { name, description, url, selectors } = req.body;

    if (!name || !url || !selectors) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少必要参数'));
    }

    const userId = (req as any).user?.id || 'admin';
    const templateId = await crawlerAssistantService.saveTemplate({
      name,
      description: description || '',
      url,
      selectors,
      userId
    });

    res.json(success({
      id: templateId,
      message: '模板保存成功'
    }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /ai/crawler/templates - 获取用户的爬虫模板列表
 */
router.get('/crawler/templates', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'admin';
    const templates = await crawlerAssistantService.getUserTemplates(userId);
    res.json(success(templates));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /ai/crawler/templates/:id - 获取单个模板详情
 */
router.get('/crawler/templates/:id', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'admin';
    const template = await crawlerAssistantService.getTemplateById(req.params.id, userId);

    if (!template) {
      return res.status(404).json(error('RES_NOT_FOUND', '模板不存在'));
    }

    res.json(success(template));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * PUT /ai/crawler/templates/:id - 更新模板
 */
router.put('/crawler/templates/:id', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'admin';
    await crawlerAssistantService.updateTemplate(req.params.id, userId, req.body);
    res.json(success({ message: '更新成功' }));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * DELETE /ai/crawler/templates/:id - 删除模板
 */
router.delete('/crawler/templates/:id', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'admin';
    await crawlerAssistantService.deleteTemplate(req.params.id, userId);
    res.json(success({ message: '删除成功' }));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

export default router;
