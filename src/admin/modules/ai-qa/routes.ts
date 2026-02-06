/**
 * AI Q&A 模块路由
 * 提供 AI 问答、数据源管理、会话管理等 API
 */

import { Router, Request, Response, NextFunction } from 'express';
import { aiQAService } from './aiQAService';
import { auditMiddleware } from '../../middleware/audit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// 配置 multer 用于 PDF 上传
const ragUploadDir = path.join(process.cwd(), 'uploads', 'rag');
if (!fs.existsSync(ragUploadDir)) {
  fs.mkdirSync(ragUploadDir, { recursive: true });
}

const ragStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ragUploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const ragUpload = multer({
  storage: ragStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.pdf', '.txt', '.md', '.json', '.csv', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', '.bmp', '.gif'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件格式'));
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

// 获取用户 ID 的辅助函数
const getUserId = (req: Request): string => {
  const user = req.user as { id: string } | undefined;
  const userId = user?.id || '';
  if (!userId) {
    console.error('[getUserId] 警告: req.user 存在但 id 为空', { user, hasUser: !!req.user });
  }
  return userId;
};

// 认证检查中间件
const checkAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: '未认证' } });
  }
  // 确保用户 ID 存在
  const userId = (req.user as { id: string })?.id;
  if (!userId) {
    console.error('[checkAuth] 警告: req.user 存在但 id 为空', req.user);
    return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: '用户ID无效' } });
  }
  next();
};

// ==================== 知识库分类管理 ====================

// 获取知识库分类列表
router.get('/categories', checkAuth, async (req: Request, res: Response) => {
  try {
    const categories = await aiQAService.getCategories(getUserId(req));
    res.json({ success: true, data: categories });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// 创建知识库分类
router.post('/categories', checkAuth, async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '请提供分类名称' } });
    }
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: '用户ID无效' } });
    }
    console.log('[POST /categories] 创建分类:', { name, description, userId });
    const category = await aiQAService.createCategory(name, description, userId);
    res.json({ success: true, data: category, message: '分类创建成功' });
  } catch (error: any) {
    console.error('[POST /categories] 错误:', error);
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// 更新知识库分类
router.put('/categories/:id', checkAuth, async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const success = await aiQAService.updateCategory(req.params.id, { name, description }, getUserId(req));
    if (success) {
      res.json({ success: true, message: '更新成功' });
    } else {
      res.status(404).json({ success: false, error: { code: 'RES_NOT_FOUND', message: '分类不存在' } });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// 删除知识库分类
router.delete('/categories/:id', checkAuth, async (req: Request, res: Response) => {
  try {
    const success = await aiQAService.deleteCategory(req.params.id, getUserId(req));
    if (success) {
      res.json({ success: true, message: '删除成功' });
    } else {
      res.status(404).json({ success: false, error: { code: 'RES_NOT_FOUND', message: '分类不存在' } });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// ==================== 数据源管理 ====================

// 获取数据源列表
router.get('/datasources', checkAuth, async (req: Request, res: Response) => {
  try {
    const list = await aiQAService.getUserDataSources(getUserId(req));
    res.json({ success: true, data: list });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// 获取数据源详情
router.get('/datasources/:id', checkAuth, async (req: Request, res: Response) => {
  try {
    const detail = await aiQAService.getDataSourceDetail(req.params.id, getUserId(req));
    if (!detail) {
      return res.status(404).json({ success: false, error: { code: 'RES_NOT_FOUND', message: '数据源不存在' } });
    }
    res.json({ success: true, data: detail });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// 创建数据源
router.post(
  '/datasources',
  checkAuth,
  auditMiddleware({ logReads: false }),
  async (req: Request, res: Response) => {
    try {
      const config = await aiQAService.createDataSource(req.body, getUserId(req));
      res.json({ success: true, data: config, message: '数据源创建成功' });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { code: 'BIZ_ERROR', message: error.message } });
    }
  }
);

// 更新数据源
router.put(
  '/datasources/:id',
  checkAuth,
  auditMiddleware({ logReads: false }),
  async (req: Request, res: Response) => {
    try {
      const config = await aiQAService.updateDataSource(req.params.id, req.body, getUserId(req));
      res.json({ success: true, data: config, message: '数据源更新成功' });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { code: 'BIZ_ERROR', message: error.message } });
    }
  }
);

// 删除数据源
router.delete(
  '/datasources/:id',
  checkAuth,
  auditMiddleware({ logReads: false }),
  async (req: Request, res: Response) => {
    try {
      await aiQAService.deleteDataSource(req.params.id, getUserId(req));
      res.json({ success: true, message: '数据源已删除' });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { code: 'BIZ_ERROR', message: error.message } });
    }
  }
);

// 测试数据源连接（新配置）
router.post('/datasources/test', checkAuth, async (req: Request, res: Response) => {
  try {
    const result = await aiQAService.testDataSourceConnection(req.body, getUserId(req));
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// 测试已有数据源连接
router.get('/datasources/:id/test', checkAuth, async (req: Request, res: Response) => {
  try {
    const result = await aiQAService.testExistingConnection(req.params.id, getUserId(req));
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// ==================== Schema 分析 ====================

// 获取数据源 Schema
router.get('/datasources/:id/schema', checkAuth, async (req: Request, res: Response) => {
  try {
    const schema = await aiQAService.getSchema(req.params.id, getUserId(req));
    res.json({ success: true, data: schema });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// AI 分析 Schema
router.get('/datasources/:id/schema/analyze', checkAuth, async (req: Request, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const analysis = await aiQAService.analyzeSchema(req.params.id, getUserId(req), forceRefresh);
    res.json({ success: true, data: analysis });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// 更新表分析信息
router.put('/datasources/:id/schema/table/:tableName', checkAuth, async (req: Request, res: Response) => {
  try {
    const success = await aiQAService.updateTableAnalysis(
      req.params.id,
      req.params.tableName,
      req.body,
      getUserId(req)
    );
    if (!success) {
      return res.status(404).json({ success: false, error: { code: 'RES_NOT_FOUND', message: '表不存在或未分析' } });
    }
    res.json({ success: true, message: '更新成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// 更新字段分析信息
router.put(
  '/datasources/:id/schema/table/:tableName/column/:columnName',
  checkAuth,
  async (req: Request, res: Response) => {
    try {
      const success = await aiQAService.updateColumnAnalysis(
        req.params.id,
        req.params.tableName,
        req.params.columnName,
        req.body,
        getUserId(req)
      );
      if (!success) {
        return res.status(404).json({ success: false, error: { code: 'RES_NOT_FOUND', message: '字段不存在或未分析' } });
      }
      res.json({ success: true, message: '更新成功' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  }
);

// 更新推荐问题
router.put('/datasources/:id/schema/questions', checkAuth, async (req: Request, res: Response) => {
  try {
    const { questions } = req.body;
    if (!Array.isArray(questions)) {
      return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: 'questions 必须是数组' } });
    }
    const success = await aiQAService.updateSuggestedQuestions(req.params.id, questions, getUserId(req));
    if (!success) {
      return res.status(404).json({ success: false, error: { code: 'RES_NOT_FOUND', message: '数据源未分析' } });
    }
    res.json({ success: true, message: '更新成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// ==================== AI 问答 ====================

// 自然语言问答
router.post('/ask', checkAuth, async (req: Request, res: Response) => {
  try {
    const { datasourceId, question, sessionId } = req.body;
    if (!question) {
      return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '请提供问题' } });
    }
    if (!datasourceId) {
      return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '请选择数据源' } });
    }

    const response = await aiQAService.ask(datasourceId, question, sessionId, getUserId(req));
    res.json({
      success: true,
      data: {
        ...response,
        meta: {
          skillUsed: response.skillUsed,
          toolUsed: response.toolUsed,
          visualization: response.visualization,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// 直接执行 SQL
router.post('/query', checkAuth, async (req: Request, res: Response) => {
  try {
    const { datasourceId, sql } = req.body;
    if (!datasourceId || !sql) {
      return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '请提供数据源和SQL' } });
    }

    const result = await aiQAService.executeQuery(datasourceId, sql, getUserId(req));
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// ==================== 会话管理 ====================

// 获取会话列表
router.get('/chat/sessions/:datasourceId', checkAuth, async (req: Request, res: Response) => {
  try {
    const sessions = await aiQAService.getChatSessions(req.params.datasourceId, getUserId(req));
    res.json({ success: true, data: sessions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// 获取会话详情
router.get('/chat/session/:id', checkAuth, async (req: Request, res: Response) => {
  try {
    const session = await aiQAService.getChatSession(req.params.id, getUserId(req));
    if (!session) {
      return res.status(404).json({ success: false, error: { code: 'RES_NOT_FOUND', message: '会话不存在' } });
    }
    res.json({ success: true, data: session });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// 删除会话
router.delete('/chat/session/:id', checkAuth, async (req: Request, res: Response) => {
  try {
    await aiQAService.deleteChatSession(req.params.id, getUserId(req));
    res.json({ success: true, message: '会话已删除' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// 更新消息配置 (用于持久化图表定制，如翻译)
router.put('/chat/session/:id/message/:msgIdx/config', checkAuth, async (req: Request, res: Response) => {
  try {
    const { id, msgIdx } = req.params;
    const success = await aiQAService.updateChatMessageConfig(id, parseInt(msgIdx), req.body, getUserId(req));
    if (success) {
      res.json({ success: true, message: '配置已更新' });
    } else {
      res.status(404).json({ success: false, error: { code: 'RES_NOT_FOUND', message: '消息不存在' } });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});


// ==================== Agent 技能和工具 ====================

// 获取所有可用技能
router.get('/agent/skills', checkAuth, (_req: Request, res: Response) => {
  const skills = aiQAService.getSkills();
  res.json({ success: true, data: skills });
});

// 执行技能
router.post('/agent/skills/:name/execute', checkAuth, async (req: Request, res: Response) => {
  try {
    const { datasourceId, params } = req.body;
    const result = await aiQAService.executeSkill(req.params.name, datasourceId, params, getUserId(req));
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// 获取所有 MCP 工具
router.get('/agent/mcp/tools', checkAuth, (_req: Request, res: Response) => {
  const tools = aiQAService.getMCPTools();
  res.json({ success: true, data: tools });
});

// 调用 MCP 工具
router.post('/agent/mcp/:server/:tool', checkAuth, async (req: Request, res: Response) => {
  try {
    const result = await aiQAService.callMCPTool(req.params.server, req.params.tool, req.body);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// 获取 Agent 能力概览
router.get('/agent/capabilities', checkAuth, (_req: Request, res: Response) => {
  const capabilities = aiQAService.getCapabilities();
  res.json({ success: true, data: capabilities });
});

// ==================== 自动分析 ====================

// 自动分析
router.post('/agent/analyze', checkAuth, async (req: Request, res: Response) => {
  try {
    const { datasourceId, topic } = req.body;
    if (!topic) {
      return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '请提供分析主题' } });
    }

    const report = await aiQAService.autoAnalyze(datasourceId, topic, getUserId(req));
    res.json({ success: true, data: report });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// 自动分析（SSE 流式输出）
router.get('/agent/analyze/stream', checkAuth, async (req: Request, res: Response) => {
  const { datasourceId, topic } = req.query;

  if (!topic || typeof topic !== 'string') {
    return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '请提供分析主题' } });
  }

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const report = await aiQAService.autoAnalyze(
      datasourceId as string,
      topic,
      getUserId(req),
      (step: any) => {
        res.write(`data: ${JSON.stringify({ type: 'step', data: step })}\n\n`);
      }
    );

    res.write(`data: ${JSON.stringify({ type: 'complete', data: report })}\n\n`);
    res.end();
  } catch (error: any) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

// 生成大屏
router.post('/agent/dashboard', checkAuth, async (req: Request, res: Response) => {
  try {
    const { datasourceId, topic, theme = 'dark' } = req.body;
    if (!topic) {
      return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '请提供大屏主题' } });
    }

    const result = await aiQAService.generateDashboard(datasourceId, topic, theme, getUserId(req));
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// 大屏预览页面
router.get('/agent/dashboard/preview', checkAuth, async (req: Request, res: Response) => {
  const { datasourceId, topic, theme = 'dark' } = req.query;

  if (!topic || typeof topic !== 'string') {
    return res.status(400).send('请提供大屏主题');
  }

  try {
    const result = await aiQAService.generateDashboard(
      datasourceId as string,
      topic,
      (theme as 'light' | 'dark' | 'tech') || 'dark',
      getUserId(req)
    );
    res.setHeader('Content-Type', 'text/html');
    res.send(result.previewHtml);
  } catch (error: any) {
    res.status(500).send(`生成失败: ${error.message}`);
  }
});

// 数据质量检测
router.post('/agent/quality', checkAuth, async (req: Request, res: Response) => {
  try {
    const { datasourceId, tableNameCn } = req.body;
    const result = await aiQAService.inspectQuality(datasourceId, getUserId(req), tableNameCn);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// ==================== RAG 知识库 ====================

// 获取知识库统计
router.get('/rag/stats', checkAuth, async (req: Request, res: Response) => {
  const stats = await aiQAService.getRAGStats(getUserId(req));
  res.json({ success: true, data: stats });
});

// 全文检索
router.get('/rag/search', checkAuth, async (req: Request, res: Response) => {
  try {
    const { q, limit } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '请提供搜索关键词' } });
    }

    const results = await aiQAService.searchKnowledgeBase(q, getUserId(req), limit ? parseInt(limit as string) : 20);
    res.json({ success: true, data: results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// 获取知识库文档列表
// 获取知识库文档列表 (分页)
router.get('/rag/documents', checkAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const categoryId = req.query.categoryId as string;
    const keyword = req.query.keyword as string;

    const result = await aiQAService.getRAGDocuments(getUserId(req), page, pageSize, categoryId, keyword);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// 获取单个文档详情
router.get('/rag/documents/:id', checkAuth, async (req: Request, res: Response) => {
  try {
    const doc = await aiQAService.getRAGDocument(getUserId(req), req.params.id);
    res.json({ success: true, data: doc });
  } catch (error: any) {
    res.status(404).json({ success: false, error: { message: error.message } });
  }
});

// 添加文档到知识库
router.post('/rag/documents', checkAuth, async (req: Request, res: Response) => {
  try {
    const { title, content, type = 'note', tags, categoryId, datasourceId } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '请提供标题和内容' } });
    }

    const doc = await aiQAService.addRAGDocument(title, content, type, getUserId(req), tags, categoryId, datasourceId);
    res.json({
      success: true,
      data: {
        id: doc.id,
        title: doc.title,
        chunksCount: doc.chunks?.length || 0,
      },
      message: '文档已添加到知识库',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// 删除知识库文档
router.delete('/rag/documents/:id', checkAuth, async (req: Request, res: Response) => {
  try {
    const success = await aiQAService.deleteRAGDocument(req.params.id, getUserId(req));
    if (success) {
      res.json({ success: true, message: '文档已删除' });
    } else {
      res.status(404).json({ success: false, error: { code: 'RES_NOT_FOUND', message: '文档不存在' } });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// 上传文件到知识库（支持 PDF + OCR）
router.post('/rag/upload', checkAuth, ragUpload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: '用户ID无效' } });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '请上传文件' } });
    }

    console.log('[POST /rag/upload] 开始上传文件:', {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      userId,
      categoryId: req.body.categoryId
    });

    const { title, type = 'text', categoryId, datasourceId } = req.body;
    const tags = req.body.tags ? JSON.parse(req.body.tags) : [];
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    // 立即检查上传的文件大小
    const stats = fs.statSync(filePath);
    console.log('[POST /rag/upload] 文件系统中的文件大小:', stats.size, 'bytes');

    if (stats.size === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        error: { code: 'EMPTY_FILE', message: '上传的文件为空，请检查文件是否有效并重新上传' }
      });
    }

    let content = '';
    let ocrUsed = false;

    if (ext === '.pdf') {
      // 解析 PDF
      try {
        // 检查文件大小
        const stats = fs.statSync(filePath);
        if (stats.size === 0) {
          fs.unlinkSync(filePath);
          return res.status(400).json({
            success: false,
            error: { code: 'EMPTY_FILE', message: 'PDF 文件为空，请检查文件是否损坏或重新上传' }
          });
        }

        console.log('[POST /rag/upload] 开始解析 PDF:', filePath, '文件大小:', stats.size, 'bytes');

        // 使用动态导入 pdf-parse（ESM 模块）
        const { PDFParse } = await import('pdf-parse');

        const dataBuffer = fs.readFileSync(filePath);

        // 创建 PDFParse 实例并解析
        const parser = new PDFParse({ data: dataBuffer });
        const textResult = await parser.getText();
        content = textResult.text || '';

        console.log('[POST /rag/upload] PDF 解析成功，文本长度:', content.length);
      } catch (e: any) {
        fs.unlinkSync(filePath);
        console.error('[POST /rag/upload] PDF 解析失败:', e);
        console.error('[POST /rag/upload] 错误堆栈:', e.stack);
        // 提供更详细的错误信息
        let errorMsg = e.message || '未知错误';
        if (e.message?.includes('empty') || e.message?.includes('zero bytes')) {
          errorMsg = 'PDF 文件为空或损坏，请重新上传';
        } else if (e.code === 'MODULE_NOT_FOUND') {
          errorMsg = 'pdf-parse 模块未安装，请运行: npm install pdf-parse';
        } else if (e.message?.includes('InvalidPDFException')) {
          errorMsg = 'PDF 文件格式无效或已损坏';
        }
        return res.status(500).json({
          success: false,
          error: { code: 'PDF_PARSE_ERROR', message: `PDF 解析失败: ${errorMsg}` }
        });
      }

      // 如果 PDF 文本内容很少，可能是扫描件，尝试 OCR
      if (content.trim().length < 100) {
        try {
          const { ocrService } = require('../../../services/ocrService');
          const isOcrAvailable = await ocrService.isAvailable();

          if (isOcrAvailable) {
            console.log('PDF 文本内容较少，尝试 OCR 识别...');
            ocrUsed = true;
          }
        } catch (e) {
          console.log('OCR 服务不可用，使用原始文本');
        }
      }
    } else if (['.png', '.jpg', '.jpeg', '.bmp', '.gif'].includes(ext)) {
      // 图片文件，使用 OCR
      try {
        const { ocrService } = require('../../../services/ocrService');
        const isOcrAvailable = await ocrService.isAvailable();

        if (isOcrAvailable) {
          const result = await ocrService.recognizeFile(filePath);
          if (result.success) {
            content = result.text;
            ocrUsed = true;
          } else {
            fs.unlinkSync(filePath);
            return res.status(400).json({ success: false, error: { code: 'OCR_ERROR', message: result.error } });
          }
        } else {
          fs.unlinkSync(filePath);
          return res.status(400).json({ success: false, error: { code: 'OCR_UNAVAILABLE', message: 'OCR 服务不可用，无法识别图片' } });
        }
      } catch (e: any) {
        fs.unlinkSync(filePath);
        return res.status(500).json({ success: false, error: { code: 'OCR_ERROR', message: e.message } });
      }
    } else {
      // 读取文本文件
      content = fs.readFileSync(filePath, 'utf-8');
    }

    // 删除临时文件
    fs.unlinkSync(filePath);

    if (!content.trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '文件内容为空' } });
    }

    const docTitle = title || req.file.originalname.replace(/\.[^/.]+$/, '');
    console.log('[POST /rag/upload] 准备添加到知识库:', { docTitle, contentLength: content.length, userId });
    const doc = await aiQAService.addRAGDocument(docTitle, content, type, userId, tags, categoryId, datasourceId);

    console.log('[POST /rag/upload] 文档添加成功:', { docId: doc.id, chunksCount: doc.chunks?.length || 0 });
    res.json({
      success: true,
      data: {
        id: doc.id,
        title: doc.title,
        chunksCount: doc.chunks?.length || 0,
        contentLength: content.length,
        ocrUsed,
      },
      message: '文档已添加到知识库',
    });
  } catch (error: any) {
    // 确保在出错时也删除临时文件
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        // 忽略删除失败的错误
      }
    }
    console.error('[POST /rag/upload] 上传文件失败:', error);
    console.error('[POST /rag/upload] 错误堆栈:', error.stack);
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// RAG 问答
router.post('/rag/ask', checkAuth, async (req: Request, res: Response) => {
  try {
    const { question, datasourceId, categoryId, documentId } = req.body;
    if (!question) {
      return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '请提供问题' } });
    }

    const result = await aiQAService.ragAsk(question, getUserId(req), datasourceId, categoryId, documentId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

// 生成大纲
router.post('/rag/outline', checkAuth, async (req: Request, res: Response) => {
  try {
    const { topic, categoryId } = req.body;
    if (!topic) {
      return res.status(400).json({ success: false, error: { message: '主题不能为空' } });
    }
    const outline = await aiQAService.generateOutline(getUserId(req), topic, categoryId);
    res.json({ success: true, data: outline });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// 生成章节内容
router.post('/rag/section', checkAuth, async (req: Request, res: Response) => {
  try {
    const { topic, sectionTitle, sectionDesc, categoryId } = req.body;
    if (!topic || !sectionTitle) {
      return res.status(400).json({ success: false, error: { message: '参数不完整' } });
    }
    const content = await aiQAService.generateSection(getUserId(req), topic, sectionTitle, sectionDesc, categoryId);
    res.json({ success: true, data: content });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// 提交长文生成任务 (异步)
router.post('/rag/tasks/submit', checkAuth, async (req: Request, res: Response) => {
  try {
    const { topic, outline, categoryId } = req.body;
    if (!topic || !outline) {
      return res.status(400).json({ success: false, error: { message: '参数不完整' } });
    }
    const taskId = await aiQAService.submitArticleTask(getUserId(req), topic, outline, categoryId);
    res.json({ success: true, data: { taskId } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// 查询任务状态
router.get('/rag/tasks/:id', checkAuth, (req: Request, res: Response) => {
  const task = aiQAService.getArticleTask(req.params.id);
  if (!task) {
    return res.status(404).json({ success: false, error: { message: '任务不存在' } });
  }
  // 简单权限校验
  if (task.userId !== getUserId(req)) {
    return res.status(403).json({ success: false, error: { message: '无权访问此任务' } });
  }
  res.json({ success: true, data: task });
});

// 获取知识图谱数据
router.get('/rag/graph', checkAuth, (req: Request, res: Response) => {
  const graph = aiQAService.getKnowledgeGraph(getUserId(req));
  res.json({ success: true, data: graph });
});

// 图谱子图查询
router.post('/rag/graph/query', checkAuth, (req: Request, res: Response) => {
  const { keywords, maxEntities = 20 } = req.body;
  if (!keywords || !Array.isArray(keywords)) {
    return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '请提供关键词数组' } });
  }

  const result = aiQAService.querySubgraph(keywords, getUserId(req), maxEntities);
  res.json({ success: true, data: result });
});

// 将数据源 Schema 分析导入知识库
router.post('/rag/import-schema', checkAuth, async (req: Request, res: Response) => {
  try {
    const { datasourceId } = req.body;
    if (!datasourceId) {
      return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '请提供数据源ID' } });
    }

    const result = await aiQAService.importSchemaToRAG(datasourceId, getUserId(req));
    res.json({
      success: true,
      data: result,
      message: `已将数据源 Schema 导入知识库，生成 ${result.chunksCount} 个知识块`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
  }
});

export default router;
