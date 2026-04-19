import { pool } from '../../core/database';
import {
  AIConfigService as ModuleAIConfigService,
} from '../../../../modules/ai-config/backend/service';
import type { AIConfig, CreateAIConfigRequest, UpdateAIConfigRequest } from '../../../../modules/ai-config/backend/types';

type LegacyProviderConfig = {
  id: string;
  name: string;
  provider: AIConfig['provider'];
  apiKey: string;
  model: string;
  apiEndpoint?: string | null;
  baseUrl?: string | null;
  isDefault: boolean;
  status: AIConfig['status'];
  maxTokens?: number;
  temperature?: number;
};

type LegacyProviderUpdate = Partial<Omit<LegacyProviderConfig, 'id'>>;

export class AIConfigService {
  private service = new ModuleAIConfigService(pool);
  private metadata = new Map<string, { maxTokens?: number; temperature?: number }>();

  async createProviderConfig(data: LegacyProviderUpdate): Promise<LegacyProviderConfig> {
    const payload: CreateAIConfigRequest = {
      name: data.name || '',
      provider: data.provider || 'openai',
      apiKey: data.apiKey || '',
      model: data.model || '',
      apiEndpoint: data.apiEndpoint || data.baseUrl || undefined,
      isDefault: data.isDefault,
      status: data.status,
    };
    const created = await this.service.createConfig(payload);

    this.metadata.set(created.id, {
      maxTokens: data.maxTokens,
      temperature: data.temperature,
    });

    return this.toLegacyConfig(created);
  }

  async getProviderConfigs(): Promise<LegacyProviderConfig[]> {
    const configs = await this.service.getAllConfigs();
    return configs.map(config => this.toLegacyConfig(config));
  }

  async getProviderConfigById(id: string): Promise<LegacyProviderConfig | null> {
    const config = await this.service.getConfigById(id);
    return config ? this.toLegacyConfig(config) : null;
  }

  async updateProviderConfig(id: string, data: LegacyProviderUpdate): Promise<LegacyProviderConfig> {
    const meta = this.metadata.get(id) || {};
    if (data.maxTokens !== undefined) {
      meta.maxTokens = data.maxTokens;
    }
    if (data.temperature !== undefined) {
      meta.temperature = data.temperature;
    }
    this.metadata.set(id, meta);

    const payload: UpdateAIConfigRequest = {
      name: data.name,
      provider: data.provider,
      apiKey: data.apiKey,
      model: data.model,
      apiEndpoint: data.apiEndpoint ?? data.baseUrl ?? undefined,
      isDefault: data.isDefault,
      status: data.status,
    };
    const updated = await this.service.updateConfig(id, payload);

    return this.toLegacyConfig(updated);
  }

  async deleteProviderConfig(id: string): Promise<void> {
    const config = await this.getProviderConfigById(id);
    if (config?.isDefault) {
      throw new Error('默认配置不能删除');
    }

    this.metadata.delete(id);
    await this.service.deleteConfig(id);
  }

  async validateApiKey(provider: string, apiKey: string, apiEndpoint?: string): Promise<{ valid: boolean; message: string }> {
    return this.service.validateApiKey({ provider, apiKey, apiEndpoint });
  }

  async clearAll(): Promise<void> {
    this.metadata.clear();
    await this.service.clearAll();
  }

  private toLegacyConfig(config: AIConfig): LegacyProviderConfig {
    const meta = this.metadata.get(config.id);
    return {
      id: config.id,
      name: config.name,
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
      apiEndpoint: config.baseUrl || null,
      baseUrl: config.baseUrl || null,
      isDefault: config.isDefault,
      status: config.status,
      maxTokens: meta?.maxTokens,
      temperature: meta?.temperature,
    };
  }
}
