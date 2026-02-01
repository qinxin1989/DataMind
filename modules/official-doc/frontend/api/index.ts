/**
 * 公文写作 API
 */

import axios from 'axios';
import type {
  DocGenerationRequest,
  DocGenerationResponse,
  OfficialDocTemplate,
  TemplateQueryParams,
  TemplateQueryResult,
  HistoryQueryParams,
  HistoryQueryResult
} from '../../backend/types';

const BASE_URL = '/api/modules/official-doc';

/**
 * 生成公文
 */
export async function generateDoc(request: DocGenerationRequest): Promise<DocGenerationResponse> {
  const response = await axios.post(`${BASE_URL}/generate`, request);
  return response.data;
}

/**
 * 创建模板
 */
export async function createTemplate(
  template: Omit<OfficialDocTemplate, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isSystem'>
): Promise<{ success: boolean; data: OfficialDocTemplate }> {
  const response = await axios.post(`${BASE_URL}/templates`, template);
  return response.data;
}

/**
 * 更新模板
 */
export async function updateTemplate(
  id: string,
  updates: Partial<OfficialDocTemplate>
): Promise<{ success: boolean; message: string }> {
  const response = await axios.put(`${BASE_URL}/templates/${id}`, updates);
  return response.data;
}

/**
 * 删除模板
 */
export async function deleteTemplate(id: string): Promise<{ success: boolean; message: string }> {
  const response = await axios.delete(`${BASE_URL}/templates/${id}`);
  return response.data;
}

/**
 * 获取模板
 */
export async function getTemplate(id: string): Promise<{ success: boolean; data: OfficialDocTemplate }> {
  const response = await axios.get(`${BASE_URL}/templates/${id}`);
  return response.data;
}

/**
 * 查询模板
 */
export async function queryTemplates(params: TemplateQueryParams): Promise<{ success: boolean; data: TemplateQueryResult }> {
  const response = await axios.get(`${BASE_URL}/templates`, { params });
  return response.data;
}

/**
 * 获取历史记录
 */
export async function getHistory(params: HistoryQueryParams): Promise<{ success: boolean; data: HistoryQueryResult }> {
  const response = await axios.get(`${BASE_URL}/history`, { params });
  return response.data;
}

/**
 * 删除历史记录
 */
export async function deleteHistory(id: string): Promise<{ success: boolean; message: string }> {
  const response = await axios.delete(`${BASE_URL}/history/${id}`);
  return response.data;
}

/**
 * 清理过期历史（管理员）
 */
export async function cleanupExpiredHistory(): Promise<{ success: boolean; message: string }> {
  const response = await axios.post(`${BASE_URL}/cleanup`);
  return response.data;
}
