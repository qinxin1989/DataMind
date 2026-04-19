/**
 * AI配置管理服务
 * 使用 MySQL 存储，API Key 加密保存
 */

import { v4 as uuidv4 } from 'uuid';
import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { encrypt, decrypt } from '../../../src/admin/utils/crypto';
import type {
  AIConfig,
  CreateAIConfigRequest,
  UpdateAIConfigRequest,
  ValidateApiKeyRequest,
  ValidateApiKeyResponse,
  PriorityUpdate
} from './types';

// 配置变更标记（AIAgent 已改为每次请求直接从数据库读取最新配置，此函数保留供外部调用兼容）
export function bumpConfigVersion() {
  // no-op: AIAgent now reads fresh configs from DB on every request
}

export function getConfigVersion() {
  return 0;
}

export class AIConfigService {
  constructor(private db: Pool) {}

  /**
   * 创建AI配置
   */
  async createConfig(data: CreateAIConfigRequest): Promise<AIConfig> {
    const id = uuidv4();

    // 如果设为默认，先取消其他默认
    if (data.isDefault) {
      await this.db.execute('UPDATE sys_ai_configs SET is_default = FALSE');
    }

    // 获取最大优先级
    const [maxRows] = await this.db.query<RowDataPacket[]>(
      'SELECT COALESCE(MAX(priority), 0) + 1 as next_priority FROM sys_ai_configs'
    );
    const nextPriority = (maxRows as any[])[0].next_priority;

    // 加密 API Key（支持空值）
    const encryptedApiKey = data.apiKey && data.apiKey.trim() !== '' ? encrypt(data.apiKey) : '';

    await this.db.execute<ResultSetHeader>(
      `INSERT INTO sys_ai_configs (id, name, provider, model, embedding_model, api_key, base_url, is_default, status, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.provider,
        data.model,
        data.embeddingModel || null,
        encryptedApiKey,
        data.baseUrl || data.apiEndpoint || null,
        data.isDefault || false,
        data.status || 'active',
        nextPriority
      ]
    );

    bumpConfigVersion();
    return this.getConfigById(id) as Promise<AIConfig>;
  }

  /**
   * 更新AI配置
   */
  async updateConfig(id: string, data: UpdateAIConfigRequest): Promise<AIConfig> {
    const config = await this.getConfigById(id);
    if (!config) throw new Error('AI配置不存在');

    // 如果设为默认，先取消其他默认
    if (data.isDefault) {
      await this.db.execute('UPDATE sys_ai_configs SET is_default = FALSE WHERE id != ?', [id]);
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.provider !== undefined) {
      updates.push('provider = ?');
      values.push(data.provider);
    }
    if (data.model !== undefined) {
      updates.push('model = ?');
      values.push(data.model);
    }
    if (data.embeddingModel !== undefined) {
      updates.push('embedding_model = ?');
      values.push(data.embeddingModel);
    }
    // API Key 只有在非空时才更新（空字符串表示不修改），并加密
    if (data.apiKey !== undefined && data.apiKey !== '') {
      updates.push('api_key = ?');
      values.push(encrypt(data.apiKey));
    }
    // 兼容前端发送的 apiEndpoint 和后端的 baseUrl
    const finalBaseUrl = data.baseUrl !== undefined ? data.baseUrl : data.apiEndpoint;
    if (finalBaseUrl !== undefined) {
      updates.push('base_url = ?');
      values.push(finalBaseUrl);
    }
    if (data.isDefault !== undefined) {
      updates.push('is_default = ?');
      values.push(data.isDefault);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }

    if (updates.length > 0) {
      values.push(id);
      await this.db.execute<ResultSetHeader>(
        `UPDATE sys_ai_configs SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
      bumpConfigVersion();
    }

    return this.getConfigById(id) as Promise<AIConfig>;
  }

  /**
   * 删除AI配置
   */
  async deleteConfig(id: string): Promise<void> {
    const config = await this.getConfigById(id);
    if (!config) throw new Error('AI配置不存在');
    
    await this.db.execute<ResultSetHeader>('DELETE FROM sys_ai_configs WHERE id = ?', [id]);
    bumpConfigVersion();
  }

  /**
   * 根据ID获取配置
   */
  async getConfigById(id: string): Promise<AIConfig | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      'SELECT * FROM sys_ai_configs WHERE id = ?',
      [id]
    );
    const configs = rows as any[];
    if (configs.length === 0) return null;

    const config = configs[0];
    return {
      id: config.id,
      name: config.name,
      provider: config.provider,
      model: config.model,
      embeddingModel: config.embedding_model,
      apiKey: decrypt(config.api_key),
      baseUrl: config.base_url,
      isDefault: Boolean(config.is_default),
      status: config.status,
      priority: config.priority || 0,
      createdAt: new Date(config.created_at).getTime(),
      updatedAt: new Date(config.updated_at).getTime(),
    };
  }

  /**
   * 获取所有配置
   */
  async getAllConfigs(): Promise<AIConfig[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      'SELECT * FROM sys_ai_configs ORDER BY priority ASC, created_at DESC'
    );
    return (rows as any[]).map(config => ({
      id: config.id,
      name: config.name,
      provider: config.provider,
      model: config.model,
      embeddingModel: config.embedding_model,
      apiKey: decrypt(config.api_key),
      baseUrl: config.base_url,
      isDefault: Boolean(config.is_default),
      status: config.status,
      priority: config.priority || 0,
      createdAt: new Date(config.created_at).getTime(),
      updatedAt: new Date(config.updated_at).getTime(),
    }));
  }

  /**
   * 获取激活的配置（按优先级排序）
   */
  async getActiveConfigsByPriority(): Promise<AIConfig[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      'SELECT * FROM sys_ai_configs WHERE status = ? ORDER BY is_default DESC, priority ASC',
      ['active']
    );
    return (rows as any[]).map(config => ({
      id: config.id,
      name: config.name,
      provider: config.provider,
      model: config.model,
      embeddingModel: config.embedding_model,
      apiKey: decrypt(config.api_key),
      baseUrl: config.base_url,
      isDefault: Boolean(config.is_default),
      status: config.status,
      priority: config.priority || 0,
      createdAt: new Date(config.created_at).getTime(),
      updatedAt: new Date(config.updated_at).getTime(),
    }));
  }

  /**
   * 获取默认配置
   */
  async getDefaultConfig(): Promise<AIConfig | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      'SELECT * FROM sys_ai_configs WHERE is_default = TRUE AND status = "active" LIMIT 1'
    );
    const configs = rows as any[];
    if (configs.length === 0) return null;

    const config = configs[0];
    return {
      id: config.id,
      name: config.name,
      provider: config.provider,
      model: config.model,
      embeddingModel: config.embedding_model,
      apiKey: decrypt(config.api_key),
      baseUrl: config.base_url,
      isDefault: Boolean(config.is_default),
      status: config.status,
      priority: config.priority || 0,
      createdAt: new Date(config.created_at).getTime(),
      updatedAt: new Date(config.updated_at).getTime(),
    };
  }

  /**
   * 设置默认配置
   */
  async setDefaultConfig(id: string): Promise<AIConfig> {
    await this.db.execute('UPDATE sys_ai_configs SET is_default = FALSE');
    await this.db.execute('UPDATE sys_ai_configs SET is_default = TRUE WHERE id = ?', [id]);
    bumpConfigVersion();
    return this.getConfigById(id) as Promise<AIConfig>;
  }

  /**
   * 更新优先级
   */
  async updatePriorities(priorities: PriorityUpdate[]): Promise<void> {
    for (const item of priorities) {
      await this.db.execute<ResultSetHeader>(
        'UPDATE sys_ai_configs SET priority = ? WHERE id = ?',
        [item.priority, item.id]
      );
    }
    bumpConfigVersion();
  }

  /**
   * 验证 API Key
   */
  async validateApiKey(data: ValidateApiKeyRequest): Promise<ValidateApiKeyResponse> {
    const { provider, apiKey, apiEndpoint } = data;
    const normalizedProvider = provider.trim().toLowerCase();
    const trimmedApiKey = apiKey.trim();
    const trimmedEndpoint = apiEndpoint?.trim();
    const endpointRequiredProviders = new Set(['azure', 'custom']);
    const knownProviders = new Set([
      'qwen',
      'zhipu',
      'siliconflow',
      'openai',
      'azure',
      'deepseek',
      'coding-plan',
      'local-qwen',
      'ollama',
      'custom',
    ]);

    if (!trimmedApiKey || trimmedApiKey.length < 10) {
      return { valid: false, message: 'API Key 格式不正确' };
    }

    if (!knownProviders.has(normalizedProvider)) {
      return { valid: false, message: '不支持的 AI 提供商' };
    }

    if (normalizedProvider === 'openai' && !trimmedApiKey.startsWith('sk-')) {
      return { valid: false, message: 'OpenAI API Key 格式不正确' };
    }

    if (endpointRequiredProviders.has(normalizedProvider) && !trimmedEndpoint) {
      return { valid: false, message: '该提供商需要填写 API Endpoint' };
    }

    if (trimmedEndpoint) {
      try {
        const parsed = new URL(trimmedEndpoint);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return { valid: false, message: 'API Endpoint 必须使用 http 或 https 协议' };
        }
      } catch {
        return { valid: false, message: 'API Endpoint 格式不正确' };
      }
    }

    return { valid: true, message: '格式验证通过' };
  }

  /**
   * 清空所有配置（测试用）
   */
  async clearAll(): Promise<void> {
    await this.db.execute('DELETE FROM sys_ai_configs');
  }
}
