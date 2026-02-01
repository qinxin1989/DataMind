/**
 * 文件工具模块类型定义
 */

/**
 * 文件格式类型
 */
export type FileFormat = 'word' | 'excel' | 'image' | 'pdf' | 'txt' | 'csv' | 'json';

/**
 * 转换状态
 */
export type ConversionStatus = 'pending' | 'processing' | 'success' | 'failed';

/**
 * 文件转换配置
 */
export interface ConversionConfig {
  sourceFormat: FileFormat;
  targetFormat: FileFormat;
  options?: {
    quality?: number; // 图片质量 (1-100)
    compress?: boolean; // 是否压缩
    merge?: boolean; // 是否合并
    [key: string]: any;
  };
}

/**
 * 文件转换历史记录
 */
export interface ConversionHistory {
  id: string;
  userId: string;
  sourceFormat: FileFormat;
  targetFormat: FileFormat;
  originalFilename: string;
  resultFilename?: string;
  fileSize?: number;
  status: ConversionStatus;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 文件转换请求
 */
export interface ConversionRequest {
  files: Express.Multer.File[];
  sourceFormat: FileFormat;
  targetFormat: FileFormat;
  options?: ConversionConfig['options'];
}

/**
 * 文件转换响应
 */
export interface ConversionResponse {
  success: boolean;
  fileId: string;
  safeName: string;
  message: string;
  error?: string;
}

/**
 * 文件下载请求
 */
export interface DownloadRequest {
  fileId: string;
  filename?: string;
}

/**
 * 历史记录查询参数
 */
export interface HistoryQueryParams {
  userId: string;
  page?: number;
  pageSize?: number;
  status?: ConversionStatus;
  startDate?: number;
  endDate?: number;
}

/**
 * 历史记录查询结果
 */
export interface HistoryQueryResult {
  total: number;
  page: number;
  pageSize: number;
  items: ConversionHistory[];
}

/**
 * 模块配置
 */
export interface FileToolsConfig {
  maxFileSize: number; // 最大文件大小 (bytes)
  allowedFormats: FileFormat[]; // 允许的格式
  uploadDir: string; // 上传目录
  tempDir: string; // 临时目录
  retentionDays: number; // 文件保留天数
  enableHistory: boolean; // 是否启用历史记录
}
