/**
 * AI Q&A 模块路由
 */

import { Router, Request, Response, NextFunction } from 'express';
import { AIQAService } from './service';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requirePermission } from '../../../src/admin/middleware/permission';
import { success, error } from '../../../src/admin/utils/response';

const router = Router();

// 配置 multer 用于文件上传
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
  limits: { fileSize: 20 * 1024 * 1024 }
});

// 获取用户 ID
const getUserId = (req: Request): string => {
  const user = req.user as { id: string } | undefined;
  return user?.id || '';
};

export function createRoutes(service: AIQAService): Router {
  // ==================== 知识库分类管理 ====================

  router.get('/categories', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const categories = await service.getCategories(getUserId(req));
      res.json({ success: true, data: categories });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  router.post('/categories', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const { name, description } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '请提供分类名称' } });
      }
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: '用户ID无效' } });
      }
      const category = await service.createCategory(name, description, userId);
      res.json({ success: true, data: category, message: '分类创建成功' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  router.put('/categories/:id', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const { name, description } = req.body;
      const success = await service.updateCategory(req.params.id, { name, description }, getUserId(req));
      if (success) {
        res.json({ success: true, message: '更新成功' });
      } else {
        res.status(404).json({ success: false, error: { code: 'RES_NOT_FOUND', message: '分类不存在' } });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  router.delete('/categories/:id', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const success = await service.deleteCategory(req.params.id, getUserId(req));
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

  router.get('/datasources', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const list = await service.getUserDataSources(getUserId(req));
      res.json(success(list));
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  router.get('/datasources/:id', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const detail = await service.getDataSourceDetail(req.params.id, getUserId(req));
      if (!detail) {
        return res.status(404).json({ success: false, error: { code: 'RES_NOT_FOUND', message: '数据源不存在' } });
      }
      res.json({ success: true, data: detail });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  router.post('/datasources', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const config = await service.createDataSource(req.body, getUserId(req));
      res.json({ success: true, data: config, message: '数据源创建成功' });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { code: 'BIZ_ERROR', message: error.message } });
    }
  });

  router.put('/datasources/:id', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const config = await service.updateDataSource(req.params.id, req.body, getUserId(req));
      res.json({ success: true, data: config, message: '数据源更新成功' });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { code: 'BIZ_ERROR', message: error.message } });
    }
  });

  router.delete('/datasources/:id', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      await service.deleteDataSource(req.params.id, getUserId(req));
      res.json({ success: true, message: '数据源已删除' });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { code: 'BIZ_ERROR', message: error.message } });
    }
  });

  router.post('/datasources/test', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const result = await service.testDataSourceConnection(req.body, getUserId(req));
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  router.get('/datasources/:id/test', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const result = await service.testExistingConnection(req.params.id, getUserId(req));
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  // ==================== Schema 分析 ====================

  router.get('/datasources/:id/schema', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const schema = await service.getSchema(req.params.id, getUserId(req));
      res.json({ success: true, data: schema });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  router.get('/datasources/:id/schema/analyze', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const analysis = await service.analyzeSchema(req.params.id, getUserId(req), forceRefresh);
      res.json({ success: true, data: analysis });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  router.put('/datasources/:id/schema/table/:tableName', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const success = await service.updateTableAnalysis(req.params.id, req.params.tableName, req.body, getUserId(req));
      if (!success) {
        return res.status(404).json({ success: false, error: { code: 'RES_NOT_FOUND', message: '表不存在或未分析' } });
      }
      res.json({ success: true, message: '更新成功' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  router.put('/datasources/:id/schema/table/:tableName/column/:columnName', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const success = await service.updateColumnAnalysis(req.params.id, req.params.tableName, req.params.columnName, req.body, getUserId(req));
      if (!success) {
        return res.status(404).json({ success: false, error: { code: 'RES_NOT_FOUND', message: '字段不存在或未分析' } });
      }
      res.json({ success: true, message: '更新成功' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  router.put('/datasources/:id/schema/questions', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const { questions } = req.body;
      if (!Array.isArray(questions)) {
        return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: 'questions 必须是数组' } });
      }
      const success = await service.updateSuggestedQuestions(req.params.id, questions, getUserId(req));
      if (!success) {
        return res.status(404).json({ success: false, error: { code: 'RES_NOT_FOUND', message: '数据源未分析' } });
      }
      res.json({ success: true, message: '更新成功' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  // ==================== AI 问答 ====================

  router.post('/ask', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const { datasourceId, question, sessionId } = req.body;
      if (!question) {
        return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '请提供问题' } });
      }
      if (!datasourceId) {
        return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '请选择数据源' } });
      }
      const response = await service.ask(datasourceId, question, sessionId, getUserId(req));
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

  router.post('/query', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const { datasourceId, sql } = req.body;
      if (!datasourceId || !sql) {
        return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '请提供数据源和SQL' } });
      }
      const result = await service.executeQuery(datasourceId, sql, getUserId(req));
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  // ==================== 会话管理 ====================

  router.get('/chat/sessions/:datasourceId', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const sessions = await service.getChatSessions(req.params.datasourceId, getUserId(req));
      res.json({ success: true, data: sessions });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  router.get('/chat/session/:id', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const session = await service.getChatSession(req.params.id, getUserId(req));
      if (!session) {
        return res.status(404).json({ success: false, error: { code: 'RES_NOT_FOUND', message: '会话不存在' } });
      }
      res.json({ success: true, data: session });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  router.delete('/chat/session/:id', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      await service.deleteChatSession(req.params.id, getUserId(req));
      res.json({ success: true, message: '会话已删除' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  router.get('/chat/session/:sessionId/message/:messageIndex/config', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const { sessionId, messageIndex } = req.params;
      const idx = parseInt(messageIndex);
      if (isNaN(idx)) {
        return res.status(400).json({ success: false, error: { message: '无效的消息索引' } });
      }

      const session = await service.getChatSession(sessionId, getUserId(req));
      if (!session) {
        return res.status(404).json({ success: false, error: { message: '会话不存在' } });
      }

      const message = session.messages[idx];
      if (!message) {
        return res.status(404).json({ success: false, error: { message: '消息不存在' } });
      }

      res.json({ success: true, data: message.chartConfig || {} });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  // ==================== 消息配置 ====================

  router.get('/chat/session/:sessionId/message/:messageIndex/config', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const { sessionId, messageIndex } = req.params;
      const idx = parseInt(messageIndex, 10);
      if (isNaN(idx)) {
        return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '无效的消息索引' } });
      }

      const session = await service.getChatSession(sessionId, getUserId(req));
      if (!session) {
        return res.status(404).json({ success: false, error: { code: 'RES_NOT_FOUND', message: '会话不存在' } });
      }

      const message = session.messages[idx];
      if (!message) {
        return res.status(404).json({ success: false, error: { code: 'RES_NOT_FOUND', message: '消息不存在' } });
      }

      res.json({ success: true, data: message.chartConfig || {} });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  // ==================== Agent 技能和工具 ====================

  router.get('/agent/skills', requirePermission('ai:query'), (_req: Request, res: Response) => {
    const skills = service.getSkills();
    res.json({ success: true, data: skills });
  });

  router.post('/agent/skills/:name/execute', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const { datasourceId, params } = req.body;
      const result = await service.executeSkill(req.params.name, datasourceId, params, getUserId(req));
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  router.get('/agent/mcp/tools', requirePermission('ai:query'), (_req: Request, res: Response) => {
    const tools = service.getMCPTools();
    res.json({ success: true, data: tools });
  });

  router.post('/agent/mcp/:server/:tool', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const result = await service.callMCPTool(req.params.server, req.params.tool, req.body);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  router.get('/agent/capabilities', requirePermission('ai:query'), (_req: Request, res: Response) => {
    const capabilities = service.getCapabilities();
    res.json({ success: true, data: capabilities });
  });

  // ==================== 自动分析 ====================

  router.post('/agent/analyze', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const { datasourceId, topic } = req.body;
      if (!topic) {
        return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '请提供分析主题' } });
      }
      const report = await service.autoAnalyze(datasourceId, topic, getUserId(req));
      res.json({ success: true, data: report });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  router.get('/agent/analyze/stream', requirePermission('ai:query'), async (req: Request, res: Response) => {
    const { datasourceId, topic } = req.query;
    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '请提供分析主题' } });
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    try {
      const report = await service.autoAnalyze(datasourceId as string, topic, getUserId(req), (step: any) => {
        res.write(`data: ${JSON.stringify({ type: 'step', data: step })}\n\n`);
      });
      res.write(`data: ${JSON.stringify({ type: 'complete', data: report })}\n\n`);
      res.end();
    } catch (error: any) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  });

  router.post('/agent/dashboard', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const { datasourceId, topic, theme = 'dark' } = req.body;
      if (!topic) {
        return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '请提供大屏主题' } });
      }
      const result = await service.generateDashboard(datasourceId, topic, theme, getUserId(req));
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  router.get('/agent/dashboard/preview', requirePermission('ai:query'), async (req: Request, res: Response) => {
    const { datasourceId, topic, theme = 'dark' } = req.query;
    if (!topic || typeof topic !== 'string') {
      return res.status(400).send('请提供大屏主题');
    }
    try {
      const result = await service.generateDashboard(datasourceId as string, topic, (theme as 'light' | 'dark' | 'tech') || 'dark', getUserId(req));
      res.setHeader('Content-Type', 'text/html');
      res.send(result.previewHtml);
    } catch (error: any) {
      res.status(500).send(`生成失败: ${error.message}`);
    }
  });

  router.post('/agent/quality', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const { datasourceId, tableNameCn } = req.body;
      const result = await service.inspectQuality(datasourceId, getUserId(req), tableNameCn);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  // ==================== RAG 知识库 ====================

  router.get('/rag/stats', requirePermission('ai:query'), async (req: Request, res: Response) => {
    const stats = await service.getRAGStats(getUserId(req));
    res.json({ success: true, data: stats });
  });

  router.get('/rag/search', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const { q, limit } = req.query;
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '请提供搜索关键词' } });
      }
      const results = await service.searchKnowledgeBase(q, getUserId(req), limit ? parseInt(limit as string) : 20);
      res.json({ success: true, data: results });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  router.get('/rag/documents', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      const categoryId = req.query.categoryId as string;
      const keyword = req.query.keyword as string;
      const result = await service.getRAGDocuments(getUserId(req), page, pageSize, categoryId, keyword);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  router.get('/rag/documents/:id', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const doc = await service.getRAGDocument(getUserId(req), req.params.id);
      res.json({ success: true, data: doc });
    } catch (error: any) {
      res.status(404).json({ success: false, error: { message: error.message } });
    }
  });

  router.post('/rag/documents', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const { title, content, type = 'note', tags, categoryId, datasourceId } = req.body;
      if (!title || !content) {
        return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '请提供标题和内容' } });
      }
      const doc = await service.addRAGDocument(title, content, type, getUserId(req), tags, categoryId, datasourceId);
      res.json({
        success: true,
        data: {
          id: doc.id,
          title: doc.title,
          chunksCount: doc.chunks || 0,
        },
        message: '文档已添加到知识库',
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  router.delete('/rag/documents/:id', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const success = await service.deleteRAGDocument(req.params.id, getUserId(req));
      if (success) {
        res.json({ success: true, message: '文档已删除' });
      } else {
        res.status(404).json({ success: false, error: { code: 'RES_NOT_FOUND', message: '文档不存在' } });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  router.post('/rag/upload', requirePermission('ai:query'), ragUpload.single('file'), async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ success: false, error: { code: 'AUTH_REQUIRED', message: '用户ID无效' } });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '请上传文件' } });
      }
      const { title, type = 'text', categoryId, datasourceId } = req.body;
      const tags = req.body.tags ? JSON.parse(req.body.tags) : [];
      const filePath = req.file.path;
      const ext = path.extname(req.file.originalname).toLowerCase();
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        fs.unlinkSync(filePath);
        return res.status(400).json({
          success: false,
          error: { code: 'EMPTY_FILE', message: '上传的文件为空，请检查文件是否有效并重新上传' }
        });
      }
      let content = '';
      if (ext === '.pdf') {
        const { PDFParse } = await import('pdf-parse');
        const dataBuffer = fs.readFileSync(filePath);
        const parser = new PDFParse({ data: dataBuffer });
        const textResult = await parser.getText();
        content = textResult.text || '';
      } else {
        content = fs.readFileSync(filePath, 'utf-8');
      }
      fs.unlinkSync(filePath);
      if (!content.trim()) {
        return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '文件内容为空' } });
      }
      const docTitle = title || req.file.originalname.replace(/\.[^/.]+$/, '');
      const doc = await service.addRAGDocument(docTitle, content, type, userId, tags, categoryId, datasourceId);
      res.json({
        success: true,
        data: {
          id: doc.id,
          title: doc.title,
          chunksCount: doc.chunks || 0,
          contentLength: content.length,
        },
        message: '文档已添加到知识库',
      });
    } catch (error: any) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          // ignore
        }
      }
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  router.post('/rag/ask', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const { question, datasourceId, categoryId, documentId } = req.body;
      if (!question) {
        return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '请提供问题' } });
      }
      const result = await service.ragAsk(question, getUserId(req), datasourceId, categoryId, documentId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  router.post('/rag/outline', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const { topic, categoryId } = req.body;
      if (!topic) {
        return res.status(400).json({ success: false, error: { message: '主题不能为空' } });
      }
      const outline = await service.generateOutline(getUserId(req), topic, categoryId);
      res.json({ success: true, data: outline });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  router.post('/rag/section', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const { topic, sectionTitle, sectionDesc, categoryId } = req.body;
      if (!topic || !sectionTitle) {
        return res.status(400).json({ success: false, error: { message: '参数不完整' } });
      }
      const content = await service.generateSection(getUserId(req), topic, sectionTitle, sectionDesc, categoryId);
      res.json({ success: true, data: content });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  router.post('/rag/tasks/submit', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const { topic, outline, categoryId } = req.body;
      if (!topic || !outline) {
        return res.status(400).json({ success: false, error: { message: '参数不完整' } });
      }
      const taskId = await service.submitArticleTask(getUserId(req), topic, outline, categoryId);
      res.json({ success: true, data: { taskId } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  router.get('/rag/tasks/:id', requirePermission('ai:query'), (req: Request, res: Response) => {
    const task = service.getArticleTask(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: { message: '任务不存在' } });
    }
    if (task.userId !== getUserId(req)) {
      return res.status(403).json({ success: false, error: { message: '无权访问此任务' } });
    }
    res.json({ success: true, data: task });
  });

  router.get('/rag/graph', requirePermission('ai:query'), async (req: Request, res: Response) => {
    const graph = await service.getKnowledgeGraph(getUserId(req));
    res.json({ success: true, data: graph });
  });

  router.post('/rag/graph/query', requirePermission('ai:query'), async (req: Request, res: Response) => {
    const { keywords, maxEntities = 20 } = req.body;
    if (!keywords || !Array.isArray(keywords)) {
      return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '请提供关键词数组' } });
    }
    const result = await service.querySubgraph(keywords, getUserId(req), maxEntities);
    res.json({ success: true, data: result });
  });

  router.post('/rag/import-schema', requirePermission('ai:query'), async (req: Request, res: Response) => {
    try {
      const { datasourceId } = req.body;
      if (!datasourceId) {
        return res.status(400).json({ success: false, error: { code: 'VALID_ERROR', message: '请提供数据源ID' } });
      }
      const result = await service.importSchemaToRAG(datasourceId, getUserId(req));
      res.json({
        success: true,
        data: result,
        message: `已将数据源 Schema 导入知识库，生成 ${result.chunksCount} 个知识块`
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { code: 'SYS_ERROR', message: error.message } });
    }
  });

  return router;
}
