/**
 * AI Q&A 服务
 * 封装现有 AI 问答功能，提供统一的服务接口
 */

import { v4 as uuidv4 } from 'uuid';
import { createDataSource, BaseDataSource } from '../../../datasource';
import { AIAgent, skillsRegistry, mcpRegistry, AgentResponse } from '../../../agent';
import { RAGEngine } from '../../../rag';
import { DataSourceConfig, TableSchema } from '../../../types';
import { ConfigStore, ChatSession, ChatMessage, SchemaAnalysis } from '../../../store/configStore';
import { aiConfigService } from '../ai/aiConfigService';
import { dataMasking } from '../../../services/dataMasking';
import { pool } from '../../core/database';

// 数据源实例缓存
interface DataSourceInstance {
  config: DataSourceConfig;
  instance: BaseDataSource;
  name?: string;  // 数据源名称
}

interface ArticleTask {
  id: string;
  userId: string;
  topic: string;
  status: 'pending' | 'queued' | 'generating' | 'completed' | 'failed';
  outline: any[];
  currentChapterIndex: number;
  content: string;
  error?: string;
  categoryId?: string;
  createdAt: number;
  updatedAt: number;
}

export class AIQAService {
  private dataSources: Map<string, DataSourceInstance> = new Map();
  private ragEngines: Map<string, RAGEngine> = new Map();

  // 任务队列管理
  private tasks: Map<string, ArticleTask> = new Map();
  private activeTaskCount = 0;
  private waitingQueue: string[] = [];
  private readonly MAX_CONCURRENT_TASKS = 2; // 最大并发数，防止 OOM
  private readonly MAX_STORED_TASKS = 50;    // 内存中最多保留的任务历史

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
    await this.initKnowledgeCategoriesTable();
    await this.initKnowledgeDocumentsTable();
    await this.initKnowledgeChunksTable();
    await this.initAIAgent();
    await this.loadDataSources();
  }

  /**
   * 初始化知识库分类表
   */
  private async initKnowledgeCategoriesTable(): Promise<void> {
    try {
      await pool.execute(`
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
      // 如果表已存在或其他错误，记录但不抛出
      console.warn('初始化知识库分类表时出错:', error.message);
    }
  }

  /**
   * 初始化知识库文档表
   */
  private async initKnowledgeDocumentsTable(): Promise<void> {
    try {
      await pool.execute(`
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
      const [rows] = await pool.execute(`
        SELECT COLUMN_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'knowledge_documents' 
        AND COLUMN_NAME = 'content'
      `);

      const columns = rows as any[];
      if (columns.length > 0 && columns[0].COLUMN_TYPE === 'text') {
        console.log('[updateKnowledgeDocumentsTableSchema] 检测到 content 字段为 TEXT，正在修改为 LONGTEXT...');
        await pool.execute(`
          ALTER TABLE knowledge_documents 
          MODIFY COLUMN content LONGTEXT NOT NULL
        `);
        console.log('[updateKnowledgeDocumentsTableSchema] content 字段已修改为 LONGTEXT');
      }
    } catch (error: any) {
      console.warn('更新知识库文档表结构时出错:', error.message);
    }
  }

  /**
   * 初始化知识库分块表
   */
  private async initKnowledgeChunksTable(): Promise<void> {
    try {
      await pool.execute(`
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

  async reloadRAGEngine(userId?: string): Promise<void> {
    if (userId) {
      const ragEngine = this.ragEngines.get(userId);
      if (ragEngine) {
        console.log(`[reloadRAGEngine] 重新加载用户 ${userId} 的 RAGEngine`);
        this.ragEngines.delete(userId);
        await this.getRAGEngine(userId);
      }
    } else {
      console.log(`[reloadRAGEngine] 清空所有 RAGEngine 缓存`);
      this.ragEngines.clear();
    }
  }

  private async loadDataSources(): Promise<void> {
    const configs = await this.configStore.getAll();
    for (const config of configs) {
      try {
        const instance = createDataSource(config);
        this.dataSources.set(config.id, { config, instance, name: config.name });
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

  async getCategories(userId: string): Promise<Array<{ id: string; name: string; description?: string; documentCount: number }>> {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM knowledge_categories WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      ) as any[];

      // 统计每个分类下的文档数量（从 RAG 文档元数据中统计）
      const categories = await Promise.all(rows.map(async (cat: any) => {
        // 查询该分类下的文档数量
        let documentCount = 0;
        try {
          // 从 RAG 引擎中统计该分类的文档数
          const ragEngine = this.ragEngines.get(userId);
          if (ragEngine) {
            const knowledgeBase = ragEngine.getKnowledgeBase();
            const documents = knowledgeBase.getAllDocuments();
            documentCount = documents.filter((doc: any) => doc.metadata?.categoryId === cat.id).length;
          }
        } catch (error) {
          // 忽略统计错误
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

  async createCategory(name: string, description: string | undefined, userId: string): Promise<{ id: string; name: string; description?: string }> {
    if (!userId) {
      throw new Error('用户ID不能为空');
    }
    const id = uuidv4();
    try {
      console.log('[createCategory] 准备插入数据库:', { id, userId, name, description });
      await pool.execute(
        'INSERT INTO knowledge_categories (id, user_id, name, description) VALUES (?, ?, ?, ?)',
        [id, userId, name, description || null]
      );
      console.log('[createCategory] 插入成功');
      return { id, name, description };
    } catch (error: any) {
      console.error('[createCategory] 创建知识库分类失败:', error);
      console.error('[createCategory] 错误详情:', {
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
        message: error.message
      });
      // 提供更友好的错误信息
      if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_NO_REFERENCED_ROW') {
        throw new Error(`创建分类失败: 用户不存在 (userId: ${userId})`);
      }
      throw new Error(`创建分类失败: ${error.message || error.sqlMessage || '未知错误'}`);
    }
  }

  async updateCategory(id: string, data: { name?: string; description?: string }, userId: string): Promise<boolean> {
    try {
      // 先检查分类是否存在且属于该用户
      const [rows] = await pool.execute(
        'SELECT id FROM knowledge_categories WHERE id = ? AND user_id = ?',
        [id, userId]
      ) as any[];

      if (rows.length === 0) {
        return false;
      }

      // 构建更新语句
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

      if (updates.length === 0) {
        return true; // 没有需要更新的字段
      }

      values.push(id, userId);
      await pool.execute(
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
      const [result] = await pool.execute(
        'DELETE FROM knowledge_categories WHERE id = ? AND user_id = ?',
        [id, userId]
      ) as any[];

      return result.affectedRows > 0;
    } catch (error: any) {
      console.error('删除知识库分类失败:', error);
      return false;
    }
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
    this.dataSources.set(fullConfig.id, { config: fullConfig, instance, name: fullConfig.name });
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
    this.dataSources.set(id, { config: newConfig, instance, name: newConfig.name });
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
      throw new Error('数据源不存在或无权访问');
    }
    try {
      return await ds.instance.getSchema();
    } catch (error: any) {
      // 提供更友好的错误信息
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

  async ask(datasourceId: string, question: string, sessionId: string | undefined, userId: string): Promise<AgentResponse & { sessionId: string; ragContext?: { used: boolean; sources?: string[] } }> {
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

    // 1. 尝试从缓存的 Schema 分析中获取上下文（减少 token）
    let schemaContext: string | undefined;
    try {
      const cachedAnalysis = await this.configStore.getSchemaAnalysis(datasourceId, userId);
      if (cachedAnalysis && cachedAnalysis.tables) {
        // 使用缓存的中文表名和字段描述，而不是原始 schema
        schemaContext = this.buildSchemaContextFromAnalysis(cachedAnalysis);
        console.log('[RAG] Using cached schema analysis, context length:', schemaContext.length);
      }
    } catch (e) {
      console.log('[RAG] No cached schema analysis available');
    }

    // 2. 查询 RAG 知识库获取相关上下文
    let ragContext: { used: boolean; sources?: string[]; context?: string } = { used: false };
    try {
      const ragEngine = this.ragEngines.get(userId);
      if (ragEngine) {
        const ragResult = await ragEngine.retrieve(question, 3);
        if (ragResult.chunks.length > 0) {
          // 构建 RAG 上下文（只取高相关度的）
          const relevantChunks = ragResult.chunks.filter(c => c.score > 0.6);
          if (relevantChunks.length > 0) {
            ragContext = {
              used: true,
              sources: ragResult.sources.map(s => s.title),
              context: relevantChunks.map(c => c.chunk.content).join('\n\n')
            };
            console.log('[RAG] Found relevant knowledge, chunks:', relevantChunks.length);
          }
        }
      }
    } catch (e: any) {
      console.log('[RAG] Knowledge retrieval skipped:', e.message);
    }

    // 3. 调用 AI Agent（传入优化后的上下文）
    const response = await this.getAIAgent().answerWithContext(
      question,
      ds.instance,
      ds.config.type,
      session.messages,
      {
        schemaContext,
        ragContext: ragContext.context
      }
    );

    let maskedData = response.data;
    let maskedAnswer = response.answer;
    if (response.data && Array.isArray(response.data)) {
      maskedData = dataMasking.maskData(response.data);
    }
    if (response.answer) {
      maskedAnswer = dataMasking.maskText(response.answer);
    }

    session.messages.push({ role: 'user', content: question, timestamp: Date.now() });
    session.messages.push({
      role: 'assistant',
      content: maskedAnswer,
      sql: response.sql,
      chart: response.chart,
      charts: response.charts,
      data: maskedData,
      timestamp: Date.now()
    });
    await this.configStore.saveChatSession(session, userId);

    return {
      ...response,
      answer: maskedAnswer,
      data: maskedData,
      sessionId: session.id,
      ragContext: ragContext.used ? { used: true, sources: ragContext.sources } : { used: false }
    };
  }

  // 从缓存的 Schema 分析构建精简上下文
  private buildSchemaContextFromAnalysis(analysis: SchemaAnalysis): string {
    if (!analysis.tables || analysis.tables.length === 0) return '';

    const lines: string[] = [];
    for (const table of analysis.tables) {
      const tableName = table.tableNameCn || table.tableName;
      const cols = table.columns
        .slice(0, 1000) // 支持超宽表解析
        .map(c => `${c.nameCn || c.name}(${c.name})`)
        .join(',');
      lines.push(`${tableName}(${table.tableName}):${cols}`);
    }
    return lines.join('\n');
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

  // 更新消息配置（用于持久化图表定制，如翻译）
  async updateChatMessageConfig(sessionId: string, messageIndex: number, config: any, userId: string): Promise<boolean> {
    const session = await this.configStore.getChatSession(sessionId, userId);
    if (!session || !session.messages[messageIndex]) return false;

    session.messages[messageIndex].chartConfig = {
      ...(session.messages[messageIndex].chartConfig || {}),
      ...config
    };

    await this.configStore.saveChatSession(session, userId);
    return true;
  }


  // ==================== Agent Skills and Tools ====================

  getSkills(): Array<{ name: string; description: string; parameters?: any }> {
    return skillsRegistry.getAll().map(s => ({ name: s.name, description: s.description, parameters: s.parameters }));
  }

  async executeSkill(skillName: string, datasourceId: string, params: Record<string, any>, userId: string): Promise<any> {
    const skill = skillsRegistry.get(skillName);
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
      skills: skillsRegistry.getAll().map(s => ({ name: s.name, description: s.description })),
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
      const activeConfigs = await aiConfigService.getActiveConfigsByPriority();

      let embeddingConfigs: { apiKey: string; baseURL?: string; model: string; provider?: string }[];
      let apiKey: string;
      let baseURL: string | undefined;
      let model: string;

      if (activeConfigs && activeConfigs.length > 0) {
        const embeddingModels = activeConfigs.map(config => {
          // 确定嵌入模型
          let embeddingModel = config.embeddingModel || 'text-embedding-ada-002';

          if (!config.embeddingModel) {
            if (config.provider === 'qwen' || config.name?.toLowerCase().includes('qwen') || config.model?.toLowerCase().includes('qwen')) {
              // 通义千问系列模型 (包括本地部署)
              embeddingModel = 'text-embedding-v2';
            } else if (config.provider === 'siliconflow') {
              // SiliconFlow 模型
              embeddingModel = 'BAAI/bge-large-zh-v1.5';
            }
          }

          return {
            apiKey: config.apiKey || '',  // 支持空 API Key
            baseURL: config.baseUrl,
            model: embeddingModel,
            provider: config.provider
          };
        });

        const dimensions: Record<string, number> = {
          'text-embedding-ada-002': 1536,
          'text-embedding-3-small': 1536,
          'text-embedding-3-large': 3072,
          'text-embedding-v1': 1024,
          'text-embedding-v2': 1536,
          'BAAI/bge-large-zh-v1.5': 1024,
        };

        const uniqueDimensions = new Set(embeddingModels.map(m => dimensions[m.model] || 1536));

        if (uniqueDimensions.size > 1) {
          console.warn('[getRAGEngine] 检测到不同向量维度的嵌入模型:');
          embeddingModels.forEach(m => {
            console.warn(`  - ${m.model} (${m.provider}): ${dimensions[m.model] || 1536} 维`);
          });
          console.warn('[getRAGEngine] 系统将支持多维度向量共存，不同维度的文档可以同时存在');
        } else {
          console.log(`[getRAGEngine] 所有嵌入模型使用相同维度: ${Array.from(uniqueDimensions)[0]}`);
        }

        embeddingConfigs = embeddingModels;

        const firstConfig = activeConfigs[0];
        apiKey = firstConfig.apiKey || '';  // 支持空 API Key
        baseURL = firstConfig.baseUrl;
        model = firstConfig.model;

        console.log(`[getRAGEngine] 使用 ${embeddingConfigs.length} 个 AI 配置作为备用模型`);
      } else {
        apiKey = process.env.SILICONFLOW_API_KEY || process.env.QWEN_API_KEY || process.env.OPENAI_API_KEY || '';
        baseURL = process.env.SILICONFLOW_BASE_URL || process.env.QWEN_BASE_URL || process.env.OPENAI_BASE_URL;
        model = process.env.SILICONFLOW_API_KEY ? 'Qwen/Qwen3-32B' : process.env.QWEN_API_KEY ? 'qwen-plus' : 'gpt-4o';

        embeddingConfigs = [{
          apiKey,
          baseURL,
          model: process.env.QWEN_API_KEY ? 'text-embedding-v2' : 'text-embedding-ada-002',
          provider: 'env'
        }];

        console.log('[getRAGEngine] 使用环境变量配置（无备用模型）');
      }

      const ragEngine = new RAGEngine(embeddingConfigs, baseURL, model, undefined, userId, pool);
      await ragEngine.loadFromDatabase();
      this.ragEngines.set(userId, ragEngine);
    }
    return this.ragEngines.get(userId)!;
  }

  async getRAGStats(userId: string): Promise<any> {
    const ragEngine = await this.getRAGEngine(userId);
    return ragEngine.getStats();
  }

  async getRAGDocuments(userId: string, page: number = 1, pageSize: number = 10, categoryId?: string, keyword?: string): Promise<{ items: any[], total: number }> {
    const ragEngine = await this.getRAGEngine(userId);
    let docs = ragEngine.getKnowledgeBase().getAllDocuments();

    // 1. 过滤
    if (categoryId && categoryId !== 'all') {
      docs = docs.filter((d: any) => d.metadata?.categoryId === categoryId);
    }

    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      docs = docs.filter((d: any) => d.title.toLowerCase().includes(lowerKeyword));
    }

    // 2. 排序 (默认按创建时间倒序)
    docs.sort((a: any, b: any) => (b.metadata?.createdAt || 0) - (a.metadata?.createdAt || 0));

    const total = docs.length;

    // 3. 分页
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const items = docs.slice(start, end).map((d: any) => ({
      id: d.id,
      title: d.title,
      type: d.type,
      chunks: d.chunks?.length || 0,
      // content: d.content, // 列表页不返回内容，减少传输量
      createdAt: d.metadata?.createdAt,
      updatedAt: d.metadata?.updatedAt,
      tags: d.metadata?.tags,
      categoryId: d.metadata?.categoryId,
      datasourceId: d.metadata?.datasourceId,
      datasourceName: d.metadata?.datasourceId ? this.dataSources.get(d.metadata.datasourceId)?.name : undefined
    }));

    return { items, total };
  }

  async getRAGDocument(userId: string, documentId: string): Promise<any> {
    const ragEngine = await this.getRAGEngine(userId);
    const doc = ragEngine.getKnowledgeBase().getDocument(documentId);
    if (!doc) {
      throw new Error('Document not found');
    }
    return {
      id: doc.id,
      title: doc.title,
      type: doc.type,
      content: doc.content, // 详情页返回完整内容
      chunks: doc.chunks?.length || 0,
      metadata: doc.metadata,
      categoryId: doc.metadata?.categoryId,
      tags: doc.metadata?.tags,
      createdAt: doc.metadata?.createdAt,
      updatedAt: doc.metadata?.updatedAt
    };
  }

  async addRAGDocument(title: string, content: string, type: string, userId: string, tags?: string[], categoryId?: string, datasourceId?: string): Promise<any> {
    if (!userId) {
      throw new Error('用户ID不能为空');
    }
    try {
      console.log('[addRAGDocument] 准备添加文档:', { title, contentLength: content.length, userId, categoryId });
      const ragEngine = await this.getRAGEngine(userId);
      const result = await ragEngine.addDocument(content, title, type as any, userId, { tags, categoryId, datasourceId });
      console.log('[addRAGDocument] 文档添加成功:', { docId: result.id, chunksCount: result.chunks?.length || 0 });
      return result;
    } catch (error: any) {
      console.error('[addRAGDocument] 添加文档失败:', error);
      console.error('[addRAGDocument] 错误堆栈:', error.stack);
      throw new Error(`添加文档到知识库失败: ${error.message}`);
    }
  }

  async deleteRAGDocument(docId: string, userId: string): Promise<boolean> {
    const ragEngine = await this.getRAGEngine(userId);
    return ragEngine.deleteDocument(docId);
  }

  async ragAsk(
    question: string,
    userId: string,
    datasourceId?: string,
    categoryId?: string,
    documentId?: string
  ): Promise<{ answer: string; confidence: number; sources: any[]; dataContext?: any }> {
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
    const result = await ragEngine.hybridAnswer(question, dataContext, categoryId, documentId);
    return {
      answer: result.answer,
      confidence: result.confidence,
      sources: result.sources,
      dataContext: dataContext ? { sql: dataContext.sql, rowCount: dataContext.data?.length || 0 } : undefined,
    };
  }

  // 生成大纲
  async generateOutline(userId: string, topic: string, categoryId?: string): Promise<any> {
    const ragEngine = await this.getRAGEngine(userId);
    return ragEngine.generateOutline(topic, categoryId);
  }

  // 生成章节
  async generateSection(userId: string, topic: string, sectionTitle: string, sectionDesc: string, categoryId?: string): Promise<string> {
    const ragEngine = await this.getRAGEngine(userId);
    return ragEngine.generateSection(topic, sectionTitle, sectionDesc, { categoryId });
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

  // 全文检索
  async searchKnowledgeBase(query: string, userId: string, limit: number = 20) {
    const ragEngine = await this.getRAGEngine(userId);
    return ragEngine.searchChunks(query, limit);
  }

  // 将数据源 Schema 分析导入知识库（减少 token 使用的关键功能）
  async importSchemaToRAG(datasourceId: string, userId: string): Promise<{ docId: string; chunksCount: number; datasourceName: string }> {
    const ds = this.dataSources.get(datasourceId);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      throw new Error('Datasource not found or access denied');
    }

    // 获取缓存的 Schema 分析
    const cachedAnalysis = await this.configStore.getSchemaAnalysis(datasourceId, userId);
    if (!cachedAnalysis || !cachedAnalysis.tables) {
      throw new Error('请先对数据源进行 Schema 分析');
    }

    // 构建知识文档内容
    const datasourceName = ds.config.name;
    let content = `# 数据源: ${datasourceName}\n\n`;
    content += `## 数据结构说明\n\n`;

    for (const table of cachedAnalysis.tables) {
      const tableName = table.tableNameCn || table.tableName;
      content += `### ${tableName} (${table.tableName})\n\n`;

      if (table.description) {
        content += `${table.description}\n\n`;
      }

      content += `| 字段名 | 中文名 | 类型 | 说明 |\n`;
      content += `|--------|--------|------|------|\n`;

      for (const col of table.columns) {
        const colName = col.name;
        const colNameCn = col.nameCn || col.name;
        const colType = col.type || '';
        const colDesc = col.description || '';
        content += `| ${colName} | ${colNameCn} | ${colType} | ${colDesc} |\n`;
      }
      content += `\n`;
    }

    // 添加推荐问题
    if (cachedAnalysis.suggestedQuestions && cachedAnalysis.suggestedQuestions.length > 0) {
      content += `## 常见问题示例\n\n`;
      for (const q of cachedAnalysis.suggestedQuestions) {
        content += `- ${q}\n`;
      }
    }

    // 添加到知识库
    const ragEngine = await this.getRAGEngine(userId);
    const doc = await ragEngine.addDocument(
      content,
      `数据源结构: ${datasourceName}`,
      'datasource',
      userId,
      {
        datasourceId,
        datasourceName,
        tags: ['数据源', datasourceName, 'Schema']
      }
    );

    console.log(`[RAG] Imported schema for ${datasourceName}, chunks: ${doc.chunks?.length || 0}`);

    return {
      docId: doc.id,
      chunksCount: doc.chunks?.length || 0,
      datasourceName
    };
    return {
      docId: doc.id,
      chunksCount: doc.chunks?.length || 0,
      datasourceName
    };
  }

  // ------------------------- 异步任务系统 -------------------------

  /**
   * 提交后台长文生成任务
   */
  async submitArticleTask(userId: string, topic: string, outline: any[], categoryId?: string): Promise<string> {
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

    // 异步触发后台处理
    this.processArticleTask(taskId, categoryId).catch(err => {
      console.error(`[AsyncTask] Task ${taskId} failed unhandled:`, err);
    });

    return taskId;
  }

  /**
   * 获取任务状态
   */
  getArticleTask(taskId: string): ArticleTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 后台处理循环
   */
  private async processArticleTask(taskId: string, categoryId?: string) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    try {
      console.log(`[AsyncTask] Start processing task ${taskId}: ${task.topic}`);
      task.status = 'generating';
      task.updatedAt = Date.now();

      const ragEngine = await this.getRAGEngine(task.userId);

      // 逐章生成
      for (let i = 0; i < task.outline.length; i++) {
        const chapter = task.outline[i];
        task.currentChapterIndex = i;
        task.updatedAt = Date.now();
        console.log(`[AsyncTask ${taskId}] Generating chapter ${i + 1}/${task.outline.length}: ${chapter.title}`);

        try {
          // 调用 RAG Engine 生成单章
          const sectionContent = await ragEngine.generateSection(
            task.topic,
            chapter.title,
            chapter.description,
            { categoryId }
          );

          // 拼接到总内容
          task.content += `## ${chapter.title}\n\n${sectionContent}\n\n`;

          // 模拟一点延迟，避免对 LLM 请求过于密集
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (sectionError: any) {
          console.error(`[AsyncTask ${taskId}] Chapter ${chapter.title} failed:`, sectionError);
          task.content += `## ${chapter.title}\n\n(生成失败: ${sectionError.message})\n\n`;
          // 继续生成下一章，不中断整个任务
        }
      }

      task.status = 'completed';
      task.updatedAt = Date.now();
      console.log(`[AsyncTask] Task ${taskId} completed.`);

    } catch (error: any) {
      console.error(`[AsyncTask] Task ${taskId} failed globally:`, error);
      task.status = 'failed';
      task.error = error.message;
      task.updatedAt = Date.now();
    }
  }
}


export const aiQAService = new AIQAService();
