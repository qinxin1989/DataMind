/**
 * 审计日志模块 API
 */

import axios from 'axios';
import type { ApiResponse } from '../../../../src/admin/types';
import type {
  AuditLog,
  LogQueryParams,
  LogQueryResult,
  LogStats,
  CreateLogRequest,
  ExportOptions,
  CleanupOptions
} from '../../backend/types';

const BASE_URL = '/api/modules/audit-log';

export const auditLogApi = {
  /**
   * 获取审计日志列表
   */
  async getLogs(params?: LogQueryParams): Promise<ApiResponse<LogQueryResult>> {
    const response = await axios.get(`${BASE_URL}/logs`, { params });
    return response.data;
  },

  /**
   * 获取日志详情
   */
  async getLog(id: string): Promise<ApiResponse<AuditLog>> {
    const response = await axios.get(`${BASE_URL}/logs/${id}`);
    return response.data;
  },

  /**
   * 创建审计日志
   */
  async createLog(data: CreateLogRequest): Promise<ApiResponse<AuditLog>> {
    const response = await axios.post(`${BASE_URL}/logs`, data);
    return response.data;
  },

  /**
   * 删除日志
   */
  async deleteLog(id: string): Promise<ApiResponse<{ message: string }>> {
    const response = await axios.delete(`${BASE_URL}/logs/${id}`);
    return response.data;
  },

  /**
   * 获取日志统计
   */
  async getStats(params?: { startDate?: number; endDate?: number }): Promise<ApiResponse<LogStats>> {
    const response = await axios.get(`${BASE_URL}/stats`, { params });
    return response.data;
  },

  /**
   * 导出日志
   */
  async exportLogs(options: ExportOptions): Promise<void> {
    const response = await axios.post(`${BASE_URL}/export`, options, {
      responseType: 'blob'
    });
    
    // 下载文件
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs.${options.format}`;
    link.click();
    window.URL.revokeObjectURL(url);
  },

  /**
   * 清理过期日志
   */
  async cleanupLogs(options: CleanupOptions): Promise<ApiResponse<{ count: number; message: string }>> {
    const response = await axios.post(`${BASE_URL}/cleanup`, options);
    return response.data;
  }
};
