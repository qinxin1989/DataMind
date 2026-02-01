/**
 * 效率工具 API 客户端
 */

import axios from 'axios';
import type {
  SqlFormatRequest,
  SqlFormatResponse,
  DataConvertRequest,
  DataConvertResponse,
  RegexTestRequest,
  RegexTestResponse,
  UserTemplate,
  TemplateQueryParams,
  TemplateQueryResult
} from '../../backend/types';

const BASE_URL = '/api/modules/efficiency-tools';

/**
 * SQL 格式化
 */
export async function formatSql(request: SqlFormatRequest): Promise<SqlFormatResponse> {
  const response = await axios.post(`${BASE_URL}/sql/format`, request);
  return response.data;
}

/**
 * 数据转换
 */
export async function convertData(request: DataConvertRequest): Promise<DataConvertResponse> {
  const response = await axios.post(`${BASE_URL}/data/convert`, request);
  return response.data;
}

/**
 * 正则测试
 */
export async function testRegex(request: RegexTestRequest): Promise<RegexTestResponse> {
  const response = await axios.post(`${BASE_URL}/regex/test`, request);
  return response.data;
}

/**
 * 创建模板
 */
export async function createTemplate(template: Omit<UserTemplate, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<UserTemplate> {
  const response = await axios.post(`${BASE_URL}/templates`, template);
  return response.data.data;
}

/**
 * 更新模板
 */
export async function updateTemplate(id: string, updates: Partial<UserTemplate>): Promise<void> {
  await axios.put(`${BASE_URL}/templates/${id}`, updates);
}

/**
 * 删除模板
 */
export async function deleteTemplate(id: string): Promise<void> {
  await axios.delete(`${BASE_URL}/templates/${id}`);
}

/**
 * 获取模板
 */
export async function getTemplate(id: string): Promise<UserTemplate> {
  const response = await axios.get(`${BASE_URL}/templates/${id}`);
  return response.data.data;
}

/**
 * 查询模板
 */
export async function queryTemplates(params: Omit<TemplateQueryParams, 'userId'>): Promise<TemplateQueryResult> {
  const response = await axios.get(`${BASE_URL}/templates`, { params });
  return response.data.data;
}
