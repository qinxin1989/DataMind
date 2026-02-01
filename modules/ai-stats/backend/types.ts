/**
 * AI统计模块类型定义
 */

/** AI使用统计 */
export interface AIUsageStats {
  totalRequests: number;
  totalTokens: number;
  estimatedCost: number;
  requestsByDay: { date: string; count: number }[];
  tokensByDay: { date: string; tokens: number }[];
  topUsers: { userId: string; username: string; requests: number; tokens?: number }[];
  byModel?: { modelName: string; requests: number; tokens: number }[];
  byUserModel?: { userId: string; username: string; modelName: string; requests: number; tokens: number }[];
  byDayModel?: { date: string; modelName: string; requests: number; tokens: number }[];
}

/** 对话历史 */
export interface ConversationHistory {
  id: string;
  userId: string;
  username?: string;
  datasourceId: string;
  datasourceName?: string;
  question: string;
  answer: string;
  sqlQuery?: string;
  tokensUsed: number;
  responseTime: number;
  status?: string;
  createdAt: number;
}

/** 对话查询参数 */
export interface ConversationQueryParams {
  userId?: string;
  datasourceId?: string;
  keyword?: string;
  startTime?: number;
  endTime?: number;
  page: number;
  pageSize: number;
}

/** 分页结果 */
export interface PaginatedResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 用户统计 */
export interface UserStats {
  totalRequests: number;
  totalTokens: number;
  avgResponseTime: number;
}
