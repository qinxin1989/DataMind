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
    // 隐藏 API Key，并确保字段名兼容
    const safeConfigs = configs.map(c => ({
      ...c,
      apiKey: c.apiKey ? '***' + c.apiKey.slice(-4) : '',
      apiEndpoint: c.baseUrl,  // 前端使用 apiEndpoint
      baseUrl: c.baseUrl,      // 保留 baseUrl 以兼容
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
    // 隐藏 API Key，并确保字段名兼容
    const safeConfig = {
      ...config,
      apiKey: config.apiKey ? '***' + config.apiKey.slice(-4) : '',
      apiEndpoint: config.baseUrl,  // 前端使用 apiEndpoint
      baseUrl: config.baseUrl,      // 保留 baseUrl 以兼容
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
    const { name, provider, apiKey, apiEndpoint, baseUrl, model, maxTokens, temperature, isDefault } = req.body;

    if (!name || !provider || !apiKey || !model) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少必要参数'));
    }

    const config = await aiConfigService.createProviderConfig({
      name,
      provider,
      apiKey,
      apiEndpoint: apiEndpoint || baseUrl,
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
 * POST /ai/crawler/chat - 智能爬虫助手对话（支持多网址与上下文反馈）
 */
router.post('/crawler/chat', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const { messages, stream } = req.body;
    const userId = (req as any).user?.id || 'admin';

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少对话消息'));
    }

    if (stream) {
      // 开启流式输出 (SSE)
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      try {
        await crawlerAssistantService.processChat(messages, userId, (data) => {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        });
        res.write('data: {"type":"done"}\n\n');
        res.end();
      } catch (streamErr: any) {
        res.write(`data: ${JSON.stringify({ type: 'error', content: streamErr.message })}\n\n`);
        res.end();
      }
    } else {
      // 普通 JSON 返回
      const result = await crawlerAssistantService.processChat(messages, userId);
      res.json(success(result));
    }
  } catch (err: any) {
    console.error('[Crawler Chat] Error:', err);
    if (!res.headersSent) {
      res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
    }
  }
});

/**
 * POST /ai/crawler/preview - 预览爬虫效果
 * 需求: 2.1, 2.3, 2.4
 */
router.post('/crawler/preview', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const { 
      url, 
      selectors, 
      limit = 10,  // 默认10条
      page = 1,    // 当前页码，默认第1页
      pageSize     // 每页条数，如果提供则使用分页模式
    } = req.body;

    if (!url || !selectors) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少必要参数'));
    }

    // 验证参数
    const parsedLimit = parseInt(limit as any) || 10;
    const parsedPage = parseInt(page as any) || 1;
    const parsedPageSize = pageSize ? parseInt(pageSize as any) : null;

    // 获取所有数据
    const data = await crawlerAssistantService.previewExtraction(url, selectors);
    const total = Array.isArray(data) ? data.length : 0;

    let resultData: any;
    let currentPage: number;
    let totalPages: number;

    // 如果提供了 pageSize，使用分页模式
    if (parsedPageSize && parsedPageSize > 0) {
      const startIndex = (parsedPage - 1) * parsedPageSize;
      const endIndex = startIndex + parsedPageSize;
      resultData = Array.isArray(data) ? data.slice(startIndex, endIndex) : data;
      currentPage = parsedPage;
      totalPages = Math.ceil(total / parsedPageSize);
    } else {
      // 否则使用 limit 模式（向后兼容）
      resultData = Array.isArray(data) ? data.slice(0, parsedLimit) : data;
      currentPage = 1;
      totalPages = 1;
    }

    res.json(success({
      data: resultData,
      total,
      limit: parsedPageSize || parsedLimit,
      page: currentPage,
      pageSize: parsedPageSize || parsedLimit,
      totalPages
    }));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /ai/crawler/diagnose - AI失败诊断
 * 需求: 6.2, 6.3, 6.4, 6.5
 */
router.post('/crawler/diagnose', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const { url, selectors, error: errorMsg } = req.body;

    if (!url || !selectors) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少必要参数'));
    }

    const axios = require('axios');
    const cheerio = require('cheerio');
    
    // 获取网页HTML
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const diagnosis: any = {
      reason: '',
      issues: [],
      suggestions: [],
      recommendedStrategy: {}
    };

    // 检查容器选择器（需求 6.3）
    if (selectors.container) {
      const containers = $(selectors.container);
      if (containers.length === 0) {
        diagnosis.issues.push('容器选择器未匹配到任何元素');
        diagnosis.suggestions.push('检查容器选择器是否正确，或尝试使用更通用的选择器如 "body"');
      }
    }

    // 检查字段选择器（需求 6.3）
    const failedFields: string[] = [];
    if (selectors.fields) {
      for (const [field, selector] of Object.entries(selectors.fields)) {
        const elements = $(selector as string);
        if (elements.length === 0) {
          diagnosis.issues.push(`字段 "${field}" 的选择器未匹配到任何元素`);
          failedFields.push(field);
        }
      }
    }

    // 检查是否是动态加载（需求 6.4）
    const hasScripts = $('script').length > 10;
    const hasReactVue = response.data.includes('react') || 
                        response.data.includes('vue') || 
                        response.data.includes('angular') ||
                        response.data.includes('__NEXT_DATA__');
    
    if (hasScripts || hasReactVue) {
      diagnosis.issues.push('页面可能使用了动态加载（检测到大量JavaScript或前端框架）');
      diagnosis.suggestions.push('建议使用浏览器自动化工具（如Puppeteer）进行采集');
      diagnosis.recommendedStrategy.useHeadless = true;
      diagnosis.recommendedStrategy.waitForSelector = selectors.container || 'body';
    }

    // 调用AI服务分析失败原因（需求 6.2）
    try {
      const aiConfigs = await aiConfigService.getActiveConfigsByPriority();
      if (aiConfigs && aiConfigs.length > 0) {
        const aiConfig = aiConfigs[0];
        const OpenAI = require('openai').default;
        const openai = new OpenAI({
          apiKey: aiConfig.apiKey,
          baseURL: aiConfig.baseUrl || undefined
        });

        // 构建AI分析提示
        const prompt = `作为网页爬虫专家，请分析以下采集失败的情况：

网址: ${url}
错误信息: ${errorMsg || '未提供'}
容器选择器: ${selectors.container || '无'}
失败的字段: ${failedFields.join(', ') || '无'}
检测到的问题: ${diagnosis.issues.join('; ')}

请提供：
1. 失败的主要原因
2. 具体的修复建议（3-5条）
3. 推荐的采集策略

请用简洁的中文回答，以JSON格式返回：
{
  "reason": "主要原因",
  "suggestions": ["建议1", "建议2", "建议3"],
  "strategy": {
    "useHeadless": true/false,
    "waitForSelector": "选择器",
    "scrollToBottom": true/false,
    "customScript": "自定义脚本"
  }
}`;

        const aiResponse = await openai.chat.completions.create({
          model: aiConfig.model || 'gpt-4o',
          messages: [
            { role: 'system', content: '你是一个专业的网页爬虫诊断专家，擅长分析采集失败原因并提供解决方案。' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 1000
        });

        const aiContent = aiResponse.choices[0]?.message?.content || '';
        
        // 尝试解析AI返回的JSON
        try {
          const aiAnalysis = JSON.parse(aiContent);
          diagnosis.reason = aiAnalysis.reason || diagnosis.issues.join('; ');
          diagnosis.suggestions = [...diagnosis.suggestions, ...(aiAnalysis.suggestions || [])];
          diagnosis.recommendedStrategy = {
            ...diagnosis.recommendedStrategy,
            ...(aiAnalysis.strategy || {})
          };
        } catch (parseErr) {
          // 如果AI返回的不是JSON，直接使用文本
          diagnosis.reason = aiContent || diagnosis.issues.join('; ');
        }
      } else {
        // 没有AI配置，使用基本分析
        diagnosis.reason = diagnosis.issues.join('; ') || '未检测到明显问题';
        if (failedFields.length > 0) {
          diagnosis.suggestions.push(`尝试在浏览器开发者工具中验证这些字段的选择器: ${failedFields.join(', ')}`);
        }
      }
    } catch (aiErr: any) {
      console.error('[Diagnose] AI analysis error:', aiErr.message);
      // AI分析失败，使用基本分析
      diagnosis.reason = diagnosis.issues.join('; ') || '未检测到明显问题';
      if (failedFields.length > 0) {
        diagnosis.suggestions.push(`尝试在浏览器开发者工具中验证这些字段的选择器: ${failedFields.join(', ')}`);
      }
    }

    // 如果没有推荐策略，提供默认策略
    if (Object.keys(diagnosis.recommendedStrategy).length === 0) {
      diagnosis.recommendedStrategy = {
        useHeadless: false,
        waitForSelector: selectors.container || 'body'
      };
    }

    res.json(success(diagnosis));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /ai/crawler/test - 测试爬虫模板
 * 需求: 10.2, 10.3, 10.4
 */
router.post('/crawler/test', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const { url, selectors, paginationConfig } = req.body;

    // 参数验证
    if (!url || !selectors) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少必要参数：url 和 selectors'));
    }

    // URL格式验证
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return res.status(400).json(error('VALID_PARAM_INVALID', 'URL格式不正确，必须以http://或https://开头'));
    }

    // 执行测试采集（需求 10.2）
    let testResult: any;
    let testError: string | null = null;
    
    try {
      testResult = await crawlerAssistantService.previewExtraction(url, selectors);
    } catch (extractErr: any) {
      testError = extractErr.message;
      testResult = [];
    }

    const isSuccess = Array.isArray(testResult) && testResult.length > 0;
    const dataCount = Array.isArray(testResult) ? testResult.length : 0;

    // 构建测试结果（需求 10.3）
    const result: any = {
      success: isSuccess,
      data: testResult,
      count: dataCount,
      url,
      selectors,
      timestamp: Date.now()
    };

    // 添加成功或失败消息
    if (isSuccess) {
      result.message = `✓ 测试成功！采集到 ${dataCount} 条数据`;
      result.summary = {
        totalItems: dataCount,
        fields: Object.keys(selectors.fields || {}),
        containerUsed: selectors.container || 'body'
      };
    } else {
      result.message = testError 
        ? `✗ 测试失败：${testError}` 
        : '✗ 测试失败：未采集到数据，请检查选择器配置';
      result.error = testError || '未采集到数据';
      
      // 提供诊断建议
      result.suggestions = [
        '1. 使用浏览器开发者工具验证选择器是否正确',
        '2. 检查网页是否需要登录或有反爬虫机制',
        '3. 尝试使用"AI分析"功能获取详细诊断'
      ];
    }

    // 如果配置了分页，添加分页信息
    if (paginationConfig && paginationConfig.enabled) {
      result.pagination = {
        enabled: true,
        maxPages: paginationConfig.maxPages || 1,
        note: '注意：测试模式只采集第一页数据'
      };
    }

    // 返回结果（需求 10.4）
    res.json(success(result));
  } catch (err: any) {
    console.error('[Crawler Test] Error:', err);
    // 错误处理（需求 10.4）
    res.status(500).json(error('SYS_INTERNAL_ERROR', `测试失败: ${err.message}`));
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
 * POST /ai/crawler/validate-selector - 验证CSS选择器
 * 需求: 7.1, 7.2
 */
router.post('/crawler/validate-selector', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const { url, selector } = req.body;

    // 参数验证
    if (!url || !selector) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少必要参数：url 和 selector'));
    }

    // URL格式验证
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return res.status(400).json(error('VALID_PARAM_INVALID', 'URL格式不正确，必须以http://或https://开头'));
    }

    // 选择器格式验证（基本检查）
    if (typeof selector !== 'string' || selector.trim().length === 0) {
      return res.status(400).json(error('VALID_PARAM_INVALID', '选择器不能为空'));
    }

    const axios = require('axios');
    const cheerio = require('cheerio');
    
    // 获取网页HTML
    let htmlContent: string;
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 15000,
        maxRedirects: 5
      });

      if (typeof response.data !== 'string') {
        return res.status(500).json(error('FETCH_ERROR', '无法解析网页内容'));
      }

      htmlContent = response.data;
    } catch (fetchError: any) {
      console.error('[Validate Selector] Fetch error:', fetchError.message);
      
      if (fetchError.code === 'ECONNABORTED' || fetchError.code === 'ETIMEDOUT') {
        return res.status(408).json(error('TIMEOUT_ERROR', '请求超时，请检查网址是否可访问'));
      }
      
      if (fetchError.response?.status === 404) {
        return res.status(404).json(error('NOT_FOUND', '网页不存在（404）'));
      }
      
      if (fetchError.response?.status === 403) {
        return res.status(403).json(error('FORBIDDEN', '网页拒绝访问（403）'));
      }
      
      return res.status(500).json(error('FETCH_ERROR', `获取网页失败: ${fetchError.message}`));
    }

    // 使用cheerio解析HTML并验证选择器
    let $: any;
    let matchCount: number;
    
    try {
      $ = cheerio.load(htmlContent);
      const elements = $(selector);
      matchCount = elements.length;
    } catch (selectorError: any) {
      console.error('[Validate Selector] Selector error:', selectorError.message);
      return res.status(400).json(error('INVALID_SELECTOR', `选择器语法错误: ${selectorError.message}`));
    }

    // 返回验证结果
    const result = {
      valid: matchCount > 0,
      matchCount,
      message: matchCount > 0 
        ? `找到 ${matchCount} 个匹配元素` 
        : '未找到匹配元素，请检查选择器是否正确'
    };

    res.json(success(result));
  } catch (err: any) {
    console.error('[Validate Selector] Unexpected error:', err);
    res.status(500).json(error('SYS_INTERNAL_ERROR', `系统错误: ${err.message}`));
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

// ==================== AI 对话接口 ====================

/**
 * POST /ai/chat - AI对话接口（支持上下文追问）
 */
router.post('/chat', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少对话消息'));
    }

    // 获取AI配置
    const configs = await aiConfigService.getActiveConfigsByPriority();
    if (!configs || configs.length === 0) {
      return res.status(400).json(error('AI_CONFIG_NOT_FOUND', '未配置AI服务'));
    }

    const aiConfig = configs[0];

    // 调用OpenAI接口
    const OpenAI = require('openai').default;
    const openai = new OpenAI({
      apiKey: aiConfig.apiKey,
      baseURL: aiConfig.baseUrl || undefined
    });

    const response = await openai.chat.completions.create({
      model: aiConfig.model || 'gpt-4o',
      messages: messages.map((m: any) => ({
        role: m.role,
        content: m.content
      })),
      temperature: 0.7,
      max_tokens: 2000
    });

    const aiMessage = response.choices[0]?.message?.content || '抱歉，我无法理解您的问题。';

    res.json(success({
      message: aiMessage,
      content: aiMessage
    }));
  } catch (err: any) {
    console.error('[AI Chat] Error:', err);
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message || 'AI对话失败'));
  }
});

// ==================== 爬虫助手对话历史 ====================

/**
 * GET /ai/crawler-conversations-latest - 获取最新对话
 * 注意：这个路由必须在 /:id 之前定义，避免被 :id 路由捕获
 */
router.get('/crawler-conversations-latest', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'system';
    const { pool } = require('../../core/database');
    
    // 获取最新对话
    const [convRows] = await pool.execute(
      `SELECT id, user_id, title, created_at, updated_at 
       FROM crawler_assistant_conversations 
       WHERE user_id = ? 
       ORDER BY updated_at DESC 
       LIMIT 1`,
      [userId]
    );
    
    if ((convRows as any[]).length === 0) {
      return res.json(success(null));
    }
    
    const conversation = (convRows as any[])[0];
    
    // 获取该对话的所有消息
    const [msgRows] = await pool.execute(
      `SELECT id, role, type, content, created_at 
       FROM crawler_assistant_messages 
       WHERE conversation_id = ? 
       ORDER BY created_at ASC`,
      [conversation.id]
    );
    
    // 解析消息内容
    const messages = (msgRows as any[]).map((msg: any) => ({
      id: msg.id,
      role: msg.role,
      type: msg.type,
      content: msg.content ? JSON.parse(msg.content) : null,
      created_at: msg.created_at
    }));
    
    conversation.messages = messages;
    
    res.json(success(conversation));
  } catch (err: any) {
    console.error('[Get Latest Conversation] Error:', err);
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /ai/crawler-conversations - 获取对话列表
 */
router.get('/crawler-conversations', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'system';
    const { pool } = require('../../core/database');
    
    const [rows] = await pool.execute(
      `SELECT id, title, created_at, updated_at 
       FROM crawler_assistant_conversations 
       WHERE user_id = ? 
       ORDER BY updated_at DESC 
       LIMIT 50`,
      [userId]
    );
    
    res.json(success(rows));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /ai/crawler-conversations/:id - 获取对话详情
 */
router.get('/crawler-conversations/:id', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const { pool } = require('../../core/database');
    
    // 获取对话基本信息
    const [convRows] = await pool.execute(
      'SELECT * FROM crawler_assistant_conversations WHERE id = ?',
      [req.params.id]
    );
    
    if ((convRows as any[]).length === 0) {
      return res.status(404).json(error('NOT_FOUND', '对话不存在'));
    }
    
    const conversation = (convRows as any[])[0];
    
    // 获取该对话的所有消息
    const [msgRows] = await pool.execute(
      `SELECT id, role, type, content, created_at 
       FROM crawler_assistant_messages 
       WHERE conversation_id = ? 
       ORDER BY created_at ASC`,
      [req.params.id]
    );
    
    // 解析消息内容
    const messages = (msgRows as any[]).map((msg: any) => ({
      id: msg.id,
      role: msg.role,
      type: msg.type,
      content: msg.content ? JSON.parse(msg.content) : null,
      created_at: msg.created_at
    }));
    
    conversation.messages = messages;
    
    res.json(success(conversation));
  } catch (err: any) {
    console.error('[Get Conversation] Error:', err);
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /ai/crawler-conversations - 创建新对话
 */
router.post('/crawler-conversations', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'system';
    const { title = '新对话', messages = [] } = req.body;
    const { v4: uuidv4 } = require('uuid');
    const { pool } = require('../../core/database');
    
    const id = uuidv4();
    
    // 创建对话
    await pool.execute(
      `INSERT INTO crawler_assistant_conversations (id, user_id, title) 
       VALUES (?, ?, ?)`,
      [id, userId, title]
    );
    
    // 如果有初始消息，插入消息表
    if (messages.length > 0) {
      for (const msg of messages) {
        const msgId = uuidv4();
        await pool.execute(
          `INSERT INTO crawler_assistant_messages (id, conversation_id, role, type, content) 
           VALUES (?, ?, ?, ?, ?)`,
          [
            msgId,
            id,
            msg.role || 'user',
            msg.type || 'text',
            JSON.stringify(msg.content || msg)
          ]
        );
      }
    }
    
    res.json(success({ 
      id, 
      title, 
      messages, 
      created_at: new Date(), 
      updated_at: new Date() 
    }));
  } catch (err: any) {
    console.error('[Create Conversation] Error:', err);
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * PUT /ai/crawler-conversations/:id - 更新对话
 */
router.put('/crawler-conversations/:id', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const { title, messages } = req.body;
    const { pool } = require('../../core/database');
    const { v4: uuidv4 } = require('uuid');
    
    // 更新标题
    if (title !== undefined) {
      await pool.execute(
        'UPDATE crawler_assistant_conversations SET title = ? WHERE id = ?',
        [title, req.params.id]
      );
    }
    
    // 更新消息
    if (messages !== undefined && Array.isArray(messages)) {
      // 删除旧消息
      await pool.execute(
        'DELETE FROM crawler_assistant_messages WHERE conversation_id = ?',
        [req.params.id]
      );
      
      // 插入新消息
      for (const msg of messages) {
        const msgId = msg.id || uuidv4();
        await pool.execute(
          `INSERT INTO crawler_assistant_messages (id, conversation_id, role, type, content) 
           VALUES (?, ?, ?, ?, ?)`,
          [
            msgId,
            req.params.id,
            msg.role || 'user',
            msg.type || 'text',
            JSON.stringify(msg.content || msg)
          ]
        );
      }
    }
    
    res.json(success({ message: '更新成功' }));
  } catch (err: any) {
    console.error('[Update Conversation] Error:', err);
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * DELETE /ai/crawler-conversations/:id - 删除对话
 */
router.delete('/crawler-conversations/:id', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const { pool } = require('../../core/database');
    
    // 先删除该对话的所有消息
    await pool.execute(
      'DELETE FROM crawler_assistant_messages WHERE conversation_id = ?',
      [req.params.id]
    );
    
    // 再删除对话
    await pool.execute(
      'DELETE FROM crawler_assistant_conversations WHERE id = ?',
      [req.params.id]
    );
    
    res.json(success({ message: '删除成功' }));
  } catch (err: any) {
    console.error('[Delete Conversation] Error:', err);
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

export default router;