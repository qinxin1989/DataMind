/**
 * RAG 知识库服务类型定义
 */

// 文档类型
export type DocumentType = 'datasource' | 'document' | 'webpage' | 'note';

// 检索模式
export type RetrieveMode = 'vector' | 'agentic' | 'hybrid';

// 知识文档
export interface KnowledgeDocument {
    id: string;
    knowledgeBaseId: string;
    userId: string;
    type: DocumentType;
    title: string;
    content: string;
    categoryId?: string;
    status: 'pending' | 'indexed' | 'failed';
    chunkCount: number;
    fileSize?: number;
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

// 知识分块
export interface KnowledgeChunk {
    id: string;
    documentId: string;
    content: string;
    index: number;
    startOffset: number;
    endOffset: number;
    embedding?: number[];
    metadata?: {
        heading?: string;
        pageNumber?: number;
        rowRange?: [number, number];
    };
}

// 知识分类
export interface KnowledgeCategory {
    id: string;
    name: string;
    description?: string;
    parentId?: string;
    sortOrder: number;
    createdAt: Date;
}

// 检索结果
export interface RetrieveResult {
    success: boolean;
    answer?: string;
    sources: Array<{
        documentId: string;
        title: string;
        content: string;
        score: number;
    }>;
    mode: RetrieveMode;
    tokenUsage?: number;
}

// 创建文档 DTO
export interface CreateDocumentDto {
    title: string;
    content: string;
    type: DocumentType;
    categoryId?: string;
    metadata?: Record<string, any>;
}

// 文档列表查询
export interface DocumentListQuery {
    page?: number;
    pageSize?: number;
    keyword?: string;
    type?: DocumentType;
    categoryId?: string;
    status?: string;
}

// 文档列表响应
export interface DocumentListResponse {
    items: KnowledgeDocument[];
    total: number;
    page: number;
    pageSize: number;
}

// 知识问答请求
export interface QaRequest {
    question: string;
    categoryId?: string;
    documentId?: string;
    mode?: RetrieveMode;
    topK?: number;
}

// 知识问答响应
export interface QaResponse {
    answer: string;
    sources: RetrieveResult['sources'];
    confidence: number;
    mode: RetrieveMode;
}

// 统计信息
export interface RagStats {
    totalDocuments: number;
    totalChunks: number;
    totalCategories: number;
    totalSize: string;
    lastUpdated: Date;
    documentsByType: Record<DocumentType, number>;
    documentsByCategory: Array<{ categoryId: string; name: string; count: number }>;
}
