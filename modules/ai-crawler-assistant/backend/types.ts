/**
 * AI爬虫助手类型定义
 */

// ==================== 对话消息 ====================

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'ai';
  content: string;
}

// ==================== 分析结果 ====================

export interface AnalysisResult {
  url: string;
  selectors: CrawlerSelectors;
  department?: string;
  preview?: any[];
  error?: string;
}

export interface CrawlerSelectors {
  container?: string;
  fields: Record<string, string>;
}

// ==================== 对话处理 ====================

export interface ProcessChatRequest {
  messages: ChatMessage[];
  userId: string;
  stream?: boolean;
}

export interface ProcessChatResponse {
  text: string;
  results: AnalysisResult[];
}

export interface ChatProgressData {
  type: 'text' | 'result' | 'error';
  content: any;
}

// ==================== 网页分析 ====================

export interface AnalyzeWebpageRequest {
  url: string;
  description: string;
}

// ==================== 预览抓取 ====================

export interface PreviewExtractionRequest {
  url: string;
  selectors: CrawlerSelectors;
  limit?: number;
  page?: number;
  pageSize?: number;
}

export interface PreviewExtractionResponse {
  data: any[];
  total: number;
  limit: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ==================== 模板管理 ====================

export interface SaveTemplateRequest {
  name: string;
  description?: string;
  url: string;
  department?: string;
  data_type?: string;
  selectors: CrawlerSelectors;
  userId?: string;
}

export interface CrawlerTemplate {
  id: string;
  userId: string;
  name: string;
  url: string;
  department?: string;
  data_type?: string;
  containerSelector?: string;
  fields: TemplateField[];
  createdAt: number;
  updatedAt: number;
}

export interface TemplateField {
  name: string;
  selector: string;
}

export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  department?: string;
  data_type?: string;
  selectors?: CrawlerSelectors;
}

// ==================== 选择器验证 ====================

export interface ValidateSelectorRequest {
  url: string;
  selector: string;
}

export interface ValidateSelectorResponse {
  valid: boolean;
  matchCount: number;
  message: string;
}

// ==================== 诊断分析 ====================

export interface DiagnoseRequest {
  url: string;
  selectors: CrawlerSelectors;
  error?: string;
}

export interface DiagnoseResponse {
  reason: string;
  issues: string[];
  suggestions: string[];
  recommendedStrategy: RecommendedStrategy;
}

export interface RecommendedStrategy {
  useHeadless?: boolean;
  waitForSelector?: string;
  scrollToBottom?: boolean;
  customScript?: string;
}

// ==================== 测试爬虫 ====================

export interface TestCrawlerRequest {
  url: string;
  selectors: CrawlerSelectors;
  paginationConfig?: PaginationConfig;
}

export interface TestCrawlerResponse {
  success: boolean;
  data: any[];
  count: number;
  url: string;
  selectors: CrawlerSelectors;
  timestamp: number;
  message: string;
  summary?: TestSummary;
  error?: string;
  suggestions?: string[];
  pagination?: PaginationInfo;
}

export interface TestSummary {
  totalItems: number;
  fields: string[];
  containerUsed: string;
}

export interface PaginationConfig {
  enabled: boolean;
  maxPages?: number;
}

export interface PaginationInfo {
  enabled: boolean;
  maxPages: number;
  note: string;
}

// ==================== 对话历史 ====================

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  messages?: ConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: string;
  type: string;
  content: any;
  createdAt: Date;
}

export interface CreateConversationRequest {
  title?: string;
  messages?: any[];
}

export interface UpdateConversationRequest {
  title?: string;
  messages?: any[];
}

export interface CrawlerConversation {
  id: string;
  userId: string;
  messages: any[];
  createdAt: number;
  updatedAt: number;
}
