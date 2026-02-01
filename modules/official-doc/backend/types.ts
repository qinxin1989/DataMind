/**
 * 公文写作模块类型定义
 */

/**
 * 公文类型
 */
export type DocType = 'report' | 'notice' | 'summary' | 'plan';

/**
 * 文风类型
 */
export type DocStyle = 'formal' | 'concise' | 'enthusiastic';

/**
 * 生成状态
 */
export type GenerationStatus = 'pending' | 'processing' | 'success' | 'failed';

/**
 * 公文生成请求
 */
export interface DocGenerationRequest {
  type: DocType;
  style: DocStyle;
  points: string;
  templateId?: string;
}

/**
 * 公文生成响应
 */
export interface DocGenerationResponse {
  success: boolean;
  content?: string;
  historyId?: string;
  error?: string;
}

/**
 * 公文模板
 */
export interface OfficialDocTemplate {
  id: string;
  userId?: string;
  name: string;
  type: DocType;
  content: string;
  style: DocStyle;
  isSystem: boolean;
  isPublic: boolean;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 公文生成历史
 */
export interface DocGenerationHistory {
  id: string;
  userId: string;
  templateId?: string;
  type: DocType;
  style: DocStyle;
  points: string;
  result: string;
  status: GenerationStatus;
  errorMessage?: string;
  createdAt: number;
}

/**
 * 模板查询参数
 */
export interface TemplateQueryParams {
  userId?: string;
  type?: DocType;
  isSystem?: boolean;
  isPublic?: boolean;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

/**
 * 模板查询结果
 */
export interface TemplateQueryResult {
  total: number;
  page: number;
  pageSize: number;
  items: OfficialDocTemplate[];
}

/**
 * 历史查询参数
 */
export interface HistoryQueryParams {
  userId: string;
  type?: DocType;
  status?: GenerationStatus;
  startDate?: number;
  endDate?: number;
  page?: number;
  pageSize?: number;
}

/**
 * 历史查询结果
 */
export interface HistoryQueryResult {
  total: number;
  page: number;
  pageSize: number;
  items: DocGenerationHistory[];
}

/**
 * 导出请求
 */
export interface ExportRequest {
  content: string;
  filename?: string;
  format?: 'docx' | 'pdf';
}

/**
 * 模块配置
 */
export interface OfficialDocConfig {
  enableAI: boolean;
  aiModel?: string;
  maxPointsLength: number;
  maxHistoryDays: number;
  enableExport: boolean;
  enableTemplates: boolean;
}
