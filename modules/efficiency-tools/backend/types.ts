/**
 * 效率工具模块类型定义
 */

/**
 * 工具类型
 */
export type ToolType = 'sql-formatter' | 'data-converter' | 'regex-helper';

/**
 * 数据格式类型
 */
export type DataFormat = 'json' | 'csv' | 'excel' | 'xml' | 'yaml';

/**
 * SQL 格式化请求
 */
export interface SqlFormatRequest {
  sql: string;
  language?: 'mysql' | 'postgresql' | 'sqlite' | 'sql';
  indent?: string;
  uppercase?: boolean;
  linesBetweenQueries?: number;
}

/**
 * SQL 格式化响应
 */
export interface SqlFormatResponse {
  success: boolean;
  formatted?: string;
  error?: string;
}

/**
 * 数据转换请求
 */
export interface DataConvertRequest {
  data: string;
  sourceFormat: DataFormat;
  targetFormat: DataFormat;
  options?: {
    pretty?: boolean;
    headers?: boolean;
    delimiter?: string;
  };
}

/**
 * 数据转换响应
 */
export interface DataConvertResponse {
  success: boolean;
  converted?: string;
  error?: string;
}

/**
 * 正则测试请求
 */
export interface RegexTestRequest {
  pattern: string;
  text: string;
  flags?: string;
}

/**
 * 正则测试响应
 */
export interface RegexTestResponse {
  success: boolean;
  matches?: RegexMatch[];
  error?: string;
}

/**
 * 正则匹配结果
 */
export interface RegexMatch {
  match: string;
  index: number;
  groups?: string[];
}

/**
 * 模板类型
 */
export type TemplateType = 'sql' | 'regex' | 'code' | 'text';

/**
 * 用户模板
 */
export interface UserTemplate {
  id: string;
  userId: string;
  type: TemplateType;
  name: string;
  content: string;
  description?: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

/**
 * 模板查询参数
 */
export interface TemplateQueryParams {
  userId: string;
  type?: TemplateType;
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
  items: UserTemplate[];
}

/**
 * 模块配置
 */
export interface EfficiencyToolsConfig {
  enableSqlFormatter: boolean;
  enableDataConverter: boolean;
  enableRegexHelper: boolean;
  enableTemplates: boolean;
  maxInputSize: number; // 最大输入大小 (bytes)
  defaultSqlLanguage: 'mysql' | 'postgresql' | 'sqlite' | 'sql';
  defaultIndent: string;
}
