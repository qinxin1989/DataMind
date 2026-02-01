/**
 * AI配置模块类型定义
 */

export interface AIConfig {
  id: string;
  name: string;
  provider: 'qwen' | 'zhipu' | 'siliconflow' | 'openai' | 'azure' | 'deepseek' | 'local-qwen' | 'ollama' | 'custom';
  model: string;
  embeddingModel?: string;
  apiKey: string;
  baseUrl?: string;
  isDefault: boolean;
  status: 'active' | 'inactive';
  priority: number;
  maxTokens?: number;
  temperature?: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateAIConfigRequest {
  name: string;
  provider: AIConfig['provider'];
  model: string;
  embeddingModel?: string;
  apiKey: string;
  baseUrl?: string;
  apiEndpoint?: string; // 兼容前端
  isDefault?: boolean;
  status?: 'active' | 'inactive';
  maxTokens?: number;
  temperature?: number;
}

export interface UpdateAIConfigRequest {
  name?: string;
  provider?: AIConfig['provider'];
  model?: string;
  embeddingModel?: string;
  apiKey?: string;
  baseUrl?: string;
  apiEndpoint?: string; // 兼容前端
  isDefault?: boolean;
  status?: 'active' | 'inactive';
  maxTokens?: number;
  temperature?: number;
}

export interface ValidateApiKeyRequest {
  provider: string;
  apiKey: string;
  apiEndpoint?: string;
  configId?: string;
  model?: string;
}

export interface ValidateApiKeyResponse {
  valid: boolean;
  message: string;
}

export interface PriorityUpdate {
  id: string;
  priority: number;
}
