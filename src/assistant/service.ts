import type { Pool, RowDataPacket } from 'mysql2/promise';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessageForAPI } from '../agent/environmentObserver';

export type AssistantChatMode = 'standard' | 'fast' | 'plan';

export interface AssistantArtifact {
  id: string;
  path: string;
  name?: string;
  desc?: string;
  type?: string;
  direction?: 'input' | 'output' | 'intermediate';
  mimeType?: string;
  size?: number;
  createdAt: number;
}

export interface AssistantSessionSummary {
  content: string;
  updatedAt: number;
  messageCount: number;
}

export interface AssistantSessionMessage extends ChatMessageForAPI {
  id: string;
  timestamp: number;
  artifacts?: AssistantArtifact[];
  meta?: Record<string, any>;
}

export interface AssistantSessionRecord {
  id: string;
  userId: string;
  name: string;
  messages: AssistantSessionMessage[];
  summary: AssistantSessionSummary | null;
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface AssistantSessionListItem {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  preview: string;
  summaryUpdatedAt?: number;
}

export interface AssistantChatHistory {
  history: ChatMessageForAPI[];
  historyStartIndex: number;
  sessionContext?: string;
  recentArtifacts: Array<{ type: string; path: string }>;
}

export class AssistantWorkbenchService {
  constructor(
    private readonly pool: Pool,
    private readonly workDir: string
  ) { }

  async initTables(): Promise<void> {
    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS sys_assistant_sessions (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        messages JSON NOT NULL,
        summary JSON NULL,
        metadata JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_updated (updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  async listSessions(userId: string): Promise<AssistantSessionListItem[]> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      'SELECT * FROM sys_assistant_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 100',
      [userId]
    );

    return rows.map((row) => {
      const messages = this.parseMessages(row.messages);
      const summary = this.parseSummary(row.summary);
      const preview = this.buildPreview(messages);
      return {
        id: row.id,
        name: row.name,
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
        messageCount: messages.length,
        preview,
        summaryUpdatedAt: summary?.updatedAt,
      };
    });
  }

  async createSession(userId: string, name?: string): Promise<AssistantSessionRecord> {
    const session: AssistantSessionRecord = {
      id: uuidv4(),
      userId,
      name: name?.trim() || '新对话',
      messages: [],
      summary: null,
      metadata: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.pool.execute(
      `INSERT INTO sys_assistant_sessions (id, user_id, name, messages, summary, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, FROM_UNIXTIME(? / 1000), FROM_UNIXTIME(? / 1000))`,
      [
        session.id,
        session.userId,
        session.name,
        JSON.stringify(session.messages),
        null,
        JSON.stringify(session.metadata),
        session.createdAt,
        session.updatedAt,
      ]
    );

    return session;
  }

  async getSession(sessionId: string, userId: string): Promise<AssistantSessionRecord | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      'SELECT * FROM sys_assistant_sessions WHERE id = ? AND user_id = ? LIMIT 1',
      [sessionId, userId]
    );
    const row = rows[0];
    if (!row) {
      return null;
    }
    return this.mapRowToSession(row);
  }

  async renameSession(sessionId: string, userId: string, name: string): Promise<void> {
    await this.pool.execute(
      'UPDATE sys_assistant_sessions SET name = ?, updated_at = NOW() WHERE id = ? AND user_id = ?',
      [name.trim() || '新对话', sessionId, userId]
    );
  }

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    await this.pool.execute(
      'DELETE FROM sys_assistant_sessions WHERE id = ? AND user_id = ?',
      [sessionId, userId]
    );
  }

  async updateSession(
    sessionId: string,
    userId: string,
    patch: Partial<Pick<AssistantSessionRecord, 'name' | 'messages' | 'summary' | 'metadata'>>
  ): Promise<void> {
    const existing = await this.getSession(sessionId, userId);
    if (!existing) {
      throw new Error('会话不存在');
    }

    const nextName = patch.name ?? existing.name;
    const nextMessages = patch.messages ?? existing.messages;
    const nextSummary = patch.summary === undefined ? existing.summary : patch.summary;
    const nextMetadata = patch.metadata ?? existing.metadata;

    await this.pool.execute(
      `UPDATE sys_assistant_sessions
       SET name = ?, messages = ?, summary = ?, metadata = ?, updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [
        nextName,
        JSON.stringify(this.sanitizeMessages(nextMessages)),
        nextSummary ? JSON.stringify(nextSummary) : null,
        JSON.stringify(nextMetadata || {}),
        sessionId,
        userId,
      ]
    );
  }

  async deleteMessages(sessionId: string, userId: string, startIndex: number, endIndex: number): Promise<AssistantSessionRecord> {
    const session = await this.getSession(sessionId, userId);
    if (!session) {
      throw new Error('会话不存在');
    }

    const safeStart = Math.max(0, Math.min(startIndex, session.messages.length - 1));
    const safeEnd = Math.max(safeStart, Math.min(endIndex, session.messages.length - 1));
    const nextMessages = [...session.messages];
    nextMessages.splice(safeStart, safeEnd - safeStart + 1);

    await this.updateSession(sessionId, userId, {
      messages: nextMessages,
      summary: null,
    });

    return {
      ...session,
      messages: nextMessages,
      summary: null,
      updatedAt: Date.now(),
    };
  }

  buildChatHistory(session: AssistantSessionRecord): AssistantChatHistory {
    const historyWindow = 80;
    const historyStartIndex = Math.max(0, session.messages.length - historyWindow);
    const recentMessages = session.messages.slice(historyStartIndex);

    return {
      history: recentMessages.map((message) => this.toApiMessage(message)),
      historyStartIndex,
      sessionContext: session.summary?.content,
      recentArtifacts: this.collectRecentArtifacts(session.messages).map((artifact) => ({
        type: artifact.type || 'file',
        path: artifact.path,
      })),
    };
  }

  mergeSessionMessages(options: {
    previousMessages: AssistantSessionMessage[];
    resultMessages: ChatMessageForAPI[];
    historyStartIndex: number;
    inputArtifacts?: AssistantArtifact[];
    outputArtifacts?: AssistantArtifact[];
  }): AssistantSessionMessage[] {
    const { previousMessages, resultMessages, historyStartIndex, inputArtifacts = [], outputArtifacts = [] } = options;
    const historyTail = previousMessages.slice(historyStartIndex);
    const nextMessages = resultMessages.filter((message) => message.role !== 'system');
    const prefix = previousMessages.slice(0, historyStartIndex);
    const now = Date.now();

    const rebuiltTail = nextMessages.map((message, index) => {
      const previous = historyTail[index];
      return {
        id: previous?.id || uuidv4(),
        role: message.role,
        content: typeof message.content === 'string' ? message.content : '',
        tool_calls: Array.isArray(message.tool_calls) ? message.tool_calls : undefined,
        tool_call_id: message.tool_call_id,
        name: message.name,
        timestamp: previous?.timestamp || (now + index),
        artifacts: previous?.artifacts ? [...previous.artifacts] : undefined,
        meta: previous?.meta ? { ...previous.meta } : undefined,
      } satisfies AssistantSessionMessage;
    });

    const merged = [...prefix, ...rebuiltTail];
    const firstNewMessageIndex = previousMessages.length;

    if (inputArtifacts.length > 0 && merged[firstNewMessageIndex]?.role === 'user') {
      merged[firstNewMessageIndex].artifacts = this.mergeArtifacts(
        merged[firstNewMessageIndex].artifacts,
        inputArtifacts
      );
    }

    if (outputArtifacts.length > 0) {
      const outputTargetIndex = this.findLastAssistantIndex(merged, firstNewMessageIndex);
      if (outputTargetIndex >= 0) {
        merged[outputTargetIndex].artifacts = this.mergeArtifacts(
          merged[outputTargetIndex].artifacts,
          outputArtifacts
        );
      }
    }

    return merged;
  }

  createErrorMessages(
    previousMessages: AssistantSessionMessage[],
    message: string,
    errorMessage: string,
    inputArtifacts: AssistantArtifact[] = []
  ): AssistantSessionMessage[] {
    const userMessage: AssistantSessionMessage = {
      id: uuidv4(),
      role: 'user',
      content: message,
      timestamp: Date.now(),
      artifacts: inputArtifacts.length > 0 ? [...inputArtifacts] : undefined,
    };

    const assistantMessage: AssistantSessionMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: `处理失败：${errorMessage}`,
      timestamp: Date.now() + 1,
    };

    return [...previousMessages, userMessage, assistantMessage];
  }

  composeUserMessage(message: string, artifacts: AssistantArtifact[]): string {
    const cleanMessage = (message || '').trim();
    if (artifacts.length === 0) {
      return cleanMessage;
    }

    const attachmentLines = artifacts.map((artifact) => {
      const name = artifact.name || path.basename(artifact.path);
      return `- ${name}: ${artifact.path}`;
    });

    return [
      cleanMessage,
      '',
      '【本轮附加文件】',
      ...attachmentLines,
      '如果任务依赖附件，请优先读取这些文件并基于文件内容继续。'
    ].join('\n').trim();
  }

  suggestSessionName(message: string): string {
    const cleaned = (message || '')
      .replace(/\s+/g, ' ')
      .replace(/[【】[\]（）()]/g, '')
      .trim();

    if (!cleaned) {
      return '新对话';
    }

    return cleaned.slice(0, 24);
  }

  shouldAutoRenameSession(session: AssistantSessionRecord): boolean {
    const defaultNames = new Set(['新对话', '未命名会话', '新会话']);
    return session.messages.length === 0 || defaultNames.has(session.name);
  }

  collectOutputArtifacts(messages: ChatMessageForAPI[]): AssistantArtifact[] {
    const artifacts: AssistantArtifact[] = [];

    for (const message of messages) {
      if (!message || (message.role !== 'assistant' && message.role !== 'tool')) {
        continue;
      }

      for (const filePath of this.extractPaths(message.content || '')) {
        const resolvedPath = this.resolveArtifactPath(filePath);
        if (!resolvedPath) {
          continue;
        }

        artifacts.push({
          id: uuidv4(),
          path: resolvedPath,
          name: path.basename(resolvedPath),
          type: this.detectArtifactType(resolvedPath),
          direction: 'output',
          createdAt: Date.now(),
          size: this.readFileSize(resolvedPath),
        });
      }
    }

    return this.deduplicateArtifacts(artifacts);
  }

  normalizeExternalArtifacts(rawArtifacts: any[]): AssistantArtifact[] {
    const normalized: AssistantArtifact[] = [];

    for (const item of rawArtifacts || []) {
      const sourcePath = typeof item?.path === 'string' ? item.path : '';
      const resolvedPath = this.resolveArtifactPath(sourcePath);
      if (!resolvedPath) {
        continue;
      }

      normalized.push({
        id: uuidv4(),
        path: resolvedPath,
        name: typeof item?.name === 'string' && item.name ? item.name : path.basename(resolvedPath),
        mimeType: typeof item?.mimeType === 'string' ? item.mimeType : undefined,
        type: typeof item?.type === 'string' && item.type ? item.type : this.detectArtifactType(resolvedPath),
        direction: item?.direction === 'output' || item?.direction === 'intermediate' ? item.direction : 'input',
        createdAt: Date.now(),
        size: typeof item?.size === 'number' ? item.size : this.readFileSize(resolvedPath),
      });
    }

    return this.deduplicateArtifacts(normalized);
  }

  buildContextPayload(session: AssistantSessionRecord) {
    return {
      session: {
        id: session.id,
        name: session.name,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      summary: session.summary,
      messageCount: session.messages.length,
      recentArtifacts: this.collectRecentArtifacts(session.messages),
    };
  }

  resolveArtifactPath(filePath: string): string | null {
    if (!filePath || typeof filePath !== 'string') {
      return null;
    }

    const trimmed = filePath.trim().replace(/^["']|["']$/g, '');
    if (!trimmed) {
      return null;
    }

    const candidate = path.isAbsolute(trimmed)
      ? trimmed
      : path.resolve(this.workDir, trimmed);

    try {
      if (!fs.existsSync(candidate)) {
        return null;
      }
      if (!fs.statSync(candidate).isFile()) {
        return null;
      }
      return path.normalize(candidate);
    } catch {
      return null;
    }
  }

  private mapRowToSession(row: RowDataPacket): AssistantSessionRecord {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      messages: this.parseMessages(row.messages),
      summary: this.parseSummary(row.summary),
      metadata: this.parseMetadata(row.metadata),
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  private parseMessages(raw: unknown): AssistantSessionMessage[] {
    const source = this.parseJson<any[]>(raw, []);
    return source
      .filter((item) => item && typeof item === 'object')
      .map((item, index) => ({
        id: typeof item.id === 'string' && item.id ? item.id : uuidv4(),
        role: item.role === 'tool' || item.role === 'assistant' || item.role === 'system' ? item.role : 'user',
        content: typeof item.content === 'string' ? item.content : '',
        tool_calls: Array.isArray(item.tool_calls) ? item.tool_calls : undefined,
        tool_call_id: typeof item.tool_call_id === 'string' ? item.tool_call_id : undefined,
        name: typeof item.name === 'string' ? item.name : undefined,
        timestamp: typeof item.timestamp === 'number' ? item.timestamp : (Date.now() + index),
        artifacts: Array.isArray(item.artifacts)
          ? item.artifacts
            .filter((artifact: any) => artifact && typeof artifact.path === 'string')
            .map((artifact: any) => ({
              id: typeof artifact.id === 'string' && artifact.id ? artifact.id : uuidv4(),
              path: artifact.path,
              name: artifact.name,
              desc: artifact.desc,
              type: artifact.type,
              direction: artifact.direction,
              mimeType: artifact.mimeType,
              size: typeof artifact.size === 'number' ? artifact.size : undefined,
              createdAt: typeof artifact.createdAt === 'number' ? artifact.createdAt : Date.now(),
            }))
          : undefined,
        meta: item.meta && typeof item.meta === 'object' ? item.meta : undefined,
      }));
  }

  private parseSummary(raw: unknown): AssistantSessionSummary | null {
    const summary = this.parseJson<any>(raw, null);
    if (!summary || typeof summary !== 'object') {
      return null;
    }
    if (typeof summary.content !== 'string' || !summary.content.trim()) {
      return null;
    }
    return {
      content: summary.content,
      updatedAt: typeof summary.updatedAt === 'number' ? summary.updatedAt : Date.now(),
      messageCount: typeof summary.messageCount === 'number' ? summary.messageCount : 0,
    };
  }

  private parseMetadata(raw: unknown): Record<string, any> {
    const value = this.parseJson<Record<string, any>>(raw, {});
    return value && typeof value === 'object' ? value : {};
  }

  private parseJson<T>(raw: unknown, fallback: T): T {
    if (raw == null) {
      return fallback;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    }
    return raw as T;
  }

  private sanitizeMessages(messages: AssistantSessionMessage[]): AssistantSessionMessage[] {
    return messages.map((message) => ({
      ...message,
      content: this.sanitizeString(message.content || ''),
      name: message.name ? this.sanitizeString(message.name) : undefined,
      artifacts: Array.isArray(message.artifacts)
        ? message.artifacts.map((artifact) => ({
          ...artifact,
          name: artifact.name ? this.sanitizeString(artifact.name) : undefined,
          desc: artifact.desc ? this.sanitizeString(artifact.desc) : undefined,
        }))
        : undefined,
    }));
  }

  private sanitizeString(value: string): string {
    return value
      .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
      .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
      .replace(/\u0000/g, '');
  }

  private buildPreview(messages: AssistantSessionMessage[]): string {
    const latest = [...messages]
      .reverse()
      .find((message) => (message.role === 'user' || message.role === 'assistant') && message.content.trim());

    if (!latest) {
      return '还没有消息';
    }

    return latest.content.replace(/\s+/g, ' ').slice(0, 80);
  }

  private collectRecentArtifacts(messages: AssistantSessionMessage[]): AssistantArtifact[] {
    const artifacts: AssistantArtifact[] = [];
    for (const message of messages) {
      if (Array.isArray(message.artifacts)) {
        artifacts.push(...message.artifacts);
      }
    }
    return this.deduplicateArtifacts(artifacts).slice(-20);
  }

  private deduplicateArtifacts(artifacts: AssistantArtifact[]): AssistantArtifact[] {
    const seen = new Set<string>();
    const deduped: AssistantArtifact[] = [];

    for (const artifact of artifacts) {
      const key = `${artifact.direction || 'unknown'}::${artifact.path}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      deduped.push(artifact);
    }

    return deduped;
  }

  private mergeArtifacts(
    previousArtifacts: AssistantArtifact[] | undefined,
    nextArtifacts: AssistantArtifact[]
  ): AssistantArtifact[] {
    return this.deduplicateArtifacts([...(previousArtifacts || []), ...nextArtifacts]);
  }

  private findLastAssistantIndex(messages: AssistantSessionMessage[], minIndex: number): number {
    for (let index = messages.length - 1; index >= minIndex; index--) {
      if (messages[index].role === 'assistant') {
        return index;
      }
    }
    return -1;
  }

  private toApiMessage(message: AssistantSessionMessage): ChatMessageForAPI {
    return {
      role: message.role,
      content: message.content,
      tool_calls: message.tool_calls,
      tool_call_id: message.tool_call_id,
      name: message.name,
    };
  }

  private detectArtifactType(filePath: string): string {
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

  private extractPaths(content: string): string[] {
    if (!content) {
      return [];
    }

    const matches = new Set<string>();
    const explicitPatterns = [
      /输出文件[:：]\s*([^\r\n]+)/g,
      /"outputPath"\s*:\s*"([^"]+)"/g,
      /"path"\s*:\s*"([^"]+)"/g,
      /"filePath"\s*:\s*"([^"]+)"/g,
    ];

    for (const pattern of explicitPatterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1]) {
          matches.add(match[1].trim());
        }
      }
    }

    const linePatterns = content.split('\n');
    for (const line of linePatterns) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      const windowsMatch = trimmed.match(/[A-Za-z]:\\[^\r\n"]+/);
      if (windowsMatch?.[0]) {
        matches.add(windowsMatch[0].trim());
      }

      const unixMatch = trimmed.match(/\/[^\s"'`]+/);
      if (unixMatch?.[0] && unixMatch[0].includes('/')) {
        matches.add(unixMatch[0].trim());
      }
    }

    return Array.from(matches);
  }

  private readFileSize(filePath: string): number | undefined {
    try {
      return fs.statSync(filePath).size;
    } catch {
      return undefined;
    }
  }
}
