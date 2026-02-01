/**
 * 文件工具 API
 */

import axios from 'axios';

const API_BASE = '/api/modules/file-tools';

export interface ConversionRequest {
  files: File[];
  sourceFormat: string;
  targetFormat: string;
  options?: any;
}

export interface ConversionResponse {
  success: boolean;
  fileId: string;
  safeName: string;
  message: string;
  error?: string;
}

export interface HistoryItem {
  id: string;
  userId: string;
  sourceFormat: string;
  targetFormat: string;
  originalFilename: string;
  resultFilename?: string;
  fileSize?: number;
  status: string;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export interface HistoryResult {
  total: number;
  page: number;
  pageSize: number;
  items: HistoryItem[];
}

/**
 * 文件格式转换
 */
export async function convertFiles(request: ConversionRequest): Promise<ConversionResponse> {
  const formData = new FormData();
  
  request.files.forEach(file => {
    formData.append('files', file);
  });
  
  formData.append('sourceFormat', request.sourceFormat);
  formData.append('targetFormat', request.targetFormat);
  
  if (request.options) {
    formData.append('options', JSON.stringify(request.options));
  }

  const response = await axios.post(`${API_BASE}/convert`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  return response.data;
}

/**
 * 获取下载链接
 */
export function getDownloadUrl(fileId: string, filename: string): string {
  const token = localStorage.getItem('token');
  return `${API_BASE}/download/${fileId}/${encodeURIComponent(filename)}?token=${token}`;
}

/**
 * 获取转换历史
 */
export async function getHistory(params: {
  page?: number;
  pageSize?: number;
  status?: string;
  startDate?: number;
  endDate?: number;
}): Promise<HistoryResult> {
  const response = await axios.get(`${API_BASE}/history`, { params });
  return response.data;
}

/**
 * 删除历史记录
 */
export async function deleteHistory(id: string): Promise<void> {
  await axios.delete(`${API_BASE}/history/${id}`);
}

/**
 * 清理过期文件（管理员）
 */
export async function cleanupExpiredFiles(): Promise<{ success: boolean; message: string }> {
  const response = await axios.post(`${API_BASE}/cleanup`);
  return response.data;
}
