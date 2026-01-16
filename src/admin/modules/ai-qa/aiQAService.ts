/**
 * AI Q&A 服务
 * 封装现有 AI 问答功能，提供统一的服务接口
 */

import { v4 as uuidv4 } from 'uuid';
import { createDataSource, BaseDataSource } from '../../../datasource';
import { AIAgent, skillRegistry, mcpRegistry, AgentResponse } from '../../../agent';
import { RAGEngine } from '../../../rag';
import { DataSourceConfig, TableSchema } from '../../../types';
import { ConfigStore, ChatSession, ChatMessage, SchemaAnalysis } from '../../../store/configStore';
import { aiConfigService } from '../ai/aiConfigService';
import { dataMasking } from '../../../services/dataMasking';

// 数据源实例缓存
interface DataSourceInstance {
  config: DataSourceConfig;
  instance: BaseDataSource;
}

export class AIQAService {
  private dataSources: Map<string, DataSourceInstance> = new Map();
  private ragEngines: Map<string, RAGEngine> = new Map();
  private configStore: ConfigStore;
  private aiAgent: AIAgent | null = null;

  constructor() {
    this.configStore = new ConfigStore();
  }

  /**
   * 初始化服务
   */
  async init(): Promise<void> {
    await this.configStore.init();
    await this.configStore.initChatTable();
    await this.configStore.initSchemaAnalysisTable();
    await this.initAIAgent();
    await this.loadDataSources();
  }

  /**
   * 初始化 AI Agent（使用管理框架的 AI 配置）
   */
  private async initAIAgent(): Promise<void> {
    const defaultProvider = await aiConfigService.getDefaultProvider();
    
    if (defaultProvider) {
      this.aiAgent = new AIAgent(
        defaultProvider.apiKey,
        defaultProvider.apiEndpoint,
        defaultProvider.model
      );
      console.log(`AI Agent initialized with provider: ${defaultProvider.name}`);
    } else {
      const apiKey = process.env.SILICONFLOW_API_KEY || 
                     process.env.QWEN_API_KEY || 
                     process.env.OPENAI_API_KEY || '';
      const baseURL = process.env.SILICONFLOW_BASE_URL ||
                      process.env.QWEN_BASE_URL || 
                      process.env.OPENAI_BASE_URL;
      const model = process.env.SILICONFLOW_API_KEY ? 'Qwen/Qwen3-32B' :
                    process.env.QWEN_API_KEY ? 'qwen-plus' : 
                    (process.env.OPENAI_MODEL || 'gpt-4o');
      
      this.aiAgent = new AIAgent(apiKey, baseURL, model);
      console.log('AI Agent initialized with env config');
    }
  }

  async reloadAIAgent(): Promise<void> {
    await this.initAIAgent();
  }

  private async loadDataSources(): Promise<void> {
    const configs = await this.configStore.getAll();
    for (const config of configs) {
      try {
        const instance = createDataSource(config);
        this.dataSources.set(config.id, { config, instance });
        console.log(`Loaded datasource: ${config.name}`);
      } catch (e: any) {
        console.error(`Failed to load datasource ${config.name}:`, e.message);
      }
    }
  }

  getAIAgent(): AIAgent {
    if (!this.aiAgent) {
      throw new Error('AI Agent not initialized');
    }
    return this.aiAgent;
  }

  // Check if user can access datasource
  private canAccessDataSource(ds: DataSourceInstance, userId: string): boolean {
    // 用户自己的数据源
    if (ds.config.userId === userId) return true;
    // 公共且已审核通过的数据源
    if (ds.config.visibility === 'public' && ds.config.approvalStatus === 'approved') return true;
    // 没有设置 userId 的数据源（兼容旧数据）
    if (!ds.config.userId) return true;
    return false;
  }

  // ==================== 知识库分类管理 ====================
  
  private categories: Map<string, { id: string; name: string; description?: string; userId: string; createdAt: number }> = new Map();

  getCategories(userId: string): Array<{ id: string; name: string; description?: string; documentCount: number }> {
    const userCategories = Array.from(this.categories.values())
      .filter(cat => cat.userId === userId);
    
    // 统计每个分类下的数据源数量
    return userCategories.map(cat => {
      const dsCount = Array.from(this.dataSources.values())
        .filter(ds => (ds.config as any).categoryId === cat.id).length;
      return {
        id: cat.id,
        name: cat.name,
        description: cat.description,
        documentCount: dsCount
      };
    });
  }

  createCategory(name: string, description: string | undefined, userId: string): { id: string; name: string; description?: string } {
    const id = uuidv4();
    const category = { id, name, description, userId, createdAt: Date.now() };
    this.categories.set(id, category);
    return { id, name, description };
  }

  updateCategory(id: string, data: { name?: string; description?: string }, userId: string): boolean {
    const category = this.categories.get(id);
    if (!category || category.userId !== userId) return false;
    if (data.name) category.name = data.name;
    if (data.description !== undefined) category.description = data.description;
    return true;
  }

  deleteCategory(id: string, userId: string): boolean {
    const category = this.categories.get(id);
    if (!category || category.userId !== userId) return false;
    this.categories.delete(id);
    return true;
  }

  // ==================== Datasource Management ====================

  async getUserDataSources(userId: string): Promise<Array<{
    id: string;
    name: string;
    type: string;
    host?: string;
    categoryId?: string;
    visibility?: string;
  }>> {
    // 返回用户自己的数据源 + 公共且已审核通过的数据源
    return Array.from(this.dataSources.entries())
      .filter(([, { config }]) => {
        // 用户自己的数据源
        if (config.userId === userId) return true;
        // 公共且已审核通过的数据源
        if (config.visibility === 'public' && config.approvalStatus === 'approved') return true;
        // 没有设置 userId 的数据源（兼容旧数据）
        if (!config.userId) return true;
        return false;
      })
      .map(([id, { config }]) => ({
        id,
        name: config.name,
        type: config.type,
        host: (config.config as any).host || (config.config as any).url || (config.config as any).path,
        categoryId: (config as any).categoryId,
        visibility: config.visibility,
      }));
  }

  async getDataSourceDetail(id: string, userId: string): Promise<DataSourceConfig | null> {
    const ds = this.dataSources.get(id);
    if (!ds) return null;
    if (!this.canAccessDataSource(ds, userId)) return null;
    return ds.config;
  }

  async createDataSource(config: Omit<DataSourceConfig, 'id'>, userId: string): Promise<DataSourceConfig> {
    const fullConfig: DataSourceConfig = { ...config, id: uuidv4(), userId };
    const instance = createDataSource(fullConfig);
    await instance.testConnection();
    await this.configStore.save(fullConfig);
    this.dataSources.set(fullConfig.id, { config: fullConfig, instance });
    return fullConfig;
  }

  async updateDataSource(id: string, updates: Partial<DataSourceConfig>, userId: string): Promise<DataSourceConfig> {
    const ds = this.dataSources.get(id);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      throw new Error('Datasource not found or access denied');
    }
    const newConfig: DataSourceConfig = { ...ds.config, ...updates, id, userId: ds.config.userId || userId };
    const instance = createDataSource(newConfig);
    await instance.testConnection();
    await ds.instance.disconnect();
    await this.configStore.save(newConfig);
    this.dataSources.set(id, { config: newConfig, instance });
    return newConfig;
  }

  async deleteDataSource(id: string, userId: string): Promise<void> {
    const ds = this.dataSources.get(id);
    if (ds && !this.canAccessDataSource(ds, userId)) {
      throw new Error('Access denied');
    }
    if (ds) {
      await ds.instance.disconnect();
      await this.configStore.delete(id);
      await this.configStore.deleteSchemaAnalysis(id, userId);
      this.dataSources.delete(id);
    }
  }

  async testDataSourceConnection(config: Partial<DataSourceConfig>, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const testConfig: DataSourceConfig = { ...config as DataSourceConfig, id: 'test', userId };
      const instance = createDataSource(testConfig);
      await instance.testConnection();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async testExistingConnection(id: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const ds = this.dataSources.get(id);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      return { success: false, error: 'Datasource not found or access denied' };
    }
    try {
      await ds.instance.testConnection();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }


  // ==================== Schema Analysis ====================

  async getSchema(id: string, userId: string): Promise<TableSchema[]> {
    const ds = this.dataSources.get(id);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      throw new Error('Datasource not found or access denied');
    }
    return ds.instance.getSchema();
  }

  async analyzeSchema(id: string, userId: string, forceRefresh = false): Promise<SchemaAnalysis & { cached: boolean }> {
    const ds = this.dataSources.get(id);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      throw new Error('Datasource not found or access denied');
    }

    if (!forceRefresh) {
      const cached = await this.configStore.getSchemaAnalysis(id, userId);
      if (cached) return { ...cached, cached: true };
    }

    const schema = await ds.instance.getSchema();
    const analysis = await this.getAIAgent().analyzeSchema(schema);

    const result: SchemaAnalysis = {
      datasourceId: id,
      tables: analysis.tables,
      suggestedQuestions: analysis.suggestedQuestions,
      analyzedAt: Date.now(),
      updatedAt: Date.now(),
      isUserEdited: false,
    };
    await this.configStore.saveSchemaAnalysis(result, userId);
    return { ...result, cached: false };
  }

  async updateTableAnalysis(datasourceId: string, tableName: string, updates: { tableNameCn?: string; description?: string }, userId: string): Promise<boolean> {
    const ds = this.dataSources.get(datasourceId);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      throw new Error('Datasource not found or access denied');
    }
    return this.configStore.updateTableAnalysis(datasourceId, tableName, updates, userId);
  }

  async updateColumnAnalysis(datasourceId: string, tableName: string, columnName: string, updates: { nameCn?: string; description?: string }, userId: string): Promise<boolean> {
    const ds = this.dataSources.get(datasourceId);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      throw new Error('Datasource not found or access denied');
    }
    return this.configStore.updateColumnAnalysis(datasourceId, tableName, columnName, updates, userId);
  }

  async updateSuggestedQuestions(datasourceId: string, questions: string[], userId: string): Promise<boolean> {
    const ds = this.dataSources.get(datasourceId);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      throw new Error('Datasource not found or access denied');
    }
    return this.configStore.updateSuggestedQuestions(datasourceId, questions, userId);
  }

  // ==================== AI Q&A ====================

  async ask(datasourceId: string, question: string, sessionId: string | undefined, userId: string): Promise<AgentResponse & { sessionId: string }> {
    const ds = this.dataSources.get(datasourceId);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      throw new Error('Datasource not found or access denied');
    }

    let session: ChatSession;
    if (sessionId) {
      const existing = await this.configStore.getChatSession(sessionId, userId);
      session = existing || { id: sessionId, datasourceId, messages: [], createdAt: Date.now() };
    } else {
      session = { id: uuidv4(), datasourceId, messages: [], createdAt: Date.now() };
    }

    const response = await this.getAIAgent().answer(question, ds.instance, ds.config.type, session.messages);

    let maskedData = response.data;
    let maskedAnswer = response.answer;
    if (response.data && Array.isArray(response.data)) {
      maskedData = dataMasking.maskData(response.data);
    }
    if (response.answer) {
      maskedAnswer = dataMasking.maskText(response.answer);
    }

    session.messages.push({ role: 'user', content: question, timestamp: Date.now() });
    session.messages.push({ role: 'assistant', content: maskedAnswer, sql: response.sql, timestamp: Date.now() });
    await this.configStore.saveChatSession(session, userId);

    return { ...response, answer: maskedAnswer, data: maskedData, sessionId: session.id };
  }

  async executeQuery(datasourceId: string, sql: string, userId: string): Promise<{ success: boolean; data?: any[]; error?: string; rowCount?: number }> {
    const ds = this.dataSources.get(datasourceId);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      throw new Error('Datasource not found or access denied');
    }
    if (!sql.toLowerCase().trim().startsWith('select')) {
      return { success: false, error: 'Only SELECT queries allowed' };
    }
    try {
      const result = await ds.instance.executeQuery(sql);
      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ==================== Session Management ====================

  async getChatSessions(datasourceId: string, userId: string): Promise<Array<{ id: string; preview: string; messageCount: number; createdAt: number }>> {
    const ds = this.dataSources.get(datasourceId);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      throw new Error('Datasource not found or access denied');
    }
    const sessions = await this.configStore.getChatSessions(datasourceId, userId);
    return sessions.map(s => ({
      id: s.id,
      preview: s.messages[0]?.content?.slice(0, 50) || 'New chat',
      messageCount: s.messages.length,
      createdAt: s.createdAt,
    }));
  }

  async getChatSession(sessionId: string, userId: string): Promise<ChatSession | null> {
    return this.configStore.getChatSession(sessionId, userId);
  }

  async deleteChatSession(sessionId: string, userId: string): Promise<void> {
    await this.configStore.deleteChatSession(sessionId, userId);
  }


  // ==================== Agent Skills and Tools ====================

  getSkills(): Array<{ name: string; description: string; parameters?: any }> {
    return skillRegistry.getAll().map(s => ({ name: s.name, description: s.description, parameters: s.parameters }));
  }

  async executeSkill(skillName: string, datasourceId: string, params: Record<string, any>, userId: string): Promise<any> {
    const skill = skillRegistry.get(skillName);
    if (!skill) throw new Error('Skill not found');
    const ds = this.dataSources.get(datasourceId);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      throw new Error('Datasource not found or access denied');
    }
    const schemas = await ds.instance.getSchema();
    return skill.execute(params, { dataSource: ds.instance, schemas, dbType: ds.config.type });
  }

  getMCPTools(): Array<{ server: string; name: string; description: string; inputSchema?: any }> {
    return mcpRegistry.getAllTools().map(({ serverName, tool }) => ({
      server: serverName, name: tool.name, description: tool.description, inputSchema: tool.inputSchema,
    }));
  }

  async callMCPTool(server: string, tool: string, input: any): Promise<any> {
    return mcpRegistry.callTool(server, tool, input);
  }

  getCapabilities(): { skills: Array<{ name: string; description: string }>; mcpTools: Array<{ server: string; name: string; description: string }>; features: string[] } {
    return {
      skills: skillRegistry.getAll().map(s => ({ name: s.name, description: s.description })),
      mcpTools: mcpRegistry.getAllTools().map(({ serverName, tool }) => ({ server: serverName, name: tool.name, description: tool.description })),
      features: ['NL to SQL', 'Intent Recognition', 'Data Analysis', 'Trend Analysis', 'Top N Ranking', 'Data Comparison', 'Anomaly Detection', 'Data Export', 'Math Calculation', 'Date Processing', 'Data Formatting', 'Auto Analysis'],
    };
  }

  // ==================== Auto Analysis ====================

  async autoAnalyze(datasourceId: string, topic: string, userId: string, onProgress?: (step: any) => void): Promise<any> {
    const ds = this.dataSources.get(datasourceId);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      throw new Error('Datasource not found or access denied');
    }
    return this.getAIAgent().autoAnalyze(topic, ds.instance, ds.config.type, onProgress);
  }

  async generateDashboard(datasourceId: string, topic: string, theme: 'light' | 'dark' | 'tech', userId: string): Promise<any> {
    const ds = this.dataSources.get(datasourceId);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      throw new Error('Datasource not found or access denied');
    }
    return this.getAIAgent().generateDashboard(topic, ds.instance, ds.config.type, theme);
  }

  async inspectQuality(datasourceId: string, userId: string, tableNameCn?: string): Promise<{ reports: any[]; markdown: string }> {
    const ds = this.dataSources.get(datasourceId);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      throw new Error('Datasource not found or access denied');
    }
    return this.getAIAgent().inspectQuality(ds.instance, ds.config.type, tableNameCn);
  }

  // ==================== RAG Knowledge Base ====================

  private async getRAGEngine(userId: string): Promise<RAGEngine> {
    if (!this.ragEngines.has(userId)) {
      // 优先使用数据库中的 AI 配置
      const defaultProvider = await aiConfigService.getDefaultProvider();
      
      let apiKey: string;
      let baseURL: string | undefined;
      let model: string;
      let embeddingModel: string;
      
      if (defaultProvider) {
        apiKey = defaultProvider.apiKey;
        baseURL = defaultProvider.apiEndpoint;
        model = defaultProvider.model;
        // 根据 provider 选择 embedding 模型
        embeddingModel = defaultProvider.provider === 'qwen' ? 'text-embedding-v2' : 
                         defaultProvider.provider === 'siliconflow' ? 'BAAI/bge-large-zh-v1.5' :
                         'text-embedding-ada-002';
      } else {
        apiKey = process.env.SILICONFLOW_API_KEY || process.env.QWEN_API_KEY || process.env.OPENAI_API_KEY || '';
        baseURL = process.env.SILICONFLOW_BASE_URL || process.env.QWEN_BASE_URL || process.env.OPENAI_BASE_URL;
        model = process.env.SILICONFLOW_API_KEY ? 'Qwen/Qwen3-32B' : process.env.QWEN_API_KEY ? 'qwen-plus' : 'gpt-4o';
        embeddingModel = process.env.QWEN_API_KEY ? 'text-embedding-v2' : 'text-embedding-ada-002';
      }
      
      const ragEngine = new RAGEngine(apiKey, baseURL, model, embeddingModel);
      this.ragEngines.set(userId, ragEngine);
    }
    return this.ragEngines.get(userId)!;
  }

  getRAGStats(userId: string): any {
    // 同步方法，返回已缓存的引擎统计
    const ragEngine = this.ragEngines.get(userId);
    if (!ragEngine) return { documents: 0, chunks: 0, entities: 0, relations: 0 };
    return ragEngine.getStats();
  }

  getRAGDocuments(userId: string): any[] {
    const ragEngine = this.ragEngines.get(userId);
    if (!ragEngine) return [];
    const docs = ragEngine.getKnowledgeBase().getAllDocuments();
    return docs.map((d: any) => ({ id: d.id, title: d.title, type: d.type, chunks: d.chunks?.length || 0, createdAt: d.metadata?.createdAt, tags: d.metadata?.tags }));
  }

  async addRAGDocument(title: string, content: string, type: string, userId: string, tags?: string[]): Promise<any> {
    const ragEngine = await this.getRAGEngine(userId);
    return ragEngine.addDocument(content, title, type as any, userId, { tags });
  }

  async deleteRAGDocument(docId: string, userId: string): Promise<boolean> {
    const ragEngine = await this.getRAGEngine(userId);
    return ragEngine.deleteDocument(docId);
  }

  async ragAsk(question: string, userId: string, datasourceId?: string): Promise<{ answer: string; confidence: number; sources: any[]; dataContext?: any }> {
    const ragEngine = await this.getRAGEngine(userId);
    let dataContext;
    if (datasourceId) {
      const ds = this.dataSources.get(datasourceId);
      if (ds && this.canAccessDataSource(ds, userId)) {
        try {
          const response = await this.getAIAgent().answer(question, ds.instance, ds.config.type, []);
          dataContext = { sql: response.sql, data: response.data };
        } catch (e) { /* ignore */ }
      }
    }
    const result = await ragEngine.hybridAnswer(question, dataContext);
    return {
      answer: result.answer,
      confidence: result.confidence,
      sources: result.sources,
      dataContext: dataContext ? { sql: dataContext.sql, rowCount: dataContext.data?.length || 0 } : undefined,
    };
  }

  async getKnowledgeGraph(userId: string): Promise<any> {
    const ragEngine = await this.getRAGEngine(userId);
    const graph = ragEngine.getKnowledgeGraph();
    const data = graph.export();
    return {
      entities: data.entities.map((e: any) => ({ id: e.id, name: e.name, nameCn: e.nameCn, type: e.type, description: e.description })),
      relations: data.relations.map((r: any) => ({ id: r.id, source: r.sourceId, target: r.targetId, type: r.type, weight: r.weight })),
      stats: graph.getStats(),
    };
  }

  async querySubgraph(keywords: string[], userId: string, maxEntities = 20): Promise<{ entities: any[]; relations: any[] }> {
    const ragEngine = await this.getRAGEngine(userId);
    const graph = ragEngine.getKnowledgeGraph();
    const result = graph.querySubgraph(keywords, maxEntities);
    return {
      entities: result.entities.map((e: any) => ({ id: e.id, name: e.name, nameCn: e.nameCn, type: e.type })),
      relations: result.relations.map((r: any) => ({ source: r.sourceId, target: r.targetId, type: r.type })),
    };
  }
}

export const aiQAService = new AIQAService();
