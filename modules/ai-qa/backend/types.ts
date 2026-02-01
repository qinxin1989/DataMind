/**
 * AI Q&A 模块类型定义
 */

// ==================== 数据源相关 ====================

export interface DataSourceConfig {
  id: string;
  name: string;
  type: string;
  config: any;
  userId?: string;
  visibility?: 'private' | 'public';
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  categoryId?: string;
}

export interface TableSchema {
  tableName: string;
  columns: ColumnSchema[];
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  key?: string;
  default?: any;
  extra?: string;
}

// ==================== Schema 分析相关 ====================

export interface SchemaAnalysis {
  datasourceId: string;
  tables: TableAnalysis[];
  suggestedQuestions: string[];
  analyzedAt: number;
  updatedAt: number;
  isUserEdited: boolean;
}

export interface TableAnalysis {
  tableName: string;
  tableNameCn?: string;
  description?: string;
  columns: ColumnAnalysis[];
}

export interface ColumnAnalysis {
  name: string;
  nameCn?: string;
  type: string;
  description?: string;
}

// ==================== 对话相关 ====================

export interface ChatSession {
  id: string;
  datasourceId: string;
  messages: ChatMessage[];
  createdAt: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  timestamp: number;
}

// ==================== AI 问答相关 ====================

export interface AgentResponse {
  answer: string;
  sql?: string;
  data?: any[];
  skillUsed?: string;
  toolUsed?: string;
  visualization?: any;
}

export interface AskRequest {
  datasourceId: string;
  question: string;
  sessionId?: string;
}

export interface AskResponse extends AgentResponse {
  sessionId: string;
  ragContext?: {
    used: boolean;
    sources?: string[];
  };
}

// ==================== 知识库相关 ====================

export interface KnowledgeCategory {
  id: string;
  name: string;
  description?: string;
  documentCount: number;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  type: string;
  content: string;
  chunks?: number;
  metadata?: {
    tags?: string[];
    categoryId?: string;
    datasourceId?: string;
    createdAt?: number;
    updatedAt?: number;
  };
}

export interface RAGDocument {
  id: string;
  title: string;
  type: string;
  chunks: number;
  createdAt?: number;
  updatedAt?: number;
  tags?: string[];
  categoryId?: string;
  datasourceId?: string;
  datasourceName?: string;
}

export interface RAGStats {
  totalDocuments: number;
  totalChunks: number;
  totalTokens: number;
  categories: Array<{
    id: string;
    name: string;
    documentCount: number;
  }>;
}

// ==================== 文章生成相关 ====================

export interface ArticleTask {
  id: string;
  userId: string;
  topic: string;
  status: 'pending' | 'queued' | 'generating' | 'completed' | 'failed';
  outline: OutlineChapter[];
  currentChapterIndex: number;
  content: string;
  error?: string;
  categoryId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OutlineChapter {
  title: string;
  description: string;
}

// ==================== 技能和工具相关 ====================

export interface Skill {
  name: string;
  description: string;
  parameters?: any;
}

export interface MCPTool {
  server: string;
  name: string;
  description: string;
  inputSchema?: any;
}

// ==================== 自动分析相关 ====================

export interface AutoAnalyzeRequest {
  datasourceId: string;
  topic: string;
}

export interface DashboardRequest {
  datasourceId: string;
  topic: string;
  theme?: 'light' | 'dark' | 'tech';
}

export interface QualityInspectRequest {
  datasourceId: string;
  tableNameCn?: string;
}

// ==================== 查询相关 ====================

export interface QueryRequest {
  datasourceId: string;
  sql: string;
}

export interface QueryResult {
  success: boolean;
  data?: any[];
  error?: string;
  rowCount?: number;
}

// ==================== RAG 相关 ====================

export interface RAGAskRequest {
  question: string;
  datasourceId?: string;
  categoryId?: string;
  documentId?: string;
}

export interface RAGAskResponse {
  answer: string;
  confidence: number;
  sources: Array<{
    title: string;
    type: string;
    relevance: number;
  }>;
  dataContext?: {
    sql?: string;
    rowCount?: number;
  };
}

export interface GenerateOutlineRequest {
  topic: string;
  categoryId?: string;
}

export interface GenerateSectionRequest {
  topic: string;
  sectionTitle: string;
  sectionDesc: string;
  categoryId?: string;
}

export interface SubmitArticleTaskRequest {
  topic: string;
  outline: OutlineChapter[];
  categoryId?: string;
}

// ==================== 知识图谱相关 ====================

export interface KnowledgeGraphEntity {
  id: string;
  name: string;
  nameCn?: string;
  type: string;
  description?: string;
}

export interface KnowledgeGraphRelation {
  id: string;
  source: string;
  target: string;
  type: string;
  weight?: number;
}

export interface KnowledgeGraph {
  entities: KnowledgeGraphEntity[];
  relations: KnowledgeGraphRelation[];
  stats: {
    entityCount: number;
    relationCount: number;
  };
}
