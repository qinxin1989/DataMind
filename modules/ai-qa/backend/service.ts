/**
 * AI Q&A 服务
 * 封装AI问答、知识库管理、数据源管理等功能
 */

import { v4 as uuidv4 } from 'uuid';
import { PoolConnection } from 'mysql2/promise';
import { createDataSource, BaseDataSource } from '../../../src/datasource';
import { AIAgent, skillsRegistry, mcpRegistry, AgentResponse } from '../../../src/agent';
import { RAGEngine } from '../../rag-service/backend/ragEngine';
import { ConfigStore, ChatSession, ChatMessage, SchemaAnalysis } from '../../../src/store/configStore';
import { dataMasking } from '../../../src/services/dataMasking';
import { dataSourceManager } from '../../datasource-management/backend/manager';
import { ragManager } from '../../rag-service/backend/manager';
import type {
  DataSourceConfig,
  TableSchema,
  KnowledgeCategory,
  KnowledgeDocument,
  RAGDocument,
  RAGStats,
  ArticleTask,
  OutlineChapter,
  Skill,
  MCPTool,
  AskResponse,
  QueryResult,
  RAGAskResponse,
  KnowledgeGraph
} from './types';

// 数据源实例缓存
interface DataSourceInstance {
  config: DataSourceConfig;
  instance: BaseDataSource;
  name?: string;
}

export class AIQAService {
  private configStore: ConfigStore;
  private aiAgent: AIAgent | null = null;
  private tasks: Map<string, ArticleTask> = new Map();
  private activeTaskCount = 0;
  private waitingQueue: string[] = [];
  private readonly MAX_CONCURRENT_TASKS = 2;
  private readonly MAX_STORED_TASKS = 50;

  constructor(private db: any) {
    this.configStore = new ConfigStore();
  }

  /**
   * 初始化服务
   */
  async init(): Promise<void> {
    await this.configStore.init();
    await this.configStore.initChatTable();
    await this.configStore.initSchemaAnalysisTable();
    await this.initKnowledgeChunksTable();
    await this.initAIAgent();
  }

  // ==================== 数据库表初始化 ====================

  private async initKnowledgeCategoriesTable(): Promise<void> {
    try {
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS knowledge_categories (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          name VARCHAR(100) NOT NULL,
          description VARCHAR(500),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_user (user_id),
          INDEX idx_name (name),
          FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    } catch (error: any) {
      console.warn('初始化知识库分类表时出错:', error.message);
    }
  }

  private async initKnowledgeDocumentsTable(): Promise<void> {
    try {
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS knowledge_documents (
          id VARCHAR(36) PRIMARY KEY,
          knowledge_base_id VARCHAR(36) NOT NULL,
          user_id VARCHAR(36) NOT NULL,
          type VARCHAR(20) NOT NULL,
          title VARCHAR(255) NOT NULL,
          content LONGTEXT NOT NULL,
          metadata JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_knowledge_base (knowledge_base_id),
          INDEX idx_user (user_id),
          INDEX idx_type (type),
          FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await this.updateKnowledgeDocumentsTableSchema();
    } catch (error: any) {
      console.warn('初始化知识库文档表时出错:', error.message);
    }
  }

  private async updateKnowledgeDocumentsTableSchema(): Promise<void> {
    try {
      const [rows] = await this.db.execute(`
        SELECT COLUMN_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'knowledge_documents' 
        AND COLUMN_NAME = 'content'
      `);
      const columns = rows as any[];
      if (columns.length > 0 && columns[0].COLUMN_TYPE === 'text') {
        await this.db.execute(`
          ALTER TABLE knowledge_documents 
          MODIFY COLUMN content LONGTEXT NOT NULL
        `);
      }
    } catch (error: any) {
      console.warn('更新知识库文档表结构时出错:', error.message);
    }
  }

  private async initKnowledgeChunksTable(): Promise<void> {
    try {
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS knowledge_chunks (
          id VARCHAR(36) PRIMARY KEY,
          document_id VARCHAR(36) NOT NULL,
          chunk_index INT NOT NULL,
          content TEXT NOT NULL,
          embedding JSON NOT NULL,
          metadata JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_document (document_id),
          INDEX idx_chunk_index (chunk_index),
          FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    } catch (error: any) {
      console.warn('初始化知识库分块表时出错:', error.message);
    }
  }

  // ==================== AI Agent 初始化 ====================

  private async initAIAgent(): Promise<void> {
    try {
      const { AIConfigService } = await import('../../ai-config/backend/service');
      const aiConfigService = new AIConfigService(this.db);

      this.aiAgent = new AIAgent();
      this.aiAgent.setConfigGetter(async () => {
        try {
          const configs = await aiConfigService.getActiveConfigsByPriority();
          if (!configs || configs.length === 0) {
            console.warn('[AIQAService] 没有可用的激活 AI 配置');
            return [];
          }
          return configs.map(c => ({
            apiKey: c.apiKey,
            baseURL: c.baseUrl,
            model: c.model,
            name: c.name
          }));
        } catch (err: any) {
          console.error('[AIQAService] 获取 AI 配置失败:', err.message);
          return [];
        }
      });
      console.log('[AIQAService] AIAgent 已配置为动态获取配置模式');
    } catch (error: any) {
      console.warn('[AIQAService] AIConfigService 不可用，降级到环境变量:', error.message);
      const apiKey = process.env.SILICONFLOW_API_KEY || process.env.QWEN_API_KEY || process.env.OPENAI_API_KEY || '';
      const baseURL = process.env.SILICONFLOW_BASE_URL || process.env.QWEN_BASE_URL || process.env.OPENAI_BASE_URL;
      const model = process.env.SILICONFLOW_API_KEY ? 'Qwen/Qwen3-32B' : process.env.QWEN_API_KEY ? 'qwen-plus' : 'gpt-4o';
      this.aiAgent = new AIAgent(apiKey, baseURL, model);
    }
  }

  async reloadAIAgent(): Promise<void> {
    try {
      await this.initAIAgent();
    } catch (error) {
      console.warn('[ai-qa] Failed to reload AI agent:', error);
    }
  }

  async reloadRAGEngine(userId?: string): Promise<void> {
    if (userId) {
      ragManager.remove(userId);
      await this.getRAGEngine(userId);
    } else {
      ragManager.clear();
    }
  }

  getAIAgent(): AIAgent {
    if (!this.aiAgent) {
      // 这里的兜底是为了防止 getAIAgent 在 init 完成前被调用
      this.aiAgent = new AIAgent();
      this.initAIAgent().catch(err => console.error('[AIQAService] 异步初始化 AIAgent 失败:', err));
    }
    return this.aiAgent;
  }

  private canAccessDataSource(ds: { config: DataSourceConfig }, userId: string): boolean {
    if (ds.config.userId === userId) return true;
    if (ds.config.visibility === 'public' && ds.config.approvalStatus === 'approved') return true;
    if (!ds.config.userId) return true;
    return false;
  }

  // ==================== 知识库分类管理 ====================

  async getCategories(userId: string): Promise<KnowledgeCategory[]> {
    try {
      const [rows] = await this.db.execute(
        'SELECT * FROM knowledge_categories WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      ) as any[];
      const categories = await Promise.all(rows.map(async (cat: any) => {
        let documentCount = 0;
        try {
          const ragEngine = ragManager.get(userId);
          if (ragEngine) {
            const knowledgeBase = ragEngine.getKnowledgeBase();
            const documents = knowledgeBase.getAllDocuments();
            documentCount = documents.filter((doc: any) => doc.metadata?.categoryId === cat.id).length;
          }
        } catch (error) {
          // ignore
        }
        return {
          id: cat.id,
          name: cat.name,
          description: cat.description || undefined,
          documentCount
        };
      }));
      return categories;
    } catch (error: any) {
      console.error('获取知识库分类失败:', error);
      return [];
    }
  }

  async createCategory(name: string, description: string | undefined, userId: string): Promise<KnowledgeCategory> {
    if (!userId) {
      throw new Error('用户ID不能为空');
    }
    const id = uuidv4();
    try {
      await this.db.execute(
        'INSERT INTO knowledge_categories (id, user_id, name, description) VALUES (?, ?, ?, ?)',
        [id, userId, name, description || null]
      );
      return { id, name, description, documentCount: 0 };
    } catch (error: any) {
      if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_NO_REFERENCED_ROW') {
        throw new Error(`创建分类失败: 用户不存在 (userId: ${userId})`);
      }
      throw new Error(`创建分类失败: ${error.message || error.sqlMessage || '未知错误'}`);
    }
  }

  async updateCategory(id: string, data: { name?: string; description?: string }, userId: string): Promise<boolean> {
    try {
      const [rows] = await this.db.execute(
        'SELECT id FROM knowledge_categories WHERE id = ? AND user_id = ?',
        [id, userId]
      ) as any[];
      if (rows.length === 0) return false;

      const updates: string[] = [];
      const values: any[] = [];
      if (data.name !== undefined) {
        updates.push('name = ?');
        values.push(data.name);
      }
      if (data.description !== undefined) {
        updates.push('description = ?');
        values.push(data.description || null);
      }
      if (updates.length === 0) return true;

      values.push(id, userId);
      await this.db.execute(
        `UPDATE knowledge_categories SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
        values
      );
      return true;
    } catch (error: any) {
      console.error('更新知识库分类失败:', error);
      return false;
    }
  }

  async deleteCategory(id: string, userId: string): Promise<boolean> {
    try {
      const [result] = await this.db.execute(
        'DELETE FROM knowledge_categories WHERE id = ? AND user_id = ?',
        [id, userId]
      ) as any[];
      return result.affectedRows > 0;
    } catch (error: any) {
      console.error('删除知识库分类失败:', error);
      return false;
    }
  }

  // ==================== 数据源管理 ====================

  async getUserDataSources(userId: string): Promise<Array<{
    id: string;
    name: string;
    type: string;
    host?: string;
    categoryId?: string;
    visibility?: string;
  }>> {
    return Array.from(dataSourceManager.entries())
      .filter(([, { config }]) => {
        if (config.userId === userId) return true;
        if (config.visibility === 'public' && config.approvalStatus === 'approved') return true;
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
    const ds = dataSourceManager.get(id);
    if (!ds) return null;
    if (!this.canAccessDataSource(ds, userId)) return null;
    return ds.config;
  }

  async createDataSource(config: Omit<DataSourceConfig, 'id'>, userId: string): Promise<DataSourceConfig> {
    const fullConfig: DataSourceConfig = { ...config, id: uuidv4(), userId };
    await dataSourceManager.register(fullConfig);
    await this.configStore.save(fullConfig);
    return fullConfig;
  }

  async updateDataSource(id: string, updates: Partial<DataSourceConfig>, userId: string): Promise<DataSourceConfig> {
    const ds = dataSourceManager.get(id);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      throw new Error('Datasource not found or access denied');
    }
    const newConfig: DataSourceConfig = { ...ds.config, ...updates, id, userId: ds.config.userId || userId };
    await dataSourceManager.register(newConfig as any);
    await this.configStore.save(newConfig);
    return newConfig;
  }

  async deleteDataSource(id: string, userId: string): Promise<void> {
    const ds = dataSourceManager.get(id);
    if (ds && !this.canAccessDataSource(ds, userId)) {
      throw new Error('Access denied');
    }
    if (ds) {
      await dataSourceManager.remove(id);
      await this.configStore.delete(id);
      await this.configStore.deleteSchemaAnalysis(id, userId);
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
    const ds = dataSourceManager.get(id);
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

  // ==================== Schema 分析 ====================

  async getSchema(id: string, userId: string): Promise<TableSchema[]> {
    const ds = dataSourceManager.get(id);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      throw new Error('数据源不存在或无权访问');
    }
    try {
      return await ds.instance.getSchema();
    } catch (error: any) {
      const errorMsg = error.message || '未知错误';
      if (errorMsg.includes('password authentication failed')) {
        throw new Error('数据库连接失败：用户名或密码错误');
      } else if (errorMsg.includes('ECONNREFUSED')) {
        throw new Error('数据库连接失败：无法连接到服务器，请检查主机和端口');
      } else if (errorMsg.includes('ETIMEDOUT')) {
        throw new Error('数据库连接失败：连接超时');
      } else if (errorMsg.includes('does not exist')) {
        throw new Error('数据库连接失败：数据库不存在');
      }
      throw new Error(`数据库连接失败：${errorMsg}`);
    }
  }

  async analyzeSchema(id: string, userId: string, forceRefresh = false): Promise<SchemaAnalysis & { cached: boolean }> {
    const ds = dataSourceManager.get(id);
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
    const ds = dataSourceManager.get(datasourceId);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      throw new Error('Datasource not found or access denied');
    }
    return this.configStore.updateTableAnalysis(datasourceId, tableName, updates, userId);
  }

  async updateColumnAnalysis(datasourceId: string, tableName: string, columnName: string, updates: { nameCn?: string; description?: string }, userId: string): Promise<boolean> {
    const ds = dataSourceManager.get(datasourceId);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      throw new Error('Datasource not found or access denied');
    }
    return this.configStore.updateColumnAnalysis(datasourceId, tableName, columnName, updates, userId);
  }

  async updateSuggestedQuestions(datasourceId: string, questions: string[], userId: string): Promise<boolean> {
    const ds = dataSourceManager.get(datasourceId);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      throw new Error('Datasource not found or access denied');
    }
    return this.configStore.updateSuggestedQuestions(datasourceId, questions, userId);
  }

  // ==================== AI 问答 ====================

  async ask(datasourceId: string, question: string, sessionId: string | undefined, userId: string): Promise<AskResponse> {
    // 记录用户问题
    console.log(`\n========== 用户提问 [${new Date().toLocaleString()}] ==========`);
    console.log(`👤 用户: ${userId}`);
    console.log(`📊 数据源: ${datasourceId}`);
    console.log(`❓ 问题: ${question}`);
    console.log(`💬 会话ID: ${sessionId || '新会话'}`);
    
    const ds = dataSourceManager.get(datasourceId);
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

    // 尝试从缓存的 Schema 分析中获取上下文
    let schemaContext: string | undefined;
    try {
      const cachedAnalysis = await this.configStore.getSchemaAnalysis(datasourceId, userId);
      if (cachedAnalysis && cachedAnalysis.tables) {
        schemaContext = this.buildSchemaContextFromAnalysis(cachedAnalysis);
      }
    } catch (e) {
      // ignore
    }

    // 注意：RAG 知识库是独立功能，数据源问答不查询 RAG
    // RAG 问答使用 ragAsk 方法

    // 调用 AI Agent
    console.log(`🤖 正在调用 AI Agent...`);
    const response = await this.getAIAgent().answerWithContext(
      question,
      ds.instance,
      ds.config.type,
      session.messages,
      { schemaContext }
    );
    
    // 记录AI响应
    console.log(`\n========== AI 响应 ==========`);
    console.log(`💡 完整回答 (${response.answer?.length || 0} 字符):`);
    console.log(response.answer || '(无回答)');
    if (response.sql) {
      console.log(`\n🔍 生成的SQL:`);
      console.log(response.sql);
    }
    if (response.data && Array.isArray(response.data)) {
      console.log(`\n📈 返回数据: ${response.data.length} 行`);
    }
    if (response.tokensUsed) {
      console.log(`\n💰 Token消耗: ${response.tokensUsed}`);
    }
    console.log(`========== 响应结束 ==========\n`);
    

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

    return {
      ...response,
      answer: maskedAnswer,
      data: maskedData,
      sessionId: session.id
    };
  }

  private buildSchemaContextFromAnalysis(analysis: SchemaAnalysis): string {
    if (!analysis.tables || analysis.tables.length === 0) return '';
    const lines: string[] = [];
    for (const table of analysis.tables) {
      const tableName = table.tableNameCn || table.tableName;
      const cols = table.columns
        .slice(0, 1000)
        .map(c => `${c.nameCn || c.name}(${c.name})`)
        .join(',');
      lines.push(`${tableName}(${table.tableName}):${cols}`);
    }
    return lines.join('\n');
  }

  async executeQuery(datasourceId: string, sql: string, userId: string): Promise<QueryResult> {
    const ds = dataSourceManager.get(datasourceId);
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

  // ==================== 会话管理 ====================

  async getChatSessions(datasourceId: string, userId: string): Promise<Array<{ id: string; preview: string; messageCount: number; createdAt: number }>> {
    const ds = dataSourceManager.get(datasourceId);
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

  async getChatSession(sessionId: string, userId: string, options?: { limit?: number; offset?: number }): Promise<(ChatSession & { totalMessages?: number; hasMore?: boolean }) | null> {
    return this.configStore.getChatSession(sessionId, userId, options);
  }

  async deleteChatSession(sessionId: string, userId: string): Promise<void> {
    await this.configStore.deleteChatSession(sessionId, userId);
  }

  async updateMessageChartConfig(sessionId: string, messageIndex: number, config: any, userId: string): Promise<boolean> {
    const session = await this.configStore.getChatSession(sessionId, userId);
    if (!session || !session.messages[messageIndex]) {
      return false;
    }
    
    // 更新消息的 chartConfig
    const message = session.messages[messageIndex];
    message.chartConfig = { ...(message.chartConfig || {}), ...config };
    
    // 保存会话
    await this.configStore.saveChatSession(session, userId);
    return true;
  }

  // ==================== Agent 技能和工具 ====================

  getSkills(): Skill[] {
    return skillsRegistry.getAll().map(s => ({ name: s.name, description: s.description, parameters: s.parameters }));
  }

  async executeSkill(skillName: string, datasourceId: string, params: Record<string, any>, userId: string): Promise<any> {
    const skill = skillsRegistry.get(skillName);
    if (!skill) throw new Error('Skill not found');
    const ds = dataSourceManager.get(datasourceId);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      throw new Error('Datasource not found or access denied');
    }
    const schemas = await ds.instance.getSchema();
    return skill.execute(params, { dataSource: ds.instance, schemas, dbType: ds.config.type as any });
  }

  getMCPTools(): MCPTool[] {
    return mcpRegistry.getAllTools().map(({ serverName, tool }) => ({
      server: serverName, name: tool.name, description: tool.description, inputSchema: tool.inputSchema,
    }));
  }

  async callMCPTool(server: string, tool: string, input: any): Promise<any> {
    return mcpRegistry.callTool(server, tool, input);
  }

  getCapabilities(): { skills: Skill[]; mcpTools: MCPTool[]; features: string[] } {
    return {
      skills: skillsRegistry.getAll().map(s => ({ name: s.name, description: s.description })),
      mcpTools: mcpRegistry.getAllTools().map(({ serverName, tool }) => ({ server: serverName, name: tool.name, description: tool.description })),
      features: ['NL to SQL', 'Intent Recognition', 'Data Analysis', 'Trend Analysis', 'Top N Ranking', 'Data Comparison', 'Anomaly Detection', 'Data Export', 'Math Calculation', 'Date Processing', 'Data Formatting', 'Auto Analysis'],
    };
  }

  // ==================== 自动分析 ====================

  async autoAnalyze(datasourceId: string, topic: string, userId: string, onProgress?: (step: any) => void): Promise<any> {
    const ds = dataSourceManager.get(datasourceId);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      throw new Error('Datasource not found or access denied');
    }
    return this.getAIAgent().autoAnalyze(topic, ds.instance, ds.config.type as any, onProgress);
  }

  async generateDashboard(datasourceId: string, topic: string, theme: 'light' | 'dark' | 'tech', userId: string): Promise<any> {
    const ds = dataSourceManager.get(datasourceId);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      throw new Error('Datasource not found or access denied');
    }
    return this.getAIAgent().generateDashboard(topic, ds.instance, ds.config.type as any, theme);
  }

  async inspectQuality(datasourceId: string, userId: string, tableNameCn?: string): Promise<{ reports: any[]; markdown: string }> {
    const ds = dataSourceManager.get(datasourceId);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      throw new Error('Datasource not found or access denied');
    }
    return this.getAIAgent().inspectQuality(ds.instance, ds.config.type as any, tableNameCn);
  }

  // ==================== RAG 知识库 ====================

  private async getRAGEngine(userId: string): Promise<RAGEngine> {
    const engine = ragManager.get(userId);
    if (!engine) {
      let activeConfigs: any[] = [];
      try {
        const { AIConfigService } = await import('../../ai-config/backend/service');
        const aiConfigService = new AIConfigService(this.db);
        activeConfigs = await aiConfigService.getActiveConfigsByPriority();
      } catch (error) {
        // ai-config module not available
      }

      const ragEngine = await ragManager.getOrCreate(userId, activeConfigs, this.db);
      if (!ragEngine) {
        throw new Error('无法初始化 RAG 引擎：缺少配置');
      }
      return ragEngine;
    }
    return engine;
  }

  async searchKnowledge(query: string, userId: string): Promise<KnowledgeDocument[]> {
    const ragEngine = await this.getRAGEngine(userId);
    const results = await ragEngine.retrieve(query, 5);
    return results.chunks.map(c => ({
      id: c.chunk.id,
      title: (c.chunk.metadata as any)?.title || '知识片段',
      type: 'chunk',
      content: c.chunk.content,
      chunks: 0
    }));
  }

  async getRAGStats(userId: string): Promise<RAGStats> {
    const ragEngine = await this.getRAGEngine(userId);
    const stats = ragEngine.getStats();
    return {
      totalDocuments: stats.documents,
      totalChunks: stats.chunks,
      totalTokens: 0,
      categories: []
    } as any;
  }

  async getRAGDocuments(userId: string, page: number = 1, pageSize: number = 10, categoryId?: string, keyword?: string): Promise<{ items: RAGDocument[], total: number }> {
    const ragEngine = await this.getRAGEngine(userId);
    let docs = ragEngine.getKnowledgeBase().getAllDocuments();

    if (categoryId && categoryId !== 'all') {
      docs = docs.filter((d: any) => d.metadata?.categoryId === categoryId);
    }
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      docs = docs.filter((d: any) => d.title.toLowerCase().includes(lowerKeyword));
    }

    docs.sort((a: any, b: any) => (b.metadata?.createdAt || 0) - (a.metadata?.createdAt || 0));
    const total = docs.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const items = docs.slice(start, end).map((d: any) => ({
      id: d.id,
      title: d.title,
      type: d.type,
      chunks: d.chunks?.length || 0,
      createdAt: (d.metadata as any)?.createdAt,
      updatedAt: (d.metadata as any)?.updatedAt,
      tags: (d.metadata as any)?.tags,
      categoryId: (d.metadata as any)?.categoryId,
      datasourceId: (d.metadata as any)?.datasourceId,
      datasourceName: (d.metadata as any)?.datasourceId ? dataSourceManager.get((d.metadata as any).datasourceId)?.config.name : undefined
    }));

    return { items, total };
  }

  async getRAGDocument(userId: string, documentId: string): Promise<KnowledgeDocument> {
    const ragEngine = await this.getRAGEngine(userId);
    const doc = ragEngine.getKnowledgeBase().getDocument(documentId);
    if (!doc) {
      throw new Error('Document not found');
    }
    return {
      id: doc.id,
      title: doc.title,
      type: doc.type,
      content: doc.content,
      chunks: doc.chunks?.length || 0,
      metadata: doc.metadata
    };
  }

  async addRAGDocument(title: string, content: string, type: string, userId: string, tags?: string[], categoryId?: string, datasourceId?: string): Promise<KnowledgeDocument> {
    if (!userId) {
      throw new Error('用户ID不能为空');
    }
    try {
      const ragEngine = await this.getRAGEngine(userId);
      const result = await ragEngine.addDocument(content, title, type as any, userId, { tags, categoryId, datasourceId });
      return {
        ...result,
        chunks: result.chunks?.length || 0
      };
    } catch (error: any) {
      throw new Error(`添加文档到知识库失败: ${error.message}`);
    }
  }

  async deleteRAGDocument(docId: string, userId: string): Promise<boolean> {
    const ragEngine = await this.getRAGEngine(userId);
    return ragEngine.deleteDocument(docId);
  }

  async ragAsk(question: string, userId: string, datasourceId?: string, categoryId?: string, documentId?: string): Promise<RAGAskResponse> {
    const ragEngine = await this.getRAGEngine(userId);
    let dataContext;
    if (datasourceId) {
      const ds = dataSourceManager.get(datasourceId);
      if (ds && this.canAccessDataSource(ds, userId)) {
        try {
          const response = await this.getAIAgent().answer(question, ds.instance, ds.config.type, []);
          dataContext = { sql: response.sql, data: response.data };
        } catch (e) { /* ignore */ }
      }
    }
    const result = await ragEngine.hybridAnswer(question, dataContext, categoryId, documentId);
    const sources = result.sources.map(s => ({
      id: (s as any).id,
      title: s.title,
      type: s.type,
      relevance: (s as any).relevance || 1.0,
      content: (s as any).content || ''
    }));
    return {
      answer: result.answer,
      confidence: result.confidence,
      sources,
      dataContext: dataContext ? { sql: dataContext.sql, rowCount: dataContext.data?.length || 0 } : undefined,
    };
  }

  async generateOutline(userId: string, topic: string, categoryId?: string): Promise<OutlineChapter[]> {
    const ragEngine = await this.getRAGEngine(userId);
    return ragEngine.generateOutline(topic, categoryId);
  }

  async generateSection(userId: string, topic: string, sectionTitle: string, sectionDesc: string, categoryId?: string): Promise<string> {
    const ragEngine = await this.getRAGEngine(userId);
    return ragEngine.generateSection(topic, sectionTitle, sectionDesc, { categoryId });
  }

  async getKnowledgeGraph(userId: string): Promise<KnowledgeGraph> {
    const ragEngine = await this.getRAGEngine(userId);
    const graph = await ragEngine.getKnowledgeGraph() as any;

    // 假设 graph.entities 和 graph.relations 是 Map 或 Array
    const entities = graph.entities instanceof Map ? Array.from(graph.entities.values()) : graph.entities;
    const relations = graph.relations instanceof Map ? Array.from(graph.relations.values()) : graph.relations;

    return {
      entities: (entities || []).map((e: any) => ({
        id: e.id,
        name: e.name,
        nameCn: e.nameCn,
        type: e.type,
        description: e.description
      })),
      relations: (relations || []).map((r: any) => ({
        id: r.id,
        source: r.sourceId || r.source,
        target: r.targetId || r.target,
        type: r.type,
        weight: r.weight
      })),
      stats: {
        entityCount: entities instanceof Map ? entities.size : (entities?.length || 0),
        relationCount: relations instanceof Map ? relations.size : (relations?.length || 0)
      }
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

  async searchKnowledgeBase(query: string, userId: string, limit: number = 20) {
    const ragEngine = await this.getRAGEngine(userId);
    return ragEngine.searchChunks(query, limit);
  }

  async importSchemaToRAG(datasourceId: string, userId: string): Promise<{ docId: string; chunksCount: number; datasourceName: string }> {
    const ds = dataSourceManager.get(datasourceId);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      throw new Error('Datasource not found or access denied');
    }
    const cachedAnalysis = await this.configStore.getSchemaAnalysis(datasourceId, userId);
    if (!cachedAnalysis || !cachedAnalysis.tables) {
      throw new Error('请先对数据源进行 Schema 分析');
    }

    const datasourceName = ds.config.name;
    let content = `# 数据源: ${datasourceName}\n\n## 数据结构说明\n\n`;
    for (const table of cachedAnalysis.tables) {
      const tableName = table.tableNameCn || table.tableName;
      content += `### ${tableName} (${table.tableName})\n\n`;
      if (table.description) {
        content += `${table.description}\n\n`;
      }
      content += `| 字段名 | 中文名 | 类型 | 说明 |\n|--------|--------|------|------|\n`;
      for (const col of table.columns) {
        content += `| ${col.name} | ${col.nameCn || col.name} | ${col.type || ''} | ${col.description || ''} |\n`;
      }
      content += `\n`;
    }
    if (cachedAnalysis.suggestedQuestions && cachedAnalysis.suggestedQuestions.length > 0) {
      content += `## 常见问题示例\n\n`;
      for (const q of cachedAnalysis.suggestedQuestions) {
        content += `- ${q}\n`;
      }
    }

    const ragEngine = await this.getRAGEngine(userId);
    const doc = await ragEngine.addDocument(
      content,
      `数据源结构: ${datasourceName}`,
      'datasource',
      userId,
      { datasourceId, datasourceName, tags: ['数据源', datasourceName, 'Schema'] }
    );

    return {
      docId: doc.id,
      chunksCount: doc.chunks?.length || 0,
      datasourceName
    };
  }

  // ==================== 异步任务系统 ====================

  async submitArticleTask(userId: string, topic: string, outline: OutlineChapter[], categoryId?: string): Promise<string> {
    const taskId = uuidv4();
    const task: ArticleTask = {
      id: taskId,
      userId,
      topic,
      status: 'pending',
      outline,
      currentChapterIndex: 0,
      content: `# ${topic}\n\n`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.tasks.set(taskId, task);
    this.processArticleTask(taskId, categoryId).catch(err => {
      console.error(`[AsyncTask] Task ${taskId} failed unhandled:`, err);
    });
    return taskId;
  }

  getArticleTask(taskId: string): ArticleTask | undefined {
    return this.tasks.get(taskId);
  }

  private async processArticleTask(taskId: string, categoryId?: string) {
    const task = this.tasks.get(taskId);
    if (!task) return;
    try {
      task.status = 'generating';
      task.updatedAt = Date.now();
      const ragEngine = await this.getRAGEngine(task.userId);
      for (let i = 0; i < task.outline.length; i++) {
        const chapter = task.outline[i];
        task.currentChapterIndex = i;
        task.updatedAt = Date.now();
        try {
          const sectionContent = await ragEngine.generateSection(
            task.topic,
            chapter.title,
            chapter.description,
            { categoryId }
          );
          task.content += `## ${chapter.title}\n\n${sectionContent}\n\n`;
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (sectionError: any) {
          task.content += `## ${chapter.title}\n\n(生成失败: ${sectionError.message})\n\n`;
        }
      }
      task.status = 'completed';
      task.updatedAt = Date.now();
    } catch (error: any) {
      task.status = 'failed';
      task.error = error.message;
      task.updatedAt = Date.now();
    }
  }

  // ==================== 测试辅助 ====================

  async resetDatabase(): Promise<void> {
    await this.db.execute('DELETE FROM knowledge_categories');
    await this.db.execute('DELETE FROM knowledge_documents');
    await this.db.execute('DELETE FROM knowledge_chunks');
    ragManager.clear();
    this.tasks.clear();
  }

  async cleanup() {
    ragManager.clear();
    this.tasks.clear();
  }
}
