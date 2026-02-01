/**
 * AI配置模块 API
 */

import request from '@/utils/request';
import type { AIConfig, CreateAIConfigRequest, UpdateAIConfigRequest } from '../../backend/types';

export const aiConfigApi = {
  /**
   * 获取所有配置
   */
  getConfigs() {
    return request.get<AIConfig[]>('/api/ai/configs');
  },

  /**
   * 获取单个配置
   */
  getConfig(id: string) {
    return request.get<AIConfig>(`/api/ai/configs/${id}`);
  },

  /**
   * 创建配置
   */
  createConfig(data: CreateAIConfigRequest) {
    return request.post<AIConfig>('/api/ai/configs', data);
  },

  /**
   * 更新配置
   */
  updateConfig(id: string, data: UpdateAIConfigRequest) {
    return request.put<AIConfig>(`/api/ai/configs/${id}`, data);
  },

  /**
   * 删除配置
   */
  deleteConfig(id: string) {
    return request.delete(`/api/ai/configs/${id}`);
  },

  /**
   * 设置默认配置
   */
  setDefaultConfig(id: string) {
    return request.put<AIConfig>(`/api/ai/configs/${id}/default`);
  },

  /**
   * 更新优先级
   */
  updatePriorities(priorities: { id: string; priority: number }[]) {
    return request.put('/api/ai/configs/priorities', { priorities });
  },

  /**
   * 验证 API Key
   */
  validateApiKey(provider: string, apiKey: string, apiEndpoint?: string, configId?: string, model?: string) {
    return request.post('/api/ai/configs/validate', {
      provider,
      apiKey,
      apiEndpoint,
      configId,
      model
    });
  }
};

export default aiConfigApi;
