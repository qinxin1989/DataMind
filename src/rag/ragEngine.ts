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
import { v4 as uuidv4 } from 'uuid';

// RAG 检索结果
export interface RAGContext {
  chunks: VectorSearchResult[];           // 向量检索结果
  graphContext?: {                        // 图谱上下文
    entities: Entity[];
    relations: Relation[];
  };
  sources: { documentId: string; title: string; type: string; content?: string }[];
}

// RAG 回答结果
export interface RAGResponse {
  answer: string;
  context: RAGContext;
  confidence: number;
  sources: { documentId: string; title: string; type: string; content?: string }[];
}

export interface RAGSource {
  documentId: string;
  title: string;
  type: string;
  content?: string;
}

// 搜索结果
export interface SearchResult {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  content: string;
  score: number;
  metadata: any;
}

export class RAGEngine {
  private openai!: OpenAI;
  private model!: string;
  private knowledgeBase: KnowledgeBase;
  private vectorStore: VectorStore;
  private knowledgeGraph: KnowledgeGraph;
  private embeddingService: EmbeddingService;
  private documentProcessor: DocumentProcessor;
  private userId: string;
  private pool: any;

  constructor(
    apiKeyOrConfigs: string | { apiKey?: string; baseURL?: string; model: string; provider?: string }[],
    baseURL?: string,
    model: string = 'qwen-plus',
    embeddingModel: string = 'text-embedding-v2',
    userId: string = 'system',
    pool?: any
  ) {
    this.userId = userId;
    this.pool = pool;

    let embeddingConfigs: { apiKey?: string; baseURL?: string; model: string; provider?: string }[];

    if (Array.isArray(apiKeyOrConfigs)) {
      embeddingConfigs = apiKeyOrConfigs;
      const firstConfig = apiKeyOrConfigs[0];

      // 支持空 API Key
      const openaiConfig: any = {
        baseURL: firstConfig.baseURL,
      };

      if (firstConfig.apiKey && firstConfig.apiKey.trim() !== '') {
        openaiConfig.apiKey = firstConfig.apiKey;
      }

      this.openai = new OpenAI(openaiConfig);
      this.model = model;
    } else {
      // 单 API Key 配置，支持空值
      const apiKey = apiKeyOrConfigs;

      embeddingConfigs = [{
        apiKey: apiKey || '',
        baseURL,
        model: embeddingModel,
        provider: 'unknown'
      }];

      // 支持空 API Key
      const openaiConfig: any = {
        baseURL: baseURL,
      };

      if (apiKey && apiKey.trim() !== '') {
        openaiConfig.apiKey = apiKey;
      }

      this.openai = new OpenAI(openaiConfig);
      this.model = model;
    }

    console.log(`[RAGEngine] 初始化，嵌入模型数量: ${embeddingConfigs.length}`);

    // 初始化组件
    this.embeddingService = new EmbeddingService(embeddingConfigs);
    this.vectorStore = new VectorStore();  // 不再限制维度
    this.documentProcessor = new DocumentProcessor();

    // 创建默认知识库
    this.knowledgeBase = new KnowledgeBase({
      userId,
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

    // 保存到数据库
    if (this.pool) {
      try {
        // 保存文档
        await this.pool.execute(
          `INSERT INTO knowledge_documents (id, knowledge_base_id, user_id, type, title, content, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            doc.id,
            this.knowledgeBase.id,
            userId,
            type,
            title,
            content,
            JSON.stringify(doc.metadata)
          ]
        );

        // 保存分块
        for (let i = 0; i < chunks.length; i++) {
          // 确保 embedding 存在
          const embeddingJson = embeddings[i] ? JSON.stringify(embeddings[i]) : '[]';

          await this.pool.execute(
            `INSERT INTO knowledge_chunks (id, document_id, chunk_index, content, embedding, metadata)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              chunks[i].id,
              doc.id,
              i,
              chunks[i].content,
              embeddingJson,
              JSON.stringify(chunks[i].metadata || {})
            ]
          );
        }

        console.log(`[RAG] 文档已保存到数据库: ${doc.id}`);
      } catch (error: any) {
        console.error('[RAG] 保存文档到数据库失败:', error.message);
      }
    }

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

  // 全文检索分块 (支持多词模糊搜索)
  async searchChunks(query: string, limit: number = 20): Promise<SearchResult[]> {
    console.log(`[RAG] 全文检索: ${query}`);
    const keywords = query.trim().split(/\s+/).filter(k => k);
    if (keywords.length === 0) return [];

    if (this.pool) {
      try {
        // 动态构建 SQL
        const conditions = keywords.map(() => 'c.content LIKE ?').join(' AND ');
        const params = [...keywords.map(k => `%${k}%`), limit];

        const sql = `SELECT c.id as chunk_id, c.document_id, c.content, c.metadata, d.title as document_title
           FROM knowledge_chunks c
           JOIN knowledge_documents d ON c.document_id = d.id
           WHERE ${conditions}
           LIMIT ?`;

        const [rows] = await this.pool.execute(sql, params);

        return (rows as any[]).map(row => ({
          chunkId: row.chunk_id,
          documentId: row.document_id,
          documentTitle: row.document_title,
          content: row.content,
          score: 1.0,
          metadata: row.metadata ? JSON.parse(row.metadata) : {},
        }));
      } catch (error: any) {
        console.error('[RAG] 全文检索失败:', error.message);
        return [];
      }
    } else {
      // 内存模式搜索
      const results: SearchResult[] = [];
      const lowerKeywords = keywords.map(k => k.toLowerCase());

      const docs = this.knowledgeBase.getAllDocuments();
      for (const doc of docs) {
        if (doc.chunks) {
          for (const chunk of doc.chunks) {
            const contentLower = chunk.content.toLowerCase();
            // 必须包含所有关键词
            if (lowerKeywords.every(k => contentLower.includes(k))) {
              results.push({
                chunkId: chunk.id,
                documentId: doc.id,
                documentTitle: doc.title,
                content: chunk.content,
                score: 1.0,
                metadata: chunk.metadata || {},
              });
              if (results.length >= limit) break;
            }
          }
        }
        if (results.length >= limit) break;
      }
      return results;
    }
  }

  // 检索相关上下文
  async retrieve(query: string, topK: number = 5, categoryId?: string, documentId?: string): Promise<RAGContext> {
    // 1. 向量检索
    const queryEmbedding = await this.embeddingService.embed(query);
    const queryDimension = queryEmbedding.length;

    console.log(`[RAG.retrieve] 查询向量维度: ${queryDimension}`);

    let vectorResults: VectorSearchResult[];

    if (documentId) {
      // 按文档ID检索
      const allResults = this.vectorStore.search(queryEmbedding, topK * 2, 0.5);
      vectorResults = allResults.filter(r => r.documentId === documentId).slice(0, topK);
    } else if (categoryId) {
      // 按分类检索
      const categoryDocs = this.knowledgeBase.getDocumentsByCategory(categoryId);
      const categoryDocIds = new Set(categoryDocs.map(d => d.id));
      const allResults = this.vectorStore.search(queryEmbedding, topK * 2, 0.5);
      vectorResults = allResults.filter(r => categoryDocIds.has(r.documentId)).slice(0, topK);
    } else {
      // 全部检索
      vectorResults = this.vectorStore.search(queryEmbedding, topK, 0.5);
    }

    // 统计不同维度的向量
    const dimensions = this.vectorStore.getDimensions();
    if (dimensions.length > 1) {
      console.warn(`[RAG.retrieve] 向量存储包含多种维度: ${dimensions.join(', ')}`);
      console.warn(`[RAG.retrieve] 当前查询使用 ${queryDimension} 维，只匹配相同维度的向量`);
    }

    console.log(`[RAG.retrieve] 找到 ${vectorResults.length} 个相关片段 (查询维度: ${queryDimension})`);

    // 2. 图谱检索
    const keywords = this.documentProcessor.extractKeywords(query, 5);
    const graphResult = this.knowledgeGraph.querySubgraph(keywords, 10);

    // 3. 收集来源信息
    const sourceIds = new Set<string>();
    const sources: { documentId: string; title: string; type: string; content?: string }[] = [];

    for (const result of vectorResults) {
      if (!sourceIds.has(result.documentId)) {
        sourceIds.add(result.documentId);
        const doc = this.knowledgeBase.getDocument(result.documentId);
        if (doc) {
          sources.push({
            documentId: doc.id,
            title: doc.title,
            type: doc.type,
            content: result.chunk.content,
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
  async answer(query: string, additionalContext?: string, categoryId?: string, documentId?: string): Promise<RAGResponse> {
    // 检索上下文
    const context = await this.retrieve(query, 5, categoryId, documentId);

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

### 回答要求：
1. **内容优先**：优先整合知识库中的信息回答，不足时可结合你的知识补充。
2. **结构清晰**：请使用 Markdown 格式，合理使用**粗体**、列表等增强可读性。
3. **格式规范**：
   - 避免直接复制“相关度”或内部评分信息。
   - 不要大段堆砌文字，关键点分条陈述。
4. **诚实原则**：如果无法回答，请直接说明。
5. **引用来源**：在回答末尾可简要列出参考的文档标题。`
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
      sources: context.sources,
    };
  }

  // 生成大纲
  async generateOutline(topic: string, categoryId?: string): Promise<any> {
    const context = await this.retrieve(topic, 5, categoryId);
    let contextText = '';
    if (context.chunks.length > 0) {
      contextText += '### 参考知识:\n';
      context.chunks.forEach(c => contextText += `- ${c.chunk.content.substring(0, 200)}...\n`);
    }

    const messages = [
      {
        role: 'system', content: `你是一个专业的写作助手。请根据用户的主题和参考知识，生成一个结构化的文章大纲。
返回格式必须是合法的 JSON 数组，每个元素包含 "title" (章节标题) 和 "description" (内容简述)。
例如: [{"title": "引言", "description": "背景介绍..."}, {"title": "核心观点", "description": "..."}]` },
      { role: 'user', content: `主题: ${topic}\n\n${contextText}\n\n请生成大纲:` }
    ];

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: messages as any,
      response_format: { type: "json_object" }, // 如果模型支持 JSON 模式
      temperature: 0.7,
    });

    const content = response.choices[0].message.content || '[]';
    try {
      // 尝试解析 JSON，兼容模型可能返回 { "outline": [...] } 或直接 [...]
      const json = JSON.parse(content);
      return Array.isArray(json) ? json : (json.outline || json.chapters || []);
    } catch (e) {
      console.error('解析大纲 JSON 失败', e);
      return [];
    }
  }

  // 生成章节内容
  async generateSection(topic: string, sectionTitle: string, sectionDesc: string, contextOps?: { categoryId?: string, fullContext?: string }): Promise<string> {
    // 针对该章节单独检索
    const query = `${topic} ${sectionTitle} ${sectionDesc}`;
    const context = await this.retrieve(query, 5, contextOps?.categoryId);

    let contextText = '';
    if (context.chunks.length > 0) {
      contextText += context.chunks.map(c => c.chunk.content).join('\n\n');
    }

    // 系统 Prompt
    const messages = [
      {
        role: 'system', content: `你是一个专业的文章撰写人。请根据主题、章节标题、大纲描述和参考资料，撰写这一章节的内容。
要求：
1. 内容详实，逻辑清晰。
2. 必须基于参考资料，如果资料不足可以合理推演但需符合逻辑。
3. 使用 Markdown 格式。
4. 直接输出内容，不要包含"好的"等客套话。` },
      {
        role: 'user', content: `文章主题: ${topic}
章节标题: ${sectionTitle}
章节要求: ${sectionDesc}

### 参考资料:
${contextText}

请撰写本章节内容:` }
    ];

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: messages as any,
      temperature: 0.7,
      stream: false // 分段生成暂不流式，直接返回完整段落
    });

    return response.choices[0].message.content || '';
  }

  // 混合问答：结合数据源查询和知识库
  async hybridAnswer(
    query: string,
    dataSourceContext?: { sql?: string; data?: any[]; schema?: any[] },
    categoryId?: string,
    documentId?: string
  ): Promise<RAGResponse> {
    let additionalContext = '';

    if (dataSourceContext) {
      if (dataSourceContext.sql) {
        additionalContext += `执行的SQL: ${dataSourceContext.sql}\n`;
      }
      if (dataSourceContext.data && dataSourceContext.data.length > 0) {
        additionalContext += `查询结果(${dataSourceContext.data.length}条):\n${JSON.stringify(dataSourceContext.data.slice(0, 100), null, 2)}\n`;
      }
    }

    return this.answer(query, additionalContext, categoryId, documentId);
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
    // 从数据库删除
    if (this.pool) {
      try {
        await this.pool.execute(
          `DELETE FROM knowledge_chunks WHERE document_id = ?`,
          [documentId]
        );
        await this.pool.execute(
          `DELETE FROM knowledge_documents WHERE id = ?`,
          [documentId]
        );
        console.log(`[RAG] 文档已从数据库删除: ${documentId}`);
      } catch (error: any) {
        console.error('[RAG] 从数据库删除文档失败:', error.message);
      }
    }

    // 删除向量
    this.vectorStore.deleteDocumentVectors(documentId);
    // 删除文档
    return this.knowledgeBase.deleteDocument(documentId);
  }

  // 从数据库加载文档
  async loadFromDatabase(): Promise<void> {
    if (!this.pool) {
      console.log('[RAG] 未提供数据库连接池，跳过加载');
      return;
    }

    try {
      console.log('[RAG] 开始从数据库加载文档...');
      console.log('[RAG] 安全模式: On');

      // 加载文档
      const [docRows] = await this.pool.execute(
        `SELECT * FROM knowledge_documents WHERE user_id = ?`,
        [this.userId]
      );

      const docs = docRows as any[];
      console.log(`[RAG] 找到 ${docs.length} 个文档`);

      for (const docRow of docs) {
        // 添加文档到知识库
        const doc = this.knowledgeBase.addDocument({
          userId: docRow.user_id,
          type: docRow.type,
          title: docRow.title,
          content: docRow.content,
          metadata: this.safeJsonParse(docRow.metadata, {}),
        });

        // 加载分块
        const [chunkRows] = await this.pool.execute(
          `SELECT * FROM knowledge_chunks WHERE document_id = ? ORDER BY chunk_index`,
          [docRow.id]
        );

        const chunks = chunkRows as any[];
        console.log(`[RAG] 文档 ${docRow.title} 有 ${chunks.length} 个分块`);

        for (const chunkRow of chunks) {
          const chunk = {
            id: chunkRow.id,
            documentId: docRow.id,
            index: chunkRow.chunk_index,
            chunkIndex: chunkRow.chunk_index,
            content: chunkRow.content,
            startOffset: 0,
            endOffset: chunkRow.content.length,
            embedding: this.safeJsonParse(chunkRow.embedding, []),
            metadata: this.safeJsonParse(chunkRow.metadata, {}),
          };

          // 添加到向量存储
          if (chunk.embedding && chunk.embedding.length > 0) {
            this.vectorStore.addVector(chunk, chunk.embedding);
          }

          // 添加到文档的chunks
          if (!doc.chunks) {
            doc.chunks = [];
          }
          doc.chunks.push(chunk);
        }

        // 更新文档
        this.knowledgeBase.updateDocument(doc.id, { chunks: doc.chunks });
      }

      console.log('[RAG] 从数据库加载文档完成');
    } catch (error: any) {
      console.error('[RAG] 从数据库加载文档失败:', error.message);
      console.error('[RAG] 错误堆栈:', error.stack);
    }
  }

  // 安全解析 JSON
  private safeJsonParse(jsonStr: any, defaultValue: any = {}): any {
    if (!jsonStr) return defaultValue;
    if (typeof jsonStr !== 'string') return jsonStr;
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      console.warn(`[RAG] JSON解析失败: ${jsonStr.substring(0, 50)}...`, e);
      return defaultValue;
    }
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
