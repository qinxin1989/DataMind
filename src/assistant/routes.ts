import { Router } from 'express';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { AIAgent } from '../agent';
import { runAgentLoop, type AgentSSEEvent } from '../agent/agentLoop';
import {
  AssistantWorkbenchService,
  type AssistantArtifact,
  type AssistantChatMode,
  type AssistantSessionMessage,
  type AssistantSessionRecord,
  type AssistantSessionSummary,
} from './service';

const WORKBENCH_SYSTEM_PROMPT = [
  '你是 DataMind 的统一智能助手工作台。',
  '你的工作方式要尽量贴近一个能直接处理文件、执行技能、产出结果的桌面助手，而不是业务模式选择器。',
  '优先直接完成任务；如果已经有附件、文件路径、网址或上下文，就继续执行，不要只停留在口头建议。',
  '不要再把自己拆成“通用/数据/采集/知识/文档”五种业务模式，也不要主动向用户推销这些模式。',
  '当前入口只保留 standard / fast / plan 三种执行模式。',
  '没有数据源上下文时，不要假装自己能直接查询数据库；涉及数据库分析时，明确提示用户去旧版 AI 智能问答页绑定数据源。',
].join('\n');

interface CreateAssistantRouterOptions {
  service: AssistantWorkbenchService;
  aiAgent: AIAgent;
  assistantUploadDir: string;
  workDir: string;
}

export function createAssistantRouter(options: CreateAssistantRouterOptions) {
  const router = Router();

  if (!fs.existsSync(options.assistantUploadDir)) {
    fs.mkdirSync(options.assistantUploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (_req, _file, callback) => {
      callback(null, options.assistantUploadDir);
    },
    filename: (_req, file, callback) => {
      const ext = path.extname(file.originalname || '');
      callback(null, `${uuidv4()}${ext}`);
    },
  });

  const assistantUpload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 },
  });

  router.get('/meta', (_req, res) => {
    res.json({
      success: true,
      data: {
        title: '智能助手工作台',
        description: '单一助手入口，保留 standard / fast / plan 三种执行模式。',
        modes: [
          { id: 'standard', title: '标准模式' },
          { id: 'fast', title: 'Fast 快速模式' },
          { id: 'plan', title: 'Plan 规划模式' },
        ],
      },
    });
  });

  router.get('/sessions', async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }

    const sessions = await options.service.listSessions(req.user.id);
    res.json({ success: true, data: sessions });
  });

  router.post('/sessions', async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }

    const name = typeof req.body?.name === 'string' ? req.body.name : undefined;
    const session = await options.service.createSession(req.user.id, name);
    res.json({ success: true, data: session });
  });

  router.put('/sessions/:id', async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }

    const name = typeof req.body?.name === 'string' ? req.body.name : '';
    if (!name.trim()) {
      return res.status(400).json({ error: '请提供会话名称' });
    }

    await options.service.renameSession(req.params.id, req.user.id, name);
    const session = await options.service.getSession(req.params.id, req.user.id);
    res.json({ success: true, data: session });
  });

  router.delete('/sessions/:id', async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }

    await options.service.deleteSession(req.params.id, req.user.id);
    res.json({ success: true });
  });

  router.post('/sessions/:id/switch', async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }

    const session = await options.service.getSession(req.params.id, req.user.id);
    if (!session) {
      return res.status(404).json({ error: '会话不存在' });
    }

    res.json({
      success: true,
      data: {
        session,
        context: options.service.buildContextPayload(session),
      },
    });
  });

  router.get('/sessions/:id/context', async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }

    const session = await options.service.getSession(req.params.id, req.user.id);
    if (!session) {
      return res.status(404).json({ error: '会话不存在' });
    }

    res.json({
      success: true,
      data: options.service.buildContextPayload(session),
    });
  });

  router.get('/sessions/:id/messages', async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }

    const session = await options.service.getSession(req.params.id, req.user.id);
    if (!session) {
      return res.status(404).json({ error: '会话不存在' });
    }

    res.json({
      success: true,
      data: {
        session: {
          id: session.id,
          name: session.name,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        },
        messages: session.messages,
      },
    });
  });

  router.delete('/sessions/:id/messages', async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }

    const startIndex = Number(req.body?.start_index ?? req.body?.startIndex);
    const endIndex = Number(req.body?.end_index ?? req.body?.endIndex);

    if (!Number.isFinite(startIndex) || !Number.isFinite(endIndex)) {
      return res.status(400).json({ error: '请提供有效的消息区间' });
    }

    const session = await options.service.deleteMessages(
      req.params.id,
      req.user.id,
      startIndex,
      endIndex
    );

    res.json({
      success: true,
      data: {
        session: {
          id: session.id,
          name: session.name,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        },
        messages: session.messages,
      },
    });
  });

  router.post('/sessions/:id/summarize', async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }

    const session = await options.service.getSession(req.params.id, req.user.id);
    if (!session) {
      return res.status(404).json({ error: '会话不存在' });
    }

    const maxMessages = normalizeMaxMessages(req.body?.max_messages ?? req.body?.maxMessages);
    const summary = await buildSessionSummary(session, options.aiAgent, maxMessages);

    await options.service.updateSession(session.id, req.user.id, { summary });

    res.json({
      success: true,
      data: summary,
    });
  });

  router.post('/upload', assistantUpload.array('file', 10), async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }

    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) {
      return res.status(400).json({ error: '请选择文件' });
    }

    const artifacts = files.map((file) => {
      const originalName = Buffer.from(file.originalname || '', 'latin1').toString('utf8') || file.originalname;
      return {
        id: uuidv4(),
        path: file.path,
        name: originalName,
        type: detectArtifactType(file.path),
        direction: 'input',
        mimeType: file.mimetype,
        size: file.size,
        createdAt: Date.now(),
      } satisfies AssistantArtifact;
    });

    res.json({
      success: true,
      data: artifacts,
    });
  });

  router.get('/artifact', async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }

    const requestedPath = typeof req.query.path === 'string' ? req.query.path : '';
    const resolvedPath = resolveAllowedArtifactPath(requestedPath, options.workDir, options.assistantUploadDir);
    if (!resolvedPath) {
      return res.status(404).json({ error: '文件不存在或不允许访问' });
    }

    if (String(req.query.download || '') === '1') {
      return res.download(resolvedPath, path.basename(resolvedPath));
    }

    res.sendFile(resolvedPath);
  });

  router.post('/chat', async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' });
    }

    const rawMessage = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!rawMessage) {
      return res.status(400).json({ error: '请提供 message' });
    }

    const requestedSessionId = typeof req.body?.session_id === 'string'
      ? req.body.session_id
      : typeof req.body?.sessionId === 'string'
        ? req.body.sessionId
        : '';
    const mode = normalizeChatMode(req.body?.mode);
    const inputArtifacts = normalizeRequestedArtifacts(
      Array.isArray(req.body?.files) ? req.body.files : [],
      options.service,
      options.workDir,
      options.assistantUploadDir
    );

    let session = requestedSessionId
      ? await options.service.getSession(requestedSessionId, req.user.id)
      : null;

    if (!session) {
      session = await options.service.createSession(
        req.user.id,
        options.service.suggestSessionName(rawMessage)
      );
    }

    const historyContext = options.service.buildChatHistory(session);
    const composedUserMessage = options.service.composeUserMessage(rawMessage, inputArtifacts);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    let doneEmitted = false;
    const sendSSE = (event: AgentSSEEvent) => {
      if (event.type === 'done') {
        doneEmitted = true;
      }
      try {
        res.write(`data: ${JSON.stringify({ ...event, sessionId: session!.id })}\n\n`);
      } catch {
        // 客户端可能已断开
      }
    };

    try {
      const { openai, model } = await options.aiAgent.getOpenAIInstance();
      const result = await runAgentLoop({
        userMessage: composedUserMessage,
        history: historyContext.history,
        openai,
        model,
        config: { mode: mode === 'standard' ? undefined : mode },
        workDir: options.workDir,
        userId: req.user.id,
        sessionId: session.id,
        sessionContext: historyContext.sessionContext,
        recentArtifacts: historyContext.recentArtifacts,
        extraSystemPrompt: WORKBENCH_SYSTEM_PROMPT,
        toolPolicy: { allowSql: false },
        onEvent: sendSSE,
      });

      const outputArtifacts = options.service.collectOutputArtifacts(
        result.messages.filter((message) => message.role !== 'system').slice(historyContext.history.length)
      );

      const mergedMessages = options.service.mergeSessionMessages({
        previousMessages: session.messages,
        resultMessages: result.messages,
        historyStartIndex: historyContext.historyStartIndex,
        inputArtifacts,
        outputArtifacts,
      });

      const nextName = options.service.shouldAutoRenameSession(session)
        ? options.service.suggestSessionName(rawMessage)
        : session.name;

      await options.service.updateSession(session.id, req.user.id, {
        name: nextName,
        messages: mergedMessages,
      });

      if (!doneEmitted) {
        sendSSE({ type: 'done', content: result.content });
      }
    } catch (error: any) {
      const mergedMessages = options.service.createErrorMessages(
        session.messages,
        composedUserMessage,
        error?.message || '统一助手执行失败',
        inputArtifacts
      );

      await options.service.updateSession(session.id, req.user.id, {
        name: options.service.shouldAutoRenameSession(session)
          ? options.service.suggestSessionName(rawMessage)
          : session.name,
        messages: mergedMessages,
      });

      sendSSE({ type: 'error', message: error?.message || '统一助手执行失败' });
    } finally {
      res.end();
    }
  });

  return router;
}

function normalizeChatMode(value: unknown): AssistantChatMode {
  if (value === 'fast' || value === 'plan') {
    return value;
  }
  return 'standard';
}

function normalizeMaxMessages(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 60;
  }
  return Math.min(200, Math.max(10, Math.floor(parsed)));
}

async function buildSessionSummary(
  session: AssistantSessionRecord,
  aiAgent: AIAgent,
  maxMessages: number
): Promise<AssistantSessionSummary> {
  const recentMessages = session.messages
    .filter((message) => message.role !== 'system')
    .slice(-maxMessages);

  if (recentMessages.length === 0) {
    return {
      content: '暂无摘要，当前会话还没有有效消息。',
      updatedAt: Date.now(),
      messageCount: 0,
    };
  }

  const transcript = recentMessages
    .map((message, index) => {
      const role = message.role === 'assistant'
        ? '助手'
        : message.role === 'tool'
          ? `工具:${message.name || 'unknown'}`
          : '用户';
      const artifacts = Array.isArray(message.artifacts) && message.artifacts.length > 0
        ? `\n附件/产物:\n${message.artifacts.map((artifact) => `- ${artifact.name || path.basename(artifact.path)}: ${artifact.path}`).join('\n')}`
        : '';
      return `#${index + 1} ${role}\n${message.content}${artifacts}`;
    })
    .join('\n\n');

  const { openai, model } = await aiAgent.getOpenAIInstance();
  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: [
          '你是会话摘要助手。请把以下对话总结成一份中文 Markdown 摘要。',
          '必须包含以下小节：',
          '1. 当前目标',
          '2. 已完成事项',
          '3. 关键结论 / 决策',
          '4. 生成文件与路径',
          '5. 待继续事项',
          '没有内容的部分写“暂无”，不要编造。',
        ].join('\n'),
      },
      {
        role: 'user',
        content: transcript,
      },
    ],
    stream: false,
  });

  const content = response.choices?.[0]?.message?.content?.trim() || '暂无摘要。';
  return {
    content,
    updatedAt: Date.now(),
    messageCount: recentMessages.length,
  };
}

function normalizeRequestedArtifacts(
  rawArtifacts: any[],
  service: AssistantWorkbenchService,
  workDir: string,
  assistantUploadDir: string
): AssistantArtifact[] {
  const safeArtifacts = rawArtifacts.map((artifact) => {
    const sourcePath = typeof artifact?.path === 'string' ? artifact.path : '';
    const resolvedPath = resolveAllowedArtifactPath(sourcePath, workDir, assistantUploadDir);
    if (!resolvedPath) {
      return null;
    }

    return {
      ...artifact,
      path: resolvedPath,
    };
  }).filter(Boolean) as any[];

  return service.normalizeExternalArtifacts(safeArtifacts);
}

function resolveAllowedArtifactPath(
  requestedPath: string,
  workDir: string,
  assistantUploadDir: string
): string | null {
  if (!requestedPath || typeof requestedPath !== 'string') {
    return null;
  }

  const normalized = requestedPath.trim().replace(/^["']|["']$/g, '');
  if (!normalized) {
    return null;
  }

  const resolved = path.isAbsolute(normalized)
    ? path.normalize(normalized)
    : path.resolve(workDir, normalized);
  const allowedRoots = [
    path.normalize(workDir),
    path.normalize(path.join(workDir, 'uploads')),
    path.normalize(assistantUploadDir),
  ];

  if (!allowedRoots.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`))) {
    return null;
  }

  try {
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      return null;
    }
    return resolved;
  } catch {
    return null;
  }
}

function detectArtifactType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'].includes(ext)) {
    return 'image';
  }
  if (['.pdf'].includes(ext)) {
    return 'pdf';
  }
  if (['.doc', '.docx'].includes(ext)) {
    return 'word';
  }
  if (['.ppt', '.pptx'].includes(ext)) {
    return 'ppt';
  }
  if (['.xls', '.xlsx', '.csv'].includes(ext)) {
    return 'excel';
  }
  if (['.json', '.md', '.txt'].includes(ext)) {
    return 'text';
  }
  return 'file';
}
