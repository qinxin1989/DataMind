/**
 * Agent Loop - 多轮工具执行循环核心
 * 移植自 ai-agent-plus _process_request + api_server.py SSE chat
 *
 * 核心流程：用户消息 → system prompt(含数据源 schema) → LLM → tool_calls → 执行 → 回传 → 再调 LLM → ... → 最终回复
 * 关键集成点：接收 DataMind 的 BaseDataSource + dbType，通过 SkillContext 桥接到所有技能执行
 */

import { BaseDataSource } from '../datasource';
import { TableSchema } from '../types';
import {
  getAgentTools,
  executeToolCall,
  buildAgentSystemPrompt,
  ToolExecutionContext,
  ToolExecutionPolicy,
  getAllowedSkillDescriptions,
} from './toolSchema';
import { isToolError, buildReflexMessage, enhanceErrorResult } from './errorReflection';
import {
  ChatMessageForAPI,
  injectEnvironmentObservation,
  injectModePrompt,
} from './environmentObserver';

// ========== 类型定义 ==========

export interface AgentLoopConfig {
  /** 最大循环轮次 */
  maxIterations: number;
  /** 连续工具错误阈值，达到则提前终止 */
  maxConsecutiveToolErrors: number;
  /** 模式：fast 减少迭代，plan 结构化输出 */
  mode?: 'fast' | 'plan';
}

export const DEFAULT_AGENT_LOOP_CONFIG: AgentLoopConfig = {
  maxIterations: 15,
  maxConsecutiveToolErrors: 3,
  mode: undefined,
};

/** SSE 事件类型 */
export type AgentSSEEvent =
  | { type: 'progress'; stage: string; message: string }
  | { type: 'content'; content: string }
  | { type: 'tool'; id?: string; name: string; status: 'running' | 'done' | 'error'; args?: any; result?: string }
  | { type: 'done'; content: string }
  | { type: 'error'; message: string };

/** Agent Loop 输入参数 */
export interface AgentLoopInput {
  /** 用户消息 */
  userMessage: string;
  /** 对话历史（不含本次 userMessage） */
  history?: ChatMessageForAPI[];
  /** DataMind 数据源 */
  dataSource?: BaseDataSource;
  /** 数据库类型 */
  dbType?: string;
  /** 表结构（可预传入避免重复获取） */
  schemas?: TableSchema[];
  /** OpenAI 客户端实例 */
  openai: any;
  /** 模型名 */
  model: string;
  /** 配置 */
  config?: Partial<AgentLoopConfig>;
  /** 工作目录（上传文件路径等） */
  workDir?: string;
  /** 用户 ID */
  userId?: string;
  /** 上传目录 */
  uploadDir?: string;
  /** 会话 ID，用于环境观测 */
  sessionId?: string;
  /** 会话摘要或长期上下文 */
  sessionContext?: string;
  /** 最近产物，用于提示模型继续利用已有文件 */
  recentArtifacts?: Array<{ type: string; path: string }>;
  /** 最近工具错误，用于减少重复踩坑 */
  recentToolErrors?: Array<{ name: string; result: string }>;
  /** SSE 事件回调 */
  onEvent?: (event: AgentSSEEvent) => void | Promise<void>;
  /** 当前业务助手名称 */
  assistantName?: string;
  /** 当前业务助手职责说明 */
  assistantDescription?: string;
  /** 当前业务助手附加提示词 */
  extraSystemPrompt?: string;
  /** 当前业务助手工具权限 */
  toolPolicy?: ToolExecutionPolicy;
}

/** Agent Loop 返回结果 */
export interface AgentLoopResult {
  /** 最终文本回复 */
  content: string;
  /** 完整消息历史（含本次对话） */
  messages: ChatMessageForAPI[];
  /** 工具调用总次数 */
  toolCallCount: number;
  /** 循环轮次 */
  iterations: number;
}

// ========== 核心循环 ==========

/**
 * 执行 Agent 多轮工具循环
 *
 * @example
 * ```typescript
 * const result = await runAgentLoop({
 *   userMessage: '帮我查询销售数据并生成报表',
 *   dataSource: mysqlSource,
 *   dbType: 'mysql',
 *   schemas: tableSchemas,
 *   openai: openaiClient,
 *   model: 'gpt-4o',
 *   onEvent: (e) => res.write(`data: ${JSON.stringify(e)}\n\n`),
 * });
 * ```
 */
export async function runAgentLoop(input: AgentLoopInput): Promise<AgentLoopResult> {
  const config: AgentLoopConfig = { ...DEFAULT_AGENT_LOOP_CONFIG, ...input.config };

  // fast 模式限制迭代数
  let maxIterations = config.maxIterations;
  if (config.mode === 'fast') {
    maxIterations = Math.min(maxIterations, 6);
  }

  const emit = async (event: AgentSSEEvent) => {
    if (input.onEvent) {
      await input.onEvent(event);
    }
  };

  // 1. 获取 schemas（如果未预传入）
  let schemas = input.schemas;
  if (!schemas && input.dataSource) {
    try {
      const schemaResult = await input.dataSource.getSchema();
      schemas = schemaResult || [];
    } catch {
      schemas = [];
    }
  }

  // 2. 构建 system prompt（含数据源上下文）
  const systemPrompt = buildAgentSystemPrompt({
    schemas,
    dbType: input.dbType,
    assistantName: input.assistantName,
    assistantDescription: input.assistantDescription,
    extraInstructions: input.extraSystemPrompt,
    sessionContext: input.sessionContext,
    skillDescriptions: getAllowedSkillDescriptions(input.toolPolicy),
  });

  // 3. 组装 messages
  const messages: ChatMessageForAPI[] = [];
  messages.push({ role: 'system', content: systemPrompt });

  // 历史消息
  if (input.history && input.history.length > 0) {
    for (const msg of input.history) {
      if (msg.role !== 'system') {
        messages.push({ ...msg });
      }
    }
  }

  // 本次用户消息
  messages.push({ role: 'user', content: input.userMessage });

  // 注入环境观测 & 模式提示
  let enrichedMessages = injectEnvironmentObservation(messages, {
    uploadDir: input.uploadDir,
    sessionId: input.sessionId,
    recentArtifacts: input.recentArtifacts,
    recentToolErrors: input.recentToolErrors,
  });
  enrichedMessages = injectModePrompt(enrichedMessages, config.mode);

  // 4. 准备工具执行上下文
  const toolCtx: ToolExecutionContext = {
    dataSource: input.dataSource,
    schemas,
    dbType: input.dbType,
    openai: input.openai,
    model: input.model,
    workDir: input.workDir,
    userId: input.userId,
    ...input.toolPolicy,
  };

  // 5. 获取工具 schema
  const tools = getAgentTools(input.toolPolicy);

  // 6. 多轮循环
  let fullContent = '';
  let toolCallCount = 0;
  let consecutiveToolErrors = 0;
  let iterations = 0;

  await emit({ type: 'progress', stage: 'start', message: '正在理解你的需求，准备开始处理...' });

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    iterations = iteration + 1;

    if (iteration === 0) {
      await emit({ type: 'progress', stage: 'iteration', message: '正在整理上下文，准备给你可执行的结果...' });
    } else {
      await emit({ type: 'progress', stage: 'iteration', message: '根据上一步结果继续推进...' });
    }

    // 调用 LLM
    let response: any;
    try {
      response = await input.openai.chat.completions.create({
        model: input.model,
        messages: enrichedMessages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
        stream: false,
      });
    } catch (e: any) {
      await emit({ type: 'error', message: `LLM 调用失败: ${e.message}` });
      break;
    }

    const choice = response.choices?.[0];
    if (!choice) {
      await emit({ type: 'error', message: 'LLM 返回空结果' });
      break;
    }

    const assistantMessage = choice.message;
    const content = assistantMessage.content || '';
    const toolCalls = assistantMessage.tool_calls || [];

    // 输出文本内容
    if (content) {
      fullContent += content;
      await emit({ type: 'content', content });
    }

    // 无工具调用 → 结束
    if (!toolCalls || toolCalls.length === 0) {
      enrichedMessages.push({ role: 'assistant', content });
      await emit({ type: 'done', content: fullContent });
      break;
    }

    // 有工具调用 → 保存 assistant 消息（含 tool_calls）
    enrichedMessages.push({
      role: 'assistant',
      content: content || null,
      tool_calls: toolCalls,
    } as any);

    await emit({ type: 'progress', stage: 'tool_calls', message: '需要获取一些信息，正在执行工具...' });

    // 执行每个工具调用
    for (const toolCall of toolCalls) {
      const funcName = toolCall.function?.name || '';
      const funcArgs = toolCall.function?.arguments || '{}';
      const toolCallId = toolCall.id || '';

      // 提取显示名
      let displayName = funcName;
      if (funcName === 'run_skill') {
        try {
          const parsed = JSON.parse(funcArgs);
          if (parsed.skill && parsed.action) {
            displayName = `${parsed.skill}.${parsed.action}`;
          }
        } catch { /* ignore */ }
      }

      // 通知工具开始
      await emit({
        type: 'progress',
        stage: 'tool_start',
        message: `正在使用 ${displayName} 获取所需信息...`,
      });
      await emit({
        type: 'tool',
        id: toolCallId,
        name: displayName,
        status: 'running',
        args: safeParseJson(funcArgs),
      });

      // 执行工具
      let result: string;
      try {
        result = await executeToolCall(funcName, funcArgs, toolCtx);
      } catch (e: any) {
        result = `Error: ${e.message}`;
      }

      toolCallCount++;

      // 判断是否错误
      const isError = isToolError(result);
      let finalResult = result;

      if (isError) {
        finalResult = enhanceErrorResult(result, displayName, safeParseJson(funcArgs));
        consecutiveToolErrors++;

        await emit({
          type: 'tool',
          id: toolCallId,
          name: displayName,
          status: 'error',
          result: finalResult.slice(0, 2000),
        });
        await emit({
          type: 'progress',
          stage: 'tool_error',
          message: `${displayName} 执行遇到问题，正在调整策略...`,
        });

        // 追加 tool result 到 messages
        enrichedMessages.push({
          role: 'tool',
          content: finalResult,
          tool_call_id: toolCallId,
          name: funcName,
        } as any);

        // 注入错误反思
        const reflexMsg = buildReflexMessage(displayName, safeParseJson(funcArgs), result);
        enrichedMessages.push(reflexMsg);

        // 检查连续错误阈值
        if (config.maxConsecutiveToolErrors > 0 && consecutiveToolErrors >= config.maxConsecutiveToolErrors) {
          const msg = `连续 ${consecutiveToolErrors} 次工具调用失败，已提前终止。请检查错误信息并修正后重试。`;
          await emit({ type: 'error', message: msg });
          return {
            content: fullContent,
            messages: enrichedMessages,
            toolCallCount,
            iterations,
          };
        }
      } else {
        consecutiveToolErrors = 0;

        await emit({
          type: 'tool',
          id: toolCallId,
          name: displayName,
          status: 'done',
          result: finalResult.slice(0, 2000),
        });
        await emit({
          type: 'progress',
          stage: 'tool_done',
          message: `${displayName} 已完成，继续分析并组织答案...`,
        });

        // 追加 tool result 到 messages
        enrichedMessages.push({
          role: 'tool',
          content: finalResult,
          tool_call_id: toolCallId,
          name: funcName,
        } as any);
      }
    }
  }

  // 达到最大迭代
  if (iterations >= maxIterations && !fullContent.includes('[done]')) {
    await emit({ type: 'progress', stage: 'max_iterations', message: '已达到最大处理轮次' });
  }

  return {
    content: fullContent,
    messages: enrichedMessages,
    toolCallCount,
    iterations,
  };
}

// ========== 流式版本（用于 SSE 端点）==========

/**
 * 创建 SSE 格式的异步生成器
 * 用于 Express 的 SSE 端点直接 pipe
 */
export async function* runAgentLoopSSE(input: Omit<AgentLoopInput, 'onEvent'>): AsyncGenerator<string> {
  const events: AgentSSEEvent[] = [];
  let resolveWait: (() => void) | null = null;
  let done = false;

  const onEvent = (event: AgentSSEEvent) => {
    events.push(event);
    if (resolveWait) {
      resolveWait();
      resolveWait = null;
    }
  };

  // 启动循环（不 await，让它在后台运行）
  const loopPromise = runAgentLoop({ ...input, onEvent }).then(() => {
    done = true;
    if (resolveWait) {
      resolveWait();
      resolveWait = null;
    }
  }).catch((e) => {
    events.push({ type: 'error', message: e.message });
    done = true;
    if (resolveWait) {
      resolveWait();
      resolveWait = null;
    }
  });

  // 逐个 yield SSE 事件
  while (true) {
    while (events.length > 0) {
      const event = events.shift()!;
      yield `data: ${JSON.stringify(event)}\n\n`;
    }

    if (done) break;

    // 等待新事件
    await new Promise<void>((resolve) => {
      resolveWait = resolve;
    });
  }

  await loopPromise;
}

// ========== 辅助函数 ==========

function safeParseJson(str: string): Record<string, any> {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}
