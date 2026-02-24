/**
 * Environment Observer - 环境观测注入
 * 移植自 ai-agent-plus: 将 cwd、uploads、recent artifacts 等信息注入 system message
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ChatMessageForAPI {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

/**
 * 构建环境观测信息
 */
export function buildEnvironmentObservation(options?: {
  uploadDir?: string;
  recentArtifacts?: Array<{ type: string; path: string }>;
  sessionId?: string;
  recentToolErrors?: Array<{ name: string; result: string }>;
}): ChatMessageForAPI {
  const lines: string[] = [];

  try { lines.push(`cwd: ${process.cwd()}`); } catch { /* ignore */ }
  try { lines.push(`node: ${process.version}`); } catch { /* ignore */ }
  try { lines.push(`platform: ${process.platform}`); } catch { /* ignore */ }

  if (options?.sessionId) {
    lines.push(`session_id: ${options.sessionId}`);
  }

  // Recent artifacts
  if (options?.recentArtifacts && options.recentArtifacts.length > 0) {
    lines.push('recent_artifacts:');
    for (const a of options.recentArtifacts.slice(-10)) {
      lines.push(`- ${a.type}: ${a.path}`);
    }
  }

  // Recent tool errors
  if (options?.recentToolErrors && options.recentToolErrors.length > 0) {
    lines.push('recent_tool_errors:');
    for (const e of options.recentToolErrors.slice(-5)) {
      const res = (e.result || '').replace(/[\r\n]/g, ' ').slice(0, 240);
      lines.push(`- ${e.name}: ${res}`);
    }
  }

  // Recent uploads
  if (options?.uploadDir && fs.existsSync(options.uploadDir)) {
    try {
      const entries = fs.readdirSync(options.uploadDir)
        .map(fn => {
          const p = path.join(options.uploadDir!, fn);
          try { return { path: p, mtime: fs.statSync(p).mtimeMs }; } catch { return null; }
        })
        .filter((e): e is { path: string; mtime: number } => e !== null)
        .sort((a, b) => a.mtime - b.mtime)
        .slice(-10);

      if (entries.length > 0) {
        lines.push('recent_uploads:');
        for (const e of entries) {
          lines.push(`- ${e.path}`);
        }
      }
    } catch { /* ignore */ }
  }

  return {
    role: 'system',
    content: '【Environment Observation】\n' + lines.slice(0, 80).join('\n'),
  };
}

/**
 * 将环境观测注入到消息列表中（在所有 system 消息之后插入）
 */
export function injectEnvironmentObservation(
  messages: ChatMessageForAPI[],
  options?: Parameters<typeof buildEnvironmentObservation>[0]
): ChatMessageForAPI[] {
  const obs = buildEnvironmentObservation(options);

  let insertAt = 0;
  while (insertAt < messages.length && messages[insertAt].role === 'system') {
    insertAt++;
  }

  return [...messages.slice(0, insertAt), obs, ...messages.slice(insertAt)];
}

/**
 * 注入模式提示（fast / plan）
 */
export function injectModePrompt(messages: ChatMessageForAPI[], mode?: string): ChatMessageForAPI[] {
  if (!mode) return messages;
  const normalized = mode.trim().toLowerCase();

  let content: string;
  if (normalized === 'fast') {
    content = '【快速模式】优先直接给出结论与可执行结果，尽量减少无必要的工具调用；如需工具，先简短说明原因再调用。输出要简洁清晰。';
  } else if (normalized === 'plan') {
    content = '【计划模式】请使用以下结构输出：\n【计划】(3-6步简短计划)\n【执行】(按计划执行过程与关键结果)\n【总结】(最终结论 + 下一步建议)。\n关键步骤或工具调用前先说明理由，保持条理清晰。';
  } else {
    return messages;
  }

  const modeMsg: ChatMessageForAPI = { role: 'system', content };
  let insertAt = 0;
  while (insertAt < messages.length && messages[insertAt].role === 'system') {
    insertAt++;
  }
  return [...messages.slice(0, insertAt), modeMsg, ...messages.slice(insertAt)];
}
