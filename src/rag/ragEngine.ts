/**
 * RAG 引擎
 * 整合知识库、向量存储、知识图谱，提供统一的检索增强生成能力
 */

import OpenAI from 'openai';
import { KnowledgeBase, KnowledgeDocument, KnowledgeChunk } from './knowledgeBase';
import { VectorStore, VectorSearchResult } from './vectorStore';
import { KnowledgeGraph, Entity, Relation } from './knowledgeGraph';
import { EmbeddingService } from './embeddingService';
import { DocumentProcessor } from './documentProcessor';

// RAG 检索结果
export interface RAGContext {
  chunks: VectorSearchResult[];           // 向量检索结果
  graphContext?: {                        // 图谱上下文
    entities: Entity[];
    relations: Relation[];
  };
  sources: { documentId: string; title: string; type: string }[];
}

// RAG 回答结果
export interface RAGResponse {
  answer: string;
  context: RAGContext;
  confidence: number;
  sources: string[];
}

export class RAGEngine {
  private openai: OpenAI;
  private model: string;
  private knowledgeBase: KnowledgeBase;
  private vectorStore: VectorStore;
  private knowledgeGraph: KnowledgeGraph;
  private embeddingService: EmbeddingService;
  private documentProcessor: DocumentProcessor;

  constructor(
    apiKey: string,
    baseURL?: string,
    model: string = 'qwen-plus',
    embeddingModel: string = 'text-embedding-v2'
  ) {
    this.openai = new OpenAI({ apiKey, baseURL });
    this.model = model;
    
    // 初始化组件
    this.embeddingService = new EmbeddingService(apiKey, baseURL, embeddingModel);
    this.vectorStore = new VectorStore(this.embeddingService.getDimension());
    this.documentProcessor = new DocumentProcessor();
    
    // 创建默认知识库
    this.knowledgeBase = new KnowledgeBase({
      userId: 'system',
      name: '默认知识库',
      settings: {
        chunkSize: 500,
        chunkOverlap: 50,
        embeddingModel,
        enableGraph: true,
      },
    });
    
    this.knowledgeGraph = new KnowledgeGraph(this.knowledgeBase.id);
  }

  // 获取知识库
  getKnowledgeBase(): KnowledgeBase {
    return this.knowledgeBase;
  }

  // 获取知识图谱
  getKnowledgeGraph(): KnowledgeGraph {
    return this.knowledgeGraph;
  }

  // 添加文档到知识库
  async addDocument(
    content: string,
    title: string,
    type: 'document' | 'note' | 'webpage' | 'datasource',
    userId: string,
    metadata?: Record<string, any>
  ): Promise<KnowledgeDocument> {
    // 创建文档
    const doc = this.knowledgeBase.addDocument({
      userId,
      type,
      title,
      content,
      metadata: {
        ...metadata,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    });

    // 分块
    const chunks = this.documentProcessor.smartChunk(content, doc.id, {
      chunkSize: this.knowledgeBase.settings.chunkSize,
      overlap: this.knowledgeBase.settings.chunkOverlap,
    });

    // 生成嵌入并存储
    const chunkTexts = chunks.map(c => c.content);
    const embeddings = await this.embeddingService.embedBatch(chunkTexts);
    
    for (let i = 0; i < chunks.length; i++) {
      chunks[i].embedding = embeddings[i];
      this.vectorStore.addVector(chunks[i], embeddings[i]);
    }

    // 更新文档的chunks
    this.knowledgeBase.updateDocument(doc.id, { chunks });

    // 提取实体添加到图谱
    if (this.knowledgeBase.settings.enableGraph) {
      await this.extractAndAddToGraph(doc);
    }

    console.log(`[RAG] 添加文档: ${title}, ${chunks.length} 个分块`);
    return doc;
  }

  // 从数据源添加知识
  async addFromDataSource(
    datasourceId: string,
    datasourceName: string,
    schema: any[],
    sampleData: any[],
    userId: string
  ): Promise<KnowledgeDocument> {
    // 生成数据源知识文档
    const docData = KnowledgeBase.fromDataSource(
      datasourceId,
      datasourceName,
      schema,
      sampleData,
      userId
    );

    const doc = this.knowledgeBase.addDocument(docData);

    // 分块和嵌入
    const chunks = this.documentProcessor.smartChunk(doc.content, doc.id);
    const embeddings = await this.embeddingService.embedBatch(chunks.map(c => c.content));
    
    for (let i = 0; i < chunks.length; i++) {
      chunks[i].embedding = embeddings[i];
      this.vectorStore.addVector(chunks[i], embeddings[i]);
    }

    this.knowledgeBase.updateDocument(doc.id, { chunks });

    // 从Schema构建图谱
    this.knowledgeGraph.buildFromSchema(schema, datasourceId);

    console.log(`[RAG] 添加数据源知识: ${datasourceName}`);
    return doc;
  }

  // 从文件添加知识
  async addFromFile(filePath: string, userId: string): Promise<KnowledgeDocument> {
    const processed = await this.documentProcessor.processFile(filePath);
    return this.addDocument(
      processed.content,
      processed.title,
      'document',
      userId,
      processed.metadata
    );
  }

  // 提取实体并添加到图谱
  private async extractAndAddToGraph(doc: KnowledgeDocument): Promise<void> {
    // 使用AI提取实体和关系
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `从文本中提取实体和关系，返回JSON格式：
{
  "entities": [
    { "name": "实体名", "type": "concept|person|org|location|time|event|metric", "description": "描述" }
  ],
  "relations": [
    { "source": "源实体名", "target": "目标实体名", "type": "related_to|belongs_to|part_of|causes", "description": "关系描述" }
  ]
}
只返回JSON，不要其他内容。如果没有明显的实体关系，返回空数组。`
          },
          {
            role: 'user',
            content: doc.content.slice(0, 3000) // 限制长度
          }
        ],
        temperature: 0.3,
      });

      const content = response.choices[0].message.content || '{}';
      const jsonStr = content.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      const extracted = JSON.parse(jsonStr);

      // 添加实体
      const entityMap = new Map<string, string>();
      for (const e of extracted.entities || []) {
        const entity = this.knowledgeGraph.addEntity({
          type: e.type || 'concept',
          name: e.name,
          description: e.description,
          properties: {},
          sourceDocumentId: doc.id,
        });
        entityMap.set(e.name, entity.id);
      }

      // 添加关系
      for (const r of extracted.relations || []) {
        const sourceId = entityMap.get(r.source);
        const targetId = entityMap.get(r.target);
        if (sourceId && targetId) {
          this.knowledgeGraph.addRelation({
            type: r.type || 'related_to',
            sourceId,
            targetId,
            properties: { description: r.description },
            weight: 0.8,
            sourceDocumentId: doc.id,
          });
        }
      }
    } catch (e: any) {
      console.error('[RAG] 实体提取失败:', e.message);
    }
  }

  // 检索相关上下文
  async retrieve(query: string, topK: number = 5): Promise<RAGContext> {
    // 1. 向量检索
    const queryEmbedding = await this.embeddingService.embed(query);
    const vectorResults = this.vectorStore.search(queryEmbedding, topK, 0.5);

    // 2. 图谱检索
    const keywords = this.documentProcessor.extractKeywords(query, 5);
    const graphResult = this.knowledgeGraph.querySubgraph(keywords, 10);

    // 3. 收集来源信息
    const sourceIds = new Set<string>();
    const sources: { documentId: string; title: string; type: string }[] = [];
    
    for (const result of vectorResults) {
      if (!sourceIds.has(result.documentId)) {
        sourceIds.add(result.documentId);
        const doc = this.knowledgeBase.getDocument(result.documentId);
        if (doc) {
          sources.push({
            documentId: doc.id,
            title: doc.title,
            type: doc.type,
          });
        }
      }
    }

    return {
      chunks: vectorResults,
      graphContext: graphResult.entities.length > 0 ? graphResult : undefined,
      sources,
    };
  }

  // RAG问答
  async answer(query: string, additionalContext?: string): Promise<RAGResponse> {
    // 检索上下文
    const context = await this.retrieve(query);

    // 构建上下文文本
    let contextText = '';
    
    // 向量检索结果
    if (context.chunks.length > 0) {
      contextText += '### 相关知识片段:\n';
      for (const chunk of context.chunks) {
        contextText += `\n[相关度: ${(chunk.score * 100).toFixed(1)}%]\n${chunk.chunk.content}\n`;
      }
    }

    // 图谱上下文
    if (context.graphContext && context.graphContext.entities.length > 0) {
      contextText += '\n### 相关实体:\n';
      for (const entity of context.graphContext.entities.slice(0, 5)) {
        contextText += `- ${entity.name}${entity.nameCn ? `(${entity.nameCn})` : ''}: ${entity.description || entity.type}\n`;
      }
    }

    // 额外上下文
    if (additionalContext) {
      contextText += `\n### 补充信息:\n${additionalContext}\n`;
    }

    // 生成回答
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `你是一个智能知识助手。基于提供的知识上下文回答用户问题。

要求：
1. 优先使用知识库中的信息回答
2. 如果知识库信息不足，可以结合你的知识补充
3. 回答要准确、简洁、有条理
4. 如果无法回答，诚实说明
5. 适当引用来源`
        },
        {
          role: 'user',
          content: `知识上下文:\n${contextText}\n\n用户问题: ${query}`
        }
      ],
      temperature: 0.7,
    });

    const answer = response.choices[0].message.content || '抱歉，无法回答这个问题。';
    
    // 计算置信度（基于检索结果的相似度）
    const confidence = context.chunks.length > 0
      ? context.chunks.reduce((sum, c) => sum + c.score, 0) / context.chunks.length
      : 0.3;

    return {
      answer,
      context,
      confidence,
      sources: context.sources.map(s => s.title),
    };
  }

  // 混合问答：结合数据源查询和知识库
  async hybridAnswer(
    query: string,
    dataSourceContext?: { sql?: string; data?: any[]; schema?: any[] }
  ): Promise<RAGResponse> {
    let additionalContext = '';
    
    if (dataSourceContext) {
      if (dataSourceContext.sql) {
        additionalContext += `执行的SQL: ${dataSourceContext.sql}\n`;
      }
      if (dataSourceContext.data && dataSourceContext.data.length > 0) {
        additionalContext += `查询结果(${dataSourceContext.data.length}条):\n${JSON.stringify(dataSourceContext.data.slice(0, 10), null, 2)}\n`;
      }
    }

    return this.answer(query, additionalContext);
  }

  // 获取统计信息
  getStats(): {
    documents: number;
    chunks: number;
    entities: number;
    relations: number;
  } {
    const vectorStats = this.vectorStore.getStats();
    const graphStats = this.knowledgeGraph.getStats();

    return {
      documents: this.knowledgeBase.getAllDocuments().length,
      chunks: vectorStats.totalVectors,
      entities: graphStats.entities,
      relations: graphStats.relations,
    };
  }

  // 删除文档
  async deleteDocument(documentId: string): Promise<boolean> {
    // 删除向量
    this.vectorStore.deleteDocumentVectors(documentId);
    // 删除文档
    return this.knowledgeBase.deleteDocument(documentId);
  }

  // 导出知识库数据
  exportData(): {
    knowledgeBase: any;
    vectors: any;
    graph: any;
  } {
    return {
      knowledgeBase: {
        config: this.knowledgeBase.getConfig(),
        documents: this.knowledgeBase.getAllDocuments(),
      },
      vectors: this.vectorStore.export(),
      graph: this.knowledgeGraph.export(),
    };
  }
}
