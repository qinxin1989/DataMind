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

// 全局配置版本，用于通知所有 AIAgent 实例刷新配置
let globalConfigVersion = 0;

export function bumpConfigVersion() {
  globalConfigVersion++;
}

export function getConfigVersion() {
  return globalConfigVersion;
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
    const { provider, apiKey, apiEndpoint, model } = data;

    // 基本格式验证
    if (!apiKey || apiKey.length < 10) {
      return { valid: false, message: 'API Key 格式不正确' };
    }

    // 根据提供商设置默认 endpoint
    const endpoints: Record<string, string> = {
      qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      zhipu: 'https://open.bigmodel.cn/api/paas/v4',
      siliconflow: 'https://api.siliconflow.cn/v1',
      openai: 'https://api.openai.com/v1',
      deepseek: 'https://api.deepseek.com/v1',
    };

    const baseURL = apiEndpoint || endpoints[provider];

    // 默认模型
    const defaultModels: Record<string, string> = {
      qwen: 'qwen-plus',
      zhipu: 'glm-4-flash',
      siliconflow: 'Qwen/Qwen2.5-7B-Instruct',
      openai: 'gpt-3.5-turbo',
      deepseek: 'deepseek-chat',
    };

    try {
      const OpenAI = require('openai').default;
      const openai = new OpenAI({
        apiKey,
        baseURL,
        timeout: 15000,
      });

      const modelToUse = model || defaultModels[provider] || 'gpt-3.5-turbo';

      await openai.chat.completions.create({
        model: modelToUse,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      });

      return { valid: true, message: '验证成功' };
    } catch (error: any) {
      const msg = error.message || String(error);

      if (msg.includes('401')) {
        return { valid: false, message: 'API Key 无效' };
      } else if (msg.includes('429')) {
        return { valid: false, message: '余额不足或请求限制' };
      } else if (msg.includes('Connection') || msg.includes('ECONNREFUSED')) {
        return { valid: false, message: '连接失败，请检查 API Endpoint' };
      } else if (msg.includes('model')) {
        return { valid: true, message: '验证成功（API Key 有效）' };
      }

      return { valid: false, message: `验证失败: ${msg.substring(0, 100)}` };
    }
  }

  /**
   * 清空所有配置（测试用）
   */
  async clearAll(): Promise<void> {
    await this.db.execute('DELETE FROM sys_ai_configs');
  }
}
