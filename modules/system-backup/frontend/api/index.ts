/**
 * 系统备份模块 API
 */

import axios from 'axios';
import type { ApiResponse } from '../../../../src/admin/types';
import type {
  SystemBackup,
  CreateBackupRequest,
  BackupQueryParams,
  BackupQueryResult,
  RestoreResult,
  VerifyResult
} from '../../backend/types';

const BASE_URL = '/api/modules/system-backup';

export const systemBackupApi = {
  /**
   * 获取备份列表
   */
  async getBackups(params?: BackupQueryParams): Promise<ApiResponse<BackupQueryResult>> {
    const response = await axios.get(`${BASE_URL}/backups`, { params });
    return response.data;
  },

  /**
   * 获取备份详情
   */
  async getBackup(id: string): Promise<ApiResponse<SystemBackup>> {
    const response = await axios.get(`${BASE_URL}/backups/${id}`);
    return response.data;
  },

  /**
   * 创建备份
   */
  async createBackup(data: CreateBackupRequest): Promise<ApiResponse<SystemBackup>> {
    const response = await axios.post(`${BASE_URL}/backups`, data);
    return response.data;
  },

  /**
   * 删除备份
   */
  async deleteBackup(id: string): Promise<ApiResponse<{ message: string }>> {
    const response = await axios.delete(`${BASE_URL}/backups/${id}`);
    return response.data;
  },

  /**
   * 恢复备份
   */
  async restoreBackup(id: string): Promise<ApiResponse<RestoreResult>> {
    const response = await axios.post(`${BASE_URL}/backups/${id}/restore`);
    return response.data;
  },

  /**
   * 验证备份
   */
  async verifyBackup(id: string): Promise<ApiResponse<VerifyResult>> {
    const response = await axios.get(`${BASE_URL}/backups/${id}/verify`);
    return response.data;
  },

  /**
   * 导出备份
   */
  async exportBackup(id: string): Promise<void> {
    const response = await axios.get(`${BASE_URL}/backups/${id}/export`, {
      responseType: 'blob'
    });
    
    // 下载文件
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup-${id}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  },

  /**
   * 下载备份
   */
  async downloadBackup(id: string): Promise<void> {
    const response = await axios.get(`${BASE_URL}/backups/${id}/download`, {
      responseType: 'blob'
    });
    
    // 下载文件
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup-${id}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  },

  /**
   * 清理过期备份
   */
  async cleanupOldBackups(): Promise<ApiResponse<{ count: number; message: string }>> {
    const response = await axios.post(`${BASE_URL}/cleanup`);
    return response.data;
  }
};
