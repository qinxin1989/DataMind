/**
 * 采集模板配置模块类型定义
 */

export interface CrawlerField {
  name: string;
  selector: string;
  type?: 'text' | 'attr' | 'html';
  required?: boolean;
}

export interface PaginationConfig {
  enabled: boolean;
  nextPageSelector?: string;
  maxPages?: number;
}

export interface CrawlerTemplate {
  id?: number;
  name: string;
  department?: string;
  data_type?: string;
  url: string;
  container_selector: string;
  fields: CrawlerField[];
  pagination_enabled?: boolean;
  pagination_next_selector?: string;
  pagination_max_pages?: number;
  created_at?: Date;
  updated_at?: Date;
  created_by?: number;
}

export interface CreateTemplateDto {
  name: string;
  department?: string;
  dataType?: string;
  url: string;
  containerSelector: string;
  fields: CrawlerField[];
  paginationEnabled?: boolean;
  paginationNextSelector?: string;
  paginationMaxPages?: number;
}

export interface UpdateTemplateDto extends Partial<CreateTemplateDto> {}

export interface TestTemplateDto {
  url: string;
  selectors: {
    container: string;
    fields: Record<string, string>;
  };
  pagination?: PaginationConfig;
}

export interface PreviewDataDto {
  url: string;
  selectors: {
    container: string;
    fields: Record<string, string>;
  };
  limit?: number;
}

export interface ValidateSelectorDto {
  url: string;
  selector: string;
}

export interface AIAnalyzeDto {
  url: string;
  dataType?: string;
}

export interface DiagnoseDto {
  url: string;
  containerSelector: string;
  fields: CrawlerField[];
}

export interface CrawlerTestResult {
  success: boolean;
  count?: number;
  data?: any[];
  error?: string;
  message?: string;
}

export interface SelectorValidationResult {
  valid: boolean;
  count?: number;
  samples?: string[];
  error?: string;
}

export interface AIAnalysisResult {
  success: boolean;
  containerSelector?: string;
  fields?: CrawlerField[];
  error?: string;
}

export interface DiagnosisResult {
  success: boolean;
  issues?: string[];
  suggestions?: string[];
  strategy?: any;
  error?: string;
}
