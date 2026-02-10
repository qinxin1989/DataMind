/**
 * AI爬虫助手路由
 */

import { Router, Request, Response } from 'express';
import { crawlerAssistantService } from './service';
import { requirePermission } from '../../../src/admin/middleware/permission';
import { success, error } from '../../../src/admin/utils/response';

const router = Router();

// ==================== AI 爬虫助手 ====================

/**
 * POST /crawler/analyze - 分析网页并生成选择器
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
 * POST /crawler/chat - 智能爬虫助手对话（支持多网址与上下文反馈）
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
 * POST /crawler/preview - 预览爬虫效果
 */
router.post('/crawler/preview', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const {
      url,
      selectors,
      limit = 10,
      page = 1,
      pageSize
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
 * POST /crawler/diagnose - AI失败诊断
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

    // 检查容器选择器
    if (selectors.container) {
      const containers = $(selectors.container);
      if (containers.length === 0) {
        diagnosis.issues.push('容器选择器未匹配到任何元素');
        diagnosis.suggestions.push('检查容器选择器是否正确，或尝试使用更通用的选择器如 "body"');
      }
    }

    // 检查字段选择器
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

    // 检查是否是动态加载
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

    // 调用AI服务分析失败原因
    try {
      const { AIConfigService } = require('../../ai-config/backend/service');
      const { pool } = require('../../../src/admin/core/database');
      const aiConfigService = new AIConfigService(pool);
      const aiConfigs = await aiConfigService.getActiveConfigsByPriority();

      if (aiConfigs && aiConfigs.length > 0) {
        const aiConfig = aiConfigs[0];
        const OpenAI = require('openai').default;
        const openai = new OpenAI({
          apiKey: aiConfig.apiKey,
          baseURL: aiConfig.baseUrl || undefined
        });

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

        try {
          const aiAnalysis = JSON.parse(aiContent);
          diagnosis.reason = aiAnalysis.reason || diagnosis.issues.join('; ');
          diagnosis.suggestions = [...diagnosis.suggestions, ...(aiAnalysis.suggestions || [])];
          diagnosis.recommendedStrategy = {
            ...diagnosis.recommendedStrategy,
            ...(aiAnalysis.strategy || {})
          };
        } catch (parseErr) {
          diagnosis.reason = aiContent || diagnosis.issues.join('; ');
        }
      } else {
        diagnosis.reason = diagnosis.issues.join('; ') || '未检测到明显问题';
        if (failedFields.length > 0) {
          diagnosis.suggestions.push(`尝试在浏览器开发者工具中验证这些字段的选择器: ${failedFields.join(', ')}`);
        }
      }
    } catch (aiErr: any) {
      console.error('[Diagnose] AI analysis error:', aiErr.message);
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
 * POST /crawler/test - 测试爬虫模板
 */
router.post('/crawler/test', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const { url, selectors, paginationConfig } = req.body;

    if (!url || !selectors) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少必要参数：url 和 selectors'));
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return res.status(400).json(error('VALID_PARAM_INVALID', 'URL格式不正确，必须以http://或https://开头'));
    }

    let testResult: any;
    let testError: string | null = null;

    try {
      testResult = await crawlerAssistantService.previewExtraction(url, selectors, paginationConfig);
    } catch (extractErr: any) {
      testError = extractErr.message;
      testResult = [];
    }

    const isSuccess = Array.isArray(testResult) && testResult.length > 0;
    const dataCount = Array.isArray(testResult) ? testResult.length : 0;

    const result: any = {
      success: isSuccess,
      data: testResult,
      count: dataCount,
      url,
      selectors,
      timestamp: Date.now()
    };

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

      result.suggestions = [
        '1. 使用浏览器开发者工具验证选择器是否正确',
        '2. 检查网页是否需要登录或有反爬虫机制',
        '3. 尝试使用"AI分析"功能获取详细诊断'
      ];
    }

    if (paginationConfig && paginationConfig.enabled) {
      result.pagination = {
        enabled: true,
        maxPages: paginationConfig.maxPages || 1,
        note: '注意：测试模式只采集第一页数据'
      };
    }

    res.json(success(result));
  } catch (err: any) {
    console.error('[Crawler Test] Error:', err);
    res.status(500).json(error('SYS_INTERNAL_ERROR', `测试失败: ${err.message}`));
  }
});

/**
 * GET /crawler/proxy - 网页预览代理
 */
router.get('/crawler/proxy', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const url = req.query.url as string;
    if (!url) {
      return res.status(400).send('URL missing');
    }

    const html = await crawlerAssistantService.getProxyHtml(url);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.send(html);
  } catch (err: any) {
    res.status(500).send(`Proxy failed: ${err.message}`);
  }
});

/**
 * POST /crawler/template - 保存爬虫模板
 */
router.post('/crawler/template', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const { name, description, url, selectors, department, dataType } = req.body;

    if (!name || !url || !selectors) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少必要参数'));
    }

    const userId = (req as any).user?.id || 'admin';
    const templateId = await crawlerAssistantService.saveTemplate({
      name,
      description: description || '',
      url,
      selectors,
      department,
      data_type: dataType,
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
 * POST /crawler/validate-selector - 验证CSS选择器
 */
router.post('/crawler/validate-selector', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const { url, selector } = req.body;

    if (!url || !selector) {
      return res.status(400).json(error('VALID_PARAM_MISSING', '缺少必要参数：url 和 selector'));
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return res.status(400).json(error('VALID_PARAM_INVALID', 'URL格式不正确，必须以http://或https://开头'));
    }

    if (typeof selector !== 'string' || selector.trim().length === 0) {
      return res.status(400).json(error('VALID_PARAM_INVALID', '选择器不能为空'));
    }

    const axios = require('axios');
    const cheerio = require('cheerio');

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

export default router;

// ==================== 模板管理 ====================

/**
 * GET /crawler/templates - 获取用户的爬虫模板列表
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
 * GET /crawler/templates/:id - 获取单个模板详情
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
 * PUT /crawler/templates/:id - 更新模板
 */
router.put('/crawler/templates/:id', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'admin';
    const { dataType, ...otherData } = req.body;

    await crawlerAssistantService.updateTemplate(req.params.id, userId, {
      ...otherData,
      data_type: dataType
    });

    res.json(success({ message: '更新成功' }));
  } catch (err: any) {
    if (err.message.includes('不存在')) {
      return res.status(404).json(error('RES_NOT_FOUND', err.message));
    }
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * DELETE /crawler/templates/:id - 删除模板
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

// ==================== 对话历史 ====================

/**
 * GET /crawler-conversations-latest - 获取最新对话
 */
router.get('/crawler-conversations-latest', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'system';
    const { pool } = require('../../../src/admin/core/database');

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

    const [msgRows] = await pool.execute(
      `SELECT id, role, content, created_at 
       FROM crawler_assistant_messages 
       WHERE conversation_id = ? 
       ORDER BY created_at ASC`,
      [conversation.id]
    );

    const messages = (msgRows as any[]).map((msg: any) => {
      let content = msg.content ? JSON.parse(msg.content) : null;
      let type = 'text';

      // If content is wrapped with type (new format)
      if (content && typeof content === 'object' && 'type' in content && 'data' in content) {
        type = content.type;
        content = content.data;
      } else if (msg.role === 'ai' && typeof content === 'object' && content?.selectors) {
        // Fallback inference
        type = 'selectors';
      }

      return {
        id: msg.id,
        role: msg.role,
        type,
        content,
        created_at: msg.created_at
      };
    });

    conversation.messages = messages;

    res.json(success(conversation));
  } catch (err: any) {
    console.error('[Get Latest Conversation] Error:', err);
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * GET /crawler-conversations - 获取对话列表
 */
router.get('/crawler-conversations', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'system';
    const { pool } = require('../../../src/admin/core/database');

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
 * GET /crawler-conversations/:id - 获取对话详情
 */
router.get('/crawler-conversations/:id', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const { pool } = require('../../../src/admin/core/database');

    const [convRows] = await pool.execute(
      'SELECT * FROM crawler_assistant_conversations WHERE id = ?',
      [req.params.id]
    );

    if ((convRows as any[]).length === 0) {
      return res.status(404).json(error('NOT_FOUND', '对话不存在'));
    }

    const conversation = (convRows as any[])[0];

    const [msgRows] = await pool.execute(
      `SELECT id, role, content, created_at 
       FROM crawler_assistant_messages 
       WHERE conversation_id = ? 
       ORDER BY created_at ASC`,
      [req.params.id]
    );

    const messages = (msgRows as any[]).map((msg: any) => {
      let content = msg.content ? JSON.parse(msg.content) : null;
      let type = 'text';

      if (content && typeof content === 'object' && 'type' in content && 'data' in content) {
        type = content.type;
        content = content.data;
      } else if (msg.role === 'ai' && typeof content === 'object' && content?.selectors) {
        type = 'selectors';
      }

      return {
        id: msg.id,
        role: msg.role,
        type,
        content,
        created_at: msg.created_at
      };
    });

    conversation.messages = messages;

    res.json(success(conversation));
  } catch (err: any) {
    console.error('[Get Conversation] Error:', err);
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

/**
 * POST /crawler-conversations - 创建新对话
 */
router.post('/crawler-conversations', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'system';
    const { title = '新对话', messages = [] } = req.body;
    const { v4: uuidv4 } = require('uuid');
    const { pool } = require('../../../src/admin/core/database');

    const id = uuidv4();

    await pool.execute(
      `INSERT INTO crawler_assistant_conversations (id, user_id, title, created_at, updated_at) 
       VALUES (?, ?, ?, NOW(), NOW())`,
      [id, userId, title]
    );

    if (messages.length > 0) {
      for (const msg of messages) {
        const msgId = uuidv4();
        // Wrap content with type
        const contentToSave = {
          type: msg.type || 'text',
          data: msg.content || msg
        };

        await pool.execute(
          `INSERT INTO crawler_assistant_messages (id, conversation_id, role, content, created_at) 
           VALUES (?, ?, ?, ?, NOW())`,
          [
            msgId,
            id,
            msg.role || 'user',
            JSON.stringify(contentToSave)
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
 * PUT /crawler-conversations/:id - 更新对话
 */
router.put('/crawler-conversations/:id', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const { title, messages } = req.body;
    const { pool } = require('../../../src/admin/core/database');
    const { v4: uuidv4 } = require('uuid');

    if (title !== undefined) {
      await pool.execute(
        'UPDATE crawler_assistant_conversations SET title = ? WHERE id = ?',
        [title, req.params.id]
      );
    }

    if (messages !== undefined && Array.isArray(messages)) {
      await pool.execute(
        'DELETE FROM crawler_assistant_messages WHERE conversation_id = ?',
        [req.params.id]
      );

      for (const msg of messages) {
        const msgId = msg.id || uuidv4();
        const contentToSave = {
          type: msg.type || 'text',
          data: msg.content || msg
        };

        await pool.execute(
          `INSERT INTO crawler_assistant_messages (id, conversation_id, role, content) 
           VALUES (?, ?, ?, ?)`,
          [
            msgId,
            req.params.id,
            msg.role || 'user',
            JSON.stringify(contentToSave)
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
 * DELETE /crawler-conversations/:id - 删除对话
 */
router.delete('/crawler-conversations/:id', requirePermission('ai:view'), async (req: Request, res: Response) => {
  try {
    const { pool } = require('../../../src/admin/core/database');

    await pool.execute(
      'DELETE FROM crawler_assistant_messages WHERE conversation_id = ?',
      [req.params.id]
    );

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
