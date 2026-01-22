/**
 * AI 配置管理服务
 * 使用 MySQL 存储，API Key 加密保存
 */

import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../core/database';
import { encrypt, decrypt } from '../../utils/crypto';
import type { AIConfig, CreateAIConfigRequest, UpdateAIConfigRequest } from '../../types';

export class AIConfigService {
  async createConfig(data: CreateAIConfigRequest): Promise<AIConfig> {
    const id = uuidv4();

    // 如果设为默认，先取消其他默认
    if (data.isDefault) {
      await pool.execute('UPDATE sys_ai_configs SET is_default = FALSE');
    }

    // 获取最大优先级
    const [maxRows] = await pool.execute('SELECT COALESCE(MAX(priority), 0) + 1 as next_priority FROM sys_ai_configs');
    const nextPriority = (maxRows as any[])[0].next_priority;

    // 加密 API Key（支持空值）
    const encryptedApiKey = data.apiKey && data.apiKey.trim() !== '' ? encrypt(data.apiKey) : '';

    await pool.execute(
      `INSERT INTO sys_ai_configs (id, name, provider, model, api_key, base_url, is_default, status, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.provider, data.model, encryptedApiKey, data.baseUrl || null, 
       data.isDefault || false, data.status || 'active', nextPriority]
    );

    return this.getConfigById(id) as Promise<AIConfig>;
  }

  async updateConfig(id: string, data: UpdateAIConfigRequest): Promise<AIConfig> {
    const config = await this.getConfigById(id);
    if (!config) throw new Error('AI配置不存在');

    // 如果设为默认，先取消其他默认
    if (data.isDefault) {
      await pool.execute('UPDATE sys_ai_configs SET is_default = FALSE WHERE id != ?', [id]);
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.provider !== undefined) { updates.push('provider = ?'); values.push(data.provider); }
    if (data.model !== undefined) { updates.push('model = ?'); values.push(data.model); }
    // API Key 只有在非空时才更新（空字符串表示不修改），并加密
    if (data.apiKey !== undefined && data.apiKey !== '') { 
      updates.push('api_key = ?'); 
      values.push(encrypt(data.apiKey)); 
    }
    if (data.baseUrl !== undefined) { updates.push('base_url = ?'); values.push(data.baseUrl); }
    if (data.isDefault !== undefined) { updates.push('is_default = ?'); values.push(data.isDefault); }
    if (data.status !== undefined) { updates.push('status = ?'); values.push(data.status); }

    if (updates.length > 0) {
      values.push(id);
      await pool.execute(`UPDATE sys_ai_configs SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    return this.getConfigById(id) as Promise<AIConfig>;
  }

  async deleteConfig(id: string): Promise<void> {
    const config = await this.getConfigById(id);
    if (!config) throw new Error('AI配置不存在');
    await pool.execute('DELETE FROM sys_ai_configs WHERE id = ?', [id]);
  }

  async getConfigById(id: string): Promise<AIConfig | null> {
    const [rows] = await pool.execute('SELECT * FROM sys_ai_configs WHERE id = ?', [id]);
    const configs = rows as any[];
    if (configs.length === 0) return null;

    const config = configs[0];
    return {
      id: config.id,
      name: config.name,
      provider: config.provider,
      model: config.model,
      apiKey: decrypt(config.api_key),  // 解密
      baseUrl: config.base_url,
      isDefault: config.is_default,
      status: config.status,
      priority: config.priority || 0,
      createdAt: new Date(config.created_at).getTime(),
      updatedAt: new Date(config.updated_at).getTime(),
    };
  }

  async getAllConfigs(): Promise<AIConfig[]> {
    const [rows] = await pool.execute('SELECT * FROM sys_ai_configs ORDER BY priority ASC, created_at DESC');
    return (rows as any[]).map(config => ({
      id: config.id,
      name: config.name,
      provider: config.provider,
      model: config.model,
      apiKey: decrypt(config.api_key),  // 解密
      baseUrl: config.base_url,
      isDefault: config.is_default,
      status: config.status,
      priority: config.priority || 0,
      createdAt: new Date(config.created_at).getTime(),
      updatedAt: new Date(config.updated_at).getTime(),
    }));
  }

  async getActiveConfigsByPriority(): Promise<AIConfig[]> {
    const [rows] = await pool.execute(
      'SELECT * FROM sys_ai_configs WHERE status = ? ORDER BY is_default DESC, priority ASC',
      ['active']
    );
    return (rows as any[]).map(config => ({
      id: config.id,
      name: config.name,
      provider: config.provider,
      model: config.model,
      apiKey: decrypt(config.api_key),
      baseUrl: config.base_url,
      isDefault: config.is_default,
      status: config.status,
      priority: config.priority || 0,
      createdAt: new Date(config.created_at).getTime(),
      updatedAt: new Date(config.updated_at).getTime(),
    }));
  }

  async getDefaultConfig(): Promise<AIConfig | null> {
    const [rows] = await pool.execute('SELECT * FROM sys_ai_configs WHERE is_default = TRUE LIMIT 1');
    const configs = rows as any[];
    if (configs.length === 0) return null;

    const config = configs[0];
    return {
      id: config.id,
      name: config.name,
      provider: config.provider,
      model: config.model,
      apiKey: decrypt(config.api_key),  // 解密
      baseUrl: config.base_url,
      isDefault: config.is_default,
      status: config.status,
      priority: config.priority || 0,
      createdAt: new Date(config.created_at).getTime(),
      updatedAt: new Date(config.updated_at).getTime(),
    };
  }

  async setDefaultConfig(id: string): Promise<AIConfig> {
    await pool.execute('UPDATE sys_ai_configs SET is_default = FALSE');
    await pool.execute('UPDATE sys_ai_configs SET is_default = TRUE WHERE id = ?', [id]);
    return this.getConfigById(id) as Promise<AIConfig>;
  }

  async updatePriorities(priorities: { id: string; priority: number }[]): Promise<void> {
    for (const item of priorities) {
      await pool.execute('UPDATE sys_ai_configs SET priority = ? WHERE id = ?', [item.priority, item.id]);
    }
  }
}

// 创建实例并添加别名方法以兼容路由
const service = new AIConfigService();

export const aiConfigService = {
  // 原有方法
  createConfig: service.createConfig.bind(service),
  updateConfig: service.updateConfig.bind(service),
  deleteConfig: service.deleteConfig.bind(service),
  getConfigById: service.getConfigById.bind(service),
  getAllConfigs: service.getAllConfigs.bind(service),
  getDefaultConfig: service.getDefaultConfig.bind(service),
  setDefaultConfig: service.setDefaultConfig.bind(service),
  getActiveConfigsByPriority: service.getActiveConfigsByPriority.bind(service),
  updatePriorities: service.updatePriorities.bind(service),
  
  // AI QA 服务使用的方法
  getDefaultProvider: async () => {
    const config = await service.getDefaultConfig();
    if (!config) return null;
    return {
      name: config.name,
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey,  // 已解密
      apiEndpoint: config.baseUrl,
      isDefault: config.isDefault,
      status: config.status,
    };
  },
  
  // 路由使用的别名方法
  getProviderConfigs: service.getAllConfigs.bind(service),
  getProviderConfigById: service.getConfigById.bind(service),
  createProviderConfig: async (data: any) => {
    return service.createConfig({
      name: data.name,
      provider: data.provider,
      model: data.model,
      apiKey: data.apiKey,
      baseUrl: data.apiEndpoint,
      isDefault: data.isDefault,
      status: data.status,
    });
  },
  updateProviderConfig: service.updateConfig.bind(service),
  deleteProviderConfig: service.deleteConfig.bind(service),
  setDefaultProvider: service.setDefaultConfig.bind(service),
  
  // 验证 API Key - 真正调用 API 测试
  validateApiKey: async (provider: string, apiKey: string, apiEndpoint?: string, model?: string) => {
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

      // 使用用户指定的模型，如果没有则使用默认模型
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
        // 模型不存在但 Key 有效
        return { valid: true, message: '验证成功（API Key 有效）' };
      }
      
      return { valid: false, message: `验证失败: ${msg.substring(0, 100)}` };
    }
  },
};
