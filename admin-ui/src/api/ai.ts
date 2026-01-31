import { get, post, put, del, aiPost } from './request'
import type { AIConfig, PaginatedResponse } from '@/types'

export interface AIUsageStats {
  totalRequests: number
  totalTokens: number
  estimatedCost: number
  requestsByDay: { date: string; count: number }[]
  tokensByDay: { date: string; tokens: number }[]
  topUsers: { userId: string; username: string; requests: number; tokens?: number }[]
  byModel?: { modelName: string; requests: number; tokens: number }[]
  byUserModel?: { userId: string; username: string; modelName: string; requests: number; tokens: number }[]
  byDayModel?: { date: string; modelName: string; requests: number; tokens: number }[]
}

export interface ConversationHistory {
  id: string
  userId: string
  username: string
  datasourceId: string
  datasourceName: string
  question: string
  answer: string
  sqlQuery?: string
  tokensUsed: number
  responseTime: number
  status: string
  createdAt: number
}

export interface ChatHistoryStats {
  totalChats: number
  totalTokens: number
  avgResponseTime: number
  successRate: number
  byUser: { userId: string; username: string; count: number }[]
  byDatasource: { datasourceId: string; datasourceName: string; count: number }[]
}

export const aiApi = {
  // 获取AI配置列表
  getConfigs: () =>
    get<AIConfig[]>('/admin/ai/configs'),

  // 创建AI配置
  createConfig: (data: Partial<AIConfig>) =>
    post<AIConfig>('/admin/ai/configs', data),

  // 更新AI配置
  updateConfig: (id: string, data: Partial<AIConfig>) =>
    put<AIConfig>(`/admin/ai/configs/${id}`, data),

  // 删除AI配置
  deleteConfig: (id: string) =>
    del(`/admin/ai/configs/${id}`),

  // 更新优先级（拖拽排序）
  updatePriorities: (priorities: { id: string; priority: number }[]) =>
    put<{ message: string }>('/admin/ai/configs/priorities', { priorities }),

  // 验证API Key
  validateApiKey: (provider: string, apiKey?: string, apiEndpoint?: string, configId?: string, model?: string) =>
    post<{ valid: boolean; message?: string }>('/admin/ai/configs/validate', { provider, apiKey, apiEndpoint, configId, model }),

  // 获取使用统计
  getUsageStats: (startTime: number, endTime: number) =>
    get<AIUsageStats>('/admin/ai/stats', { params: { startTime, endTime } }),

  // 查询对话历史（使用审计日志接口）
  getConversations: (params: { page?: number; pageSize?: number; userId?: string; datasourceId?: string; keyword?: string }) =>
    get<PaginatedResponse<ConversationHistory>>('/admin/audit/chat-history', { params }),

  // 获取对话历史统计
  getChatStats: (startTime?: number, endTime?: number) =>
    get<ChatHistoryStats>('/admin/audit/chat-history/stats', { params: { startTime, endTime } }),

  // 删除对话历史
  deleteChatHistory: (id: string) =>
    del(`/admin/audit/chat-history/${id}`),

  // --- 爬虫相关 ---
  // 获取模板列表
  getCrawlerTemplates: () =>
    get<any[]>('/skills/crawler/templates'),

  // 获取定时任务列表
  getCrawlerTasks: () =>
    get<any[]>('/skills/crawler/tasks'),

  // 获取采集结果批次
  getCrawlerResults: () =>
    get<any[]>('/skills/crawler/results'),

  // 获取具体结果明细
  getCrawlerResultDetails: (id: string) =>
    get<any[]>(`/skills/crawler/results/${id}`),

  // 切换任务状态
  toggleCrawlerTask: (id: string, status: 'active' | 'paused') =>
    post(`/skills/crawler/tasks/${id}/toggle`, { status }),

  // 删除爬虫模板
  deleteCrawlerTemplate: (id: string) =>
    del(`/skills/crawler/templates/${id}`),

  // 删除采集结果
  deleteCrawlerResult: (id: string) =>
    del(`/skills/crawler/results/${id}`),

  // --- AI 爬虫助手相关 ---
  // 分析网页并生成选择器
  analyzeCrawler: (url: string, description: string) =>
    aiPost<any>('/admin/ai/crawler/analyze', { url, description }),

  // 预览爬虫效果
  previewCrawler: (url: string, selectors: any) =>
    aiPost<any>('/admin/ai/crawler/preview', { url, selectors }),

  // 保存爬虫模板
  saveCrawlerTemplate: (data: { name: string; description: string; url: string; department?: string; data_type?: string; selectors: any }) =>
    post<any>('/skills/crawler/templates', data),

  // AI对话接口（支持上下文追问）
  chat: (data: { messages: Array<{ role: string; content: string }> }) =>
    aiPost<any>('/admin/ai/chat', data),

  // 智能爬虫助手对话（支持多网址与上下文反馈）
  crawlerChat: (data: { messages: Array<{ role: string; content: string }> }) =>
    aiPost<any>('/admin/ai/crawler/chat', data),
}
