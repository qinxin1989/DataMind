/**
 * 公文写作 API
 */

import request, {
  del,
  get,
  post,
  put
} from '../../../../admin-ui/src/api/request';
import type {
  DocGenerationRequest,
  DocGenerationResponse,
  OfficialDocTemplate,
  TemplateQueryParams,
  TemplateQueryResult,
  HistoryQueryParams,
  HistoryQueryResult
} from '../../backend/types';

const BASE_URL = '/modules/official-doc';

type MessageResponse = {
  success: boolean;
  message: string;
};

type TemplateResponse = {
  success: boolean;
  data: OfficialDocTemplate;
};

type TemplateListResponse = {
  success: boolean;
  data: TemplateQueryResult;
};

type HistoryListResponse = {
  success: boolean;
  data: HistoryQueryResult;
};

/**
 * 生成公文
 */
export async function generateDoc(payload: DocGenerationRequest): Promise<DocGenerationResponse> {
  return request.post<DocGenerationResponse, DocGenerationResponse>(`${BASE_URL}/generate`, payload);
}

/**
 * 创建模板
 */
export async function createTemplate(
  template: Omit<OfficialDocTemplate, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isSystem'>
): Promise<TemplateResponse> {
  return post<OfficialDocTemplate>(`${BASE_URL}/templates`, template) as Promise<TemplateResponse>;
}

/**
 * 更新模板
 */
export async function updateTemplate(
  id: string,
  updates: Partial<OfficialDocTemplate>
): Promise<MessageResponse> {
  return put(`${BASE_URL}/templates/${id}`, updates) as Promise<MessageResponse>;
}

/**
 * 删除模板
 */
export async function deleteTemplate(id: string): Promise<MessageResponse> {
  return del(`${BASE_URL}/templates/${id}`) as Promise<MessageResponse>;
}

/**
 * 获取模板
 */
export async function getTemplate(id: string): Promise<TemplateResponse> {
  return get<OfficialDocTemplate>(`${BASE_URL}/templates/${id}`) as Promise<TemplateResponse>;
}

/**
 * 查询模板
 */
export async function queryTemplates(params: TemplateQueryParams): Promise<TemplateListResponse> {
  return get<TemplateQueryResult>(`${BASE_URL}/templates`, { params }) as Promise<TemplateListResponse>;
}

/**
 * 获取历史记录
 */
export async function getHistory(params: HistoryQueryParams): Promise<HistoryListResponse> {
  return get<HistoryQueryResult>(`${BASE_URL}/history`, { params }) as Promise<HistoryListResponse>;
}

/**
 * 删除历史记录
 */
export async function deleteHistory(id: string): Promise<MessageResponse> {
  return del(`${BASE_URL}/history/${id}`) as Promise<MessageResponse>;
}

/**
 * 清理过期历史（管理员）
 */
export async function cleanupExpiredHistory(): Promise<MessageResponse> {
  return post(`${BASE_URL}/cleanup`) as Promise<MessageResponse>;
}
