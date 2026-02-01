/**
 * 系统配置模块 API
 */

import axios from 'axios';
import type {
  SystemConfig,
  CreateConfigRequest,
  UpdateConfigRequest,
  ConfigQueryParams,
  SystemStatus,
  DbConfig,
  UpdateDbConfigRequest,
  DbConnectionTestResult
} from '../../backend/types';
import type { ApiResponse } from '../../../../src/admin/types';

const BASE_URL = '/api/modules/system-config';

export const systemConfigApi = {
  // ==================== 配置管理 ====================

  /**
   * 获取配置列表
   */
  async getConfigs(params?: ConfigQueryParams): Promise<ApiResponse<SystemConfig[]>> {
    const response = await axios.get(`${BASE_URL}/configs`, { params });
    return response.data;
  },

  /**
   * 获取单个配置
   */
  async getConfig(key: string): Promise<ApiResponse<SystemConfig>> {
    const response = await axios.get(`${BASE_URL}/configs/${key}`);
    return response.data;
  },

  /**
   * 创建配置
   */
  async createConfig(data: CreateConfigRequest): Promise<ApiResponse<SystemConfig>> {
    const response = await axios.post(`${BASE_URL}/configs`, data);
    return response.data;
  },

  /**
   * 更新配置
   */
  async updateConfig(key: string, data: UpdateConfigRequest): Promise<ApiResponse<SystemConfig>> {
    const response = await axios.put(`${BASE_URL}/configs/${key}`, data);
    return response.data;
  },

  /**
   * 删除配置
   */
  async deleteConfig(key: string): Promise<ApiResponse<{ message: string }>> {
    const response = await axios.delete(`${BASE_URL}/configs/${key}`);
    return response.data;
  },

  /**
   * 获取配置分组
   */
  async getConfigGroups(): Promise<ApiResponse<string[]>> {
    const response = await axios.get(`${BASE_URL}/config-groups`);
    return response.data;
  },

  // ==================== 系统状态 ====================

  /**
   * 获取系统状态
   */
  async getSystemStatus(): Promise<ApiResponse<SystemStatus>> {
    const response = await axios.get(`${BASE_URL}/status`);
    return response.data;
  },

  // ==================== 数据库配置 ====================

  /**
   * 获取数据库配置
   */
  async getDbConfig(): Promise<ApiResponse<DbConfig>> {
    const response = await axios.get(`${BASE_URL}/db-config`);
    return response.data;
  },

  /**
   * 更新数据库配置
   */
  async updateDbConfig(data: UpdateDbConfigRequest): Promise<ApiResponse<DbConfig & { message: string }>> {
    const response = await axios.put(`${BASE_URL}/db-config`, data);
    return response.data;
  },

  /**
   * 测试数据库连接
   */
  async testDbConnection(data: Partial<DbConfig>): Promise<ApiResponse<DbConnectionTestResult>> {
    const response = await axios.post(`${BASE_URL}/db-config/test`, data);
    return response.data;
  }
};
