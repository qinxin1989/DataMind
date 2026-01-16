/**
 * 知识库管理
 * 管理知识文档、分块、元数据
 */

import { v4 as uuidv4 } from 'uuid';

// 知识文档类型
export type DocumentType = 'datasource' | 'document' | 'webpage' | 'note';

// 知识文档
export interface KnowledgeDocument {
  id: string;
  knowledgeBaseId: string;
  userId: string;
  type: DocumentType;
  title: string;
  content: string;
  metadata: {
    source?: string;           // 来源（数据源ID、文件路径、URL等）
    sourceType?: string;       // 来源类型（mysql、csv、pdf、txt等）
    fileSize?: number;
    mimeType?: string;
    createdAt: number;
    updatedAt: number;
    tags?: string[];
    customFields?: Record<string, any>;
  };
  chunks?: KnowledgeChunk[];   // 分块后的内容
  embedding?: number[];        // 文档级别的向量（可选）
}

// 知识分块
export interface KnowledgeChunk {
  id: string;
  documentId: string;
  content: string;
  index: number;              // 在文档中的顺序
  startOffset: number;        // 在原文中的起始位置
  endOffset: number;          // 在原文中的结束位置
  embedding?: number[];       // 向量嵌入
  metadata?: {
    heading?: string;         // 所属标题
    pageNumber?: number;      // 页码（PDF）
    rowRange?: [number, number]; // 行范围（数据源）
  };
}

// 知识库配置
export interface KnowledgeBaseConfig {
  id: string;
  userId: string;
  name: string;
  description?: string;
  settings: {
    chunkSize: number;        // 分块大小（字符数）
    chunkOverlap: number;     // 分块重叠
    embeddingModel: string;   // 嵌入模型
    enableGraph: boolean;     // 是否启用知识图谱
  };
  createdAt: number;
  updatedAt: number;
}

export class KnowledgeBase {
  private documents: Map<string, KnowledgeDocument> = new Map();
  private config: KnowledgeBaseConfig;

  constructor(config: Partial<KnowledgeBaseConfig> & { userId: string; name: string }) {
    this.config = {
      id: config.id || uuidv4(),
      userId: config.userId,
      name: config.name,
      description: config.description,
      settings: {
        chunkSize: config.settings?.chunkSize || 500,
        chunkOverlap: config.settings?.chunkOverlap || 50,
        embeddingModel: config.settings?.embeddingModel || 'text-embedding-ada-002',
        enableGraph: config.settings?.enableGraph ?? true,
      },
      createdAt: config.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
  }

  get id(): string {
    return this.config.id;
  }

  get settings() {
    return this.config.settings;
  }

  getConfig(): KnowledgeBaseConfig {
    return { ...this.config };
  }

  // 添加文档
  addDocument(doc: Omit<KnowledgeDocument, 'id' | 'knowledgeBaseId'>): KnowledgeDocument {
    const document: KnowledgeDocument = {
      ...doc,
      id: uuidv4(),
      knowledgeBaseId: this.config.id,
    };
    this.documents.set(document.id, document);
    this.config.updatedAt = Date.now();
    return document;
  }

  // 获取文档
  getDocument(id: string): KnowledgeDocument | undefined {
    return this.documents.get(id);
  }

  // 获取所有文档
  getAllDocuments(): KnowledgeDocument[] {
    return Array.from(this.documents.values());
  }

  // 更新文档
  updateDocument(id: string, updates: Partial<KnowledgeDocument>): boolean {
    const doc = this.documents.get(id);
    if (!doc) return false;
    
    Object.assign(doc, updates, {
      metadata: { ...doc.metadata, ...updates.metadata, updatedAt: Date.now() }
    });
    this.config.updatedAt = Date.now();
    return true;
  }

  // 删除文档
  deleteDocument(id: string): boolean {
    const result = this.documents.delete(id);
    if (result) {
      this.config.updatedAt = Date.now();
    }
    return result;
  }

  // 按类型获取文档
  getDocumentsByType(type: DocumentType): KnowledgeDocument[] {
    return Array.from(this.documents.values()).filter(d => d.type === type);
  }

  // 搜索文档（简单文本匹配）
  searchDocuments(query: string): KnowledgeDocument[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.documents.values()).filter(doc => 
      doc.title.toLowerCase().includes(lowerQuery) ||
      doc.content.toLowerCase().includes(lowerQuery) ||
      doc.metadata.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  // 文本分块
  chunkText(text: string, documentId: string): KnowledgeChunk[] {
    const { chunkSize, chunkOverlap } = this.config.settings;
    const chunks: KnowledgeChunk[] = [];
    
    // 按段落分割
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';
    let currentOffset = 0;
    let chunkIndex = 0;

    for (const para of paragraphs) {
      if (currentChunk.length + para.length > chunkSize && currentChunk.length > 0) {
        // 保存当前块
        chunks.push({
          id: uuidv4(),
          documentId,
          content: currentChunk.trim(),
          index: chunkIndex++,
          startOffset: currentOffset - currentChunk.length,
          endOffset: currentOffset,
        });
        
        // 保留重叠部分
        const overlapText = currentChunk.slice(-chunkOverlap);
        currentChunk = overlapText + '\n\n' + para;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      }
      currentOffset += para.length + 2;
    }

    // 保存最后一块
    if (currentChunk.trim()) {
      chunks.push({
        id: uuidv4(),
        documentId,
        content: currentChunk.trim(),
        index: chunkIndex,
        startOffset: currentOffset - currentChunk.length,
        endOffset: currentOffset,
      });
    }

    return chunks;
  }

  // 从数据源生成知识文档
  static fromDataSource(
    datasourceId: string,
    datasourceName: string,
    schema: any[],
    sampleData: any[],
    userId: string
  ): Omit<KnowledgeDocument, 'id' | 'knowledgeBaseId'> {
    // 生成数据源的知识描述
    const schemaDesc = schema.map(table => {
      const cols = table.columns.map((c: any) => 
        `  - ${c.name} (${c.type})${c.comment ? `: ${c.comment}` : ''}`
      ).join('\n');
      return `表: ${table.tableName}\n字段:\n${cols}`;
    }).join('\n\n');

    const sampleDesc = sampleData.length > 0 
      ? `\n\n样例数据:\n${JSON.stringify(sampleData.slice(0, 5), null, 2)}`
      : '';

    return {
      userId,
      type: 'datasource',
      title: `数据源: ${datasourceName}`,
      content: `# ${datasourceName}\n\n## 数据结构\n${schemaDesc}${sampleDesc}`,
      metadata: {
        source: datasourceId,
        sourceType: 'datasource',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: ['数据源', datasourceName],
      }
    };
  }
}
