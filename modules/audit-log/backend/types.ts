/**
 * 审计日志模块类型定义
 */

/**
 * 日志状态
 */
export type LogStatus = 'success' | 'failed';

/**
 * 审计日志
 */
export interface AuditLog {
  id: string;
  userId: string;
  username: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  status: LogStatus;
  errorMessage?: string;
  createdAt: number;
}

/**
 * 创建日志请求
 */
export interface CreateLogRequest {
  userId: string;
  username: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  status: LogStatus;
  errorMessage?: string;
}

/**
 * 日志查询参数
 */
export interface LogQueryParams {
  userId?: string;
  action?: string;
  resourceType?: string;
  status?: LogStatus;
  startDate?: number;
  endDate?: number;
  page?: number;
  pageSize?: number;
}

/**
 * 日志查询结果
 */
export interface LogQueryResult {
  total: number;
  page: number;
  pageSize: number;
  items: AuditLog[];
}

/**
 * 日志统计
 */
export interface LogStats {
  totalLogs: number;
  successLogs: number;
  failedLogs: number;
  topActions: Array<{ action: string; count: number }>;
  topUsers: Array<{ userId: string; username: string; count: number }>;
  logsByDate: Array<{ date: string; count: number }>;
}

/**
 * 日志导出选项
 */
export interface ExportOptions {
  format: 'json' | 'csv';
  startDate?: number;
  endDate?: number;
  userId?: string;
  action?: string;
}

/**
 * 清理选项
 */
export interface CleanupOptions {
  beforeDate: number;
  status?: LogStatus;
}

/**
 * 模块配置
 */
export interface AuditLogModuleConfig {
  retentionDays: number;
  maxLogsPerQuery: number;
  enableAutoCleanup: boolean;
  autoCleanupInterval: number;
}

/**
 * 对话历史记录
 */
export interface ChatHistoryRecord {
  id: string;
  userId: string;
  username: string;
  datasourceId: string;
  datasourceName: string;
  question: string;
  answer: string;
  sqlQuery?: string;
  tokensUsed: number;
  responseTime: number;
  status: 'success' | 'error';
  createdAt: number;
}

/**
 * 对话历史查询参数
 */
export interface ChatHistoryQueryParams {
  userId?: string;
  datasourceId?: string;
  keyword?: string;
  startTime?: number;
  endTime?: number;
  page: number;
  pageSize: number;
}
