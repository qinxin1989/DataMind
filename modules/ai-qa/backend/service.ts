/**
 * AI Q&A 服务
 * 封装AI问答、知识库管理、数据源管理等功能
 */

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { PoolConnection } from 'mysql2/promise';
import { createDataSource, BaseDataSource } from '../../../src/datasource';
import { AIAgent, skillsRegistry, mcpRegistry, AgentResponse } from '../../../src/agent';
import { runAgentLoop, AgentSSEEvent } from '../../../src/agent/agentLoop';
import { RAGEngine } from '../../rag-service/backend/ragEngine';
import { AgenticRetriever } from '../../rag-service/backend/agenticRetriever';
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

const DATA_QA_AGENT_PROFILE = {
  title: '数据智能问答',
  description: '围绕当前数据源执行 SQL、统计分析、图表生成和业务解读。',
  systemPrompt: [
    '你是 DataMind 的数据智能问答助手。',
    '当前入口只负责数据源相关问答、SQL 生成、统计分析、趋势判断、图表与报告说明。',
    '必须优先结合当前 datasourceId、数据表结构和上下文来回答。',
    '没有数据源上下文时，要明确提示用户先选择数据源，不能凭空臆造查询结果。',
    '不要再使用统一助手的“五种业务模式”分流逻辑，也不要把当前问题改写成采集、知识库或文档助手场景。'
  ].join('\n'),
  toolPolicy: {
    allowSql: true,
    allowedSkillPrefixes: [
      'data.',
      'report.',
      'data_analysis.',
      'dataAnalysis.',
      'qa.',
      'excel.'
    ]
  }
};

export class AIQAService {
  private configStore: ConfigStore;
  private aiAgent: AIAgent | null = null;
  private tasks: Map<string, ArticleTask> = new Map();
  private activeTaskCount = 0;
  private waitingQueue: string[] = [];
  private readonly MAX_CONCURRENT_TASKS = 2;
  private readonly MAX_STORED_TASKS = 50;

  private qaJobs: Map<string, {
    id: string;
    userId: string;
    datasourceId: string;
    question: string;
    normalizedQuestion: string;
    sessionId?: string;
    status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
    progress?: string;
    resultId?: string;
    error?: string;
    createdAt: number;
    updatedAt: number;
    cancelRequested: boolean;
    abortController?: AbortController;
  }> = new Map();

  private qaActiveCount = 0;
  private qaWaitingQueue: string[] = [];
  private readonly QA_MAX_CONCURRENT = 2;

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
    await this.initQAResultTables();
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

  private async initQAResultTables(): Promise<void> {
    try {
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS ai_qa_charts (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          datasource_id VARCHAR(36) NOT NULL,
          chart_hash VARCHAR(64) NOT NULL,
          chart_json JSON NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_user_ds_hash (user_id, datasource_id, chart_hash),
          INDEX idx_user_ds (user_id, datasource_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS ai_qa_results (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          datasource_id VARCHAR(36) NOT NULL,
          question TEXT NOT NULL,
          normalized_question TEXT NOT NULL,
          answer LONGTEXT,
          sql_text LONGTEXT,
          result_json JSON,
          chart_id VARCHAR(36) DEFAULT NULL,
          chart_json JSON,
          meta_json JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_user_ds (user_id, datasource_id),
          INDEX idx_ds_normq (datasource_id(36), normalized_question(191)),
          INDEX idx_updated_at (updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS ai_qa_jobs (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          datasource_id VARCHAR(36) NOT NULL,
          question TEXT NOT NULL,
          normalized_question TEXT NOT NULL,
          session_id VARCHAR(36) DEFAULT NULL,
          status VARCHAR(20) NOT NULL,
          progress VARCHAR(255) DEFAULT NULL,
          result_id VARCHAR(36) DEFAULT NULL,
          error TEXT DEFAULT NULL,
          cancel_requested TINYINT(1) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_user_status (user_id, status),
          INDEX idx_ds_normq (datasource_id(36), normalized_question(191))
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    } catch (error: any) {
      console.warn('初始化问答缓存/任务表时出错:', error.message);
    }
  }

  private stableStringify(obj: any): string {
    if (obj === null || obj === undefined) return '';
    if (typeof obj !== 'object') return String(obj);
    if (Array.isArray(obj)) return `[${obj.map(v => this.stableStringify(v)).join(',')}]`;
    const keys = Object.keys(obj).sort();
    const parts = keys.map(k => `${JSON.stringify(k)}:${this.stableStringify(obj[k])}`);
    return `{${parts.join(',')}}`;
  }

  private async upsertChart(userId: string, datasourceId: string, chart: any): Promise<string> {
    const json = this.stableStringify(chart);
    const hash = crypto.createHash('sha256').update(json).digest('hex');

    try {
      const [rows] = await this.db.execute(
        `SELECT id FROM ai_qa_charts WHERE user_id = ? AND datasource_id = ? AND chart_hash = ? LIMIT 1`,
        [userId, datasourceId, hash]
      ) as any[];
      const exist = (rows as any[])[0];
      if (exist?.id) return exist.id;
    } catch {
      // ignore
    }

    const id = uuidv4();
    try {
      await this.db.execute(
        `INSERT INTO ai_qa_charts (id, user_id, datasource_id, chart_hash, chart_json)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
        [id, userId, datasourceId, hash, JSON.stringify(chart)]
      );

      // 若被并发插入打败（命中 duplicate），需要取已存在的 id
      const [rows2] = await this.db.execute(
        `SELECT id FROM ai_qa_charts WHERE user_id = ? AND datasource_id = ? AND chart_hash = ? LIMIT 1`,
        [userId, datasourceId, hash]
      ) as any[];
      const r2 = (rows2 as any[])[0];
      return r2?.id || id;
    } catch {
      return id;
    }
  }

  async getChartById(chartId: string, userId: string): Promise<any | null> {
    try {
      const [rows] = await this.db.execute(
        `SELECT id, user_id, datasource_id, chart_json
         FROM ai_qa_charts
         WHERE id = ?
         LIMIT 1`,
        [chartId]
      ) as any[];
      const r = (rows as any[])[0];
      if (!r) return null;
      if (r.user_id !== userId) return null;
      const chart = r.chart_json ? (typeof r.chart_json === 'string' ? JSON.parse(r.chart_json) : r.chart_json) : undefined;
      return { id: r.id, datasourceId: r.datasource_id, chart };
    } catch {
      return null;
    }
  }

  private normalizeQuestion(question: string): string {
    return (question || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  private async getCachedQAResult(userId: string, datasourceId: string, normalizedQuestion: string): Promise<any | null> {
    try {
      const [rows] = await this.db.execute(
        `SELECT id, answer, sql_text, result_json, chart_id, chart_json, meta_json
         FROM ai_qa_results
         WHERE user_id = ? AND datasource_id = ? AND normalized_question = ?
         ORDER BY updated_at DESC
         LIMIT 1`,
        [userId, datasourceId, normalizedQuestion]
      ) as any[];
      const r = (rows as any[])[0];
      if (!r) return null;

      let chart: any = undefined;
      if (r.chart_id) {
        const c = await this.getChartById(r.chart_id, userId);
        chart = c?.chart;
      } else {
        chart = r.chart_json ? (typeof r.chart_json === 'string' ? JSON.parse(r.chart_json) : r.chart_json) : undefined;
      }

      return {
        id: r.id,
        answer: r.answer,
        sql: r.sql_text,
        data: r.result_json ? (typeof r.result_json === 'string' ? JSON.parse(r.result_json) : r.result_json) : undefined,
        chartId: r.chart_id || undefined,
        chart,
        meta: r.meta_json ? (typeof r.meta_json === 'string' ? JSON.parse(r.meta_json) : r.meta_json) : undefined,
      };
    } catch {
      return null;
    }
  }

  private async saveQAResult(params: {
    userId: string;
    datasourceId: string;
    question: string;
    normalizedQuestion: string;
    answer?: string;
    sql?: string;
    data?: any;
    chart?: any;
    meta?: any;
  }): Promise<string> {
    const id = uuidv4();

    const chartId = params.chart ? await this.upsertChart(params.userId, params.datasourceId, params.chart) : null;
    await this.db.execute(
      `INSERT INTO ai_qa_results (id, user_id, datasource_id, question, normalized_question, answer, sql_text, result_json, chart_id, chart_json, meta_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.userId,
        params.datasourceId,
        params.question,
        params.normalizedQuestion,
        params.answer || null,
        params.sql || null,
        params.data ? JSON.stringify(params.data) : null,
        chartId,
        params.chart ? JSON.stringify(params.chart) : null,
        params.meta ? JSON.stringify(params.meta) : null,
      ]
    );
    return id;
  }

  private async getQAResultById(resultId: string): Promise<any | null> {
    try {
      const [rows] = await this.db.execute(
        `SELECT id, user_id, datasource_id, answer, sql_text, result_json, chart_id, chart_json, meta_json
         FROM ai_qa_results
         WHERE id = ?
         LIMIT 1`,
        [resultId]
      ) as any[];
      const r = (rows as any[])[0];
      if (!r) return null;

      let chart: any = undefined;
      if (r.chart_id) {
        const c = await this.getChartById(r.chart_id, r.user_id);
        chart = c?.chart;
      } else {
        chart = r.chart_json ? (typeof r.chart_json === 'string' ? JSON.parse(r.chart_json) : r.chart_json) : undefined;
      }

      return {
        id: r.id,
        userId: r.user_id,
        datasourceId: r.datasource_id,
        answer: r.answer,
        sql: r.sql_text,
        data: r.result_json ? (typeof r.result_json === 'string' ? JSON.parse(r.result_json) : r.result_json) : undefined,
        chartId: r.chart_id || undefined,
        chart,
        meta: r.meta_json ? (typeof r.meta_json === 'string' ? JSON.parse(r.meta_json) : r.meta_json) : undefined,
      };
    } catch {
      return null;
    }
  }

  private async persistJob(job: any): Promise<void> {
    await this.db.execute(
      `INSERT INTO ai_qa_jobs (id, user_id, datasource_id, question, normalized_question, session_id, status, progress, result_id, error, cancel_requested)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         progress = VALUES(progress),
         result_id = VALUES(result_id),
         error = VALUES(error),
         cancel_requested = VALUES(cancel_requested)`,
      [
        job.id,
        job.userId,
        job.datasourceId,
        job.question,
        job.normalizedQuestion,
        job.sessionId || null,
        job.status,
        job.progress || null,
        job.resultId || null,
        job.error || null,
        job.cancelRequested ? 1 : 0,
      ]
    );
  }

  /**
   * 问答：优先命中缓存，否则提交后台任务生成（前端可轮询/取消）
   */
  async askCached(datasourceId: string, question: string, sessionId: string | undefined, userId: string): Promise<{ hit: boolean; jobId?: string; result?: AskResponse }> {
    const normalizedQuestion = this.normalizeQuestion(question);
    const cached = await this.getCachedQAResult(userId, datasourceId, normalizedQuestion);
    if (cached) {
      return {
        hit: true,
        result: {
          answer: cached.answer,
          sql: cached.sql,
          data: cached.data,
          chart: cached.chart,
          sessionId: sessionId || uuidv4(),
          skillUsed: cached.meta?.skillUsed,
          toolUsed: cached.meta?.toolUsed,
          visualization: cached.meta?.visualization,
        }
      };
    }

    const jobId = uuidv4();
    const job = {
      id: jobId,
      userId,
      datasourceId,
      question,
      normalizedQuestion,
      sessionId,
      status: 'queued' as const,
      progress: '已进入队列',
      resultId: undefined as string | undefined,
      error: undefined as string | undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      cancelRequested: false,
    };
    this.qaJobs.set(jobId, job);
    await this.persistJob(job);
    this.qaWaitingQueue.push(jobId);
    this.kickoffQAWorkers();
    return { hit: false, jobId };
  }

  getQAJob(jobId: string, userId: string): any {
    const j = this.qaJobs.get(jobId);
    if (j && j.userId === userId) return j;
    return null;
  }

  async getQAJobWithResult(jobId: string, userId: string): Promise<any | null> {
    const j = this.qaJobs.get(jobId);
    if (!j || j.userId !== userId) return null;
    if (j.status !== 'completed' || !j.resultId) return j;
    const r = await this.getQAResultById(j.resultId);
    if (!r || r.userId !== userId) return j;
    return {
      ...j,
      result: {
        answer: r.answer,
        sql: r.sql,
        data: r.data,
        chart: r.chart,
        chartId: r.chartId,
        sessionId: j.sessionId || uuidv4(),
        skillUsed: r.meta?.skillUsed,
        toolUsed: r.meta?.toolUsed,
        visualization: r.meta?.visualization,
      }
    };
  }

  async cancelQAJob(jobId: string, userId: string): Promise<boolean> {
    const j = this.qaJobs.get(jobId);
    if (!j || j.userId !== userId) return false;
    if (j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled') return true;
    
    j.cancelRequested = true;
    j.status = 'cancelled';
    j.progress = '已取消';
    j.updatedAt = Date.now();
    
    // 触发 AbortController 来中止正在进行的调用
    if (j.abortController) {
      console.log(`[AIQAService] 触发任务 ${jobId} 的 AbortController`);
      j.abortController.abort();
    }
    
    await this.persistJob(j);
    return true;
  }

  private kickoffQAWorkers() {
    while (this.qaActiveCount < this.QA_MAX_CONCURRENT && this.qaWaitingQueue.length > 0) {
      const jobId = this.qaWaitingQueue.shift();
      if (!jobId) break;
      const job = this.qaJobs.get(jobId);
      if (!job) continue;
      if (job.cancelRequested) continue;
      this.qaActiveCount++;
      this.processQAJob(jobId).finally(() => {
        this.qaActiveCount--;
        this.kickoffQAWorkers();
      });
    }
  }

  private async processQAJob(jobId: string): Promise<void> {
    const job = this.qaJobs.get(jobId);
    if (!job) return;

    // 创建 AbortController 用于取消
    const abortController = new AbortController();
    job.abortController = abortController;
    const signal = abortController.signal;

    const update = async (patch: Partial<typeof job>) => {
      Object.assign(job, patch);
      job.updatedAt = Date.now();
      await this.persistJob(job);
    };

    try {
      await update({ status: 'running', progress: '准备中...' });
      if (job.cancelRequested || signal.aborted) {
        await update({ status: 'cancelled', progress: '已取消' });
        return;
      }

      const ds = dataSourceManager.get(job.datasourceId);
      if (!ds || !this.canAccessDataSource(ds, job.userId)) {
        await update({ status: 'failed', error: 'Datasource not found or access denied', progress: '失败' });
        return;
      }

      // schema context (可选)
      let schemaContext: string | undefined;
      try {
        const cachedAnalysis = await this.configStore.getSchemaAnalysis(job.datasourceId, job.userId);
        if (cachedAnalysis && cachedAnalysis.tables) {
          schemaContext = this.buildSchemaContextFromAnalysis(cachedAnalysis);
        }
      } catch {
        // ignore
      }

      await update({ progress: '正在生成 SQL / 执行查询 / 生成回答...' });

      // 检查取消状态
      if (job.cancelRequested || signal.aborted) {
        await update({ status: 'cancelled', progress: '已取消' });
        return;
      }

      // 使用支持取消的 answerWithContext 方法
      const response = await this.getAIAgent().answerWithContext(
        job.question,
        ds.instance,
        ds.config.type,
        [],
        { schemaContext, signal }
      );

      if (job.cancelRequested || signal.aborted) {
        await update({ status: 'cancelled', progress: '已取消' });
        return;
      }

      // 存缓存结果
      const maskedData = response.data && Array.isArray(response.data) ? dataMasking.maskData(response.data) : response.data;
      const maskedAnswer = response.answer ? dataMasking.maskText(response.answer) : response.answer;

      const resultId = await this.saveQAResult({
        userId: job.userId,
        datasourceId: job.datasourceId,
        question: job.question,
        normalizedQuestion: job.normalizedQuestion,
        answer: maskedAnswer,
        sql: response.sql,
        data: maskedData,
        chart: response.chart,
        meta: {
          skillUsed: response.skillUsed,
          toolUsed: response.toolUsed,
          visualization: response.visualization,
          tokensUsed: response.tokensUsed,
          modelName: response.modelName,
        },
      });

      await update({ status: 'completed', progress: '已完成', resultId });
    } catch (e: any) {
      // 如果是取消错误，标记为已取消
      if (e.message?.includes('cancelled') || e.message?.includes('aborted')) {
        await update({ status: 'cancelled', progress: '已取消', error: '用户取消' });
      } else {
        await update({ status: 'failed', progress: '失败', error: e.message || String(e) });
      }
    } finally {
      // 清理 AbortController
      job.abortController = undefined;
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
      try {
        await this.getRAGEngine(userId);
      } catch (error) {
        if (!this.isMissingRAGConfigError(error)) {
          throw error;
        }
      }
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
    await dataSourceManager.register(fullConfig as any);
    await this.configStore.save(fullConfig as any);
    return fullConfig;
  }

  async updateDataSource(id: string, updates: Partial<DataSourceConfig>, userId: string): Promise<DataSourceConfig> {
    const ds = dataSourceManager.get(id);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      throw new Error('Datasource not found or access denied');
    }
    const newConfig: DataSourceConfig = { ...ds.config, ...updates, id, userId: ds.config.userId || userId };
    await dataSourceManager.register(newConfig as any);
    await this.configStore.save(newConfig as any);
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
      const instance = createDataSource(testConfig as any);
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
    let response: AgentResponse;
    try {
      response = await this.getAIAgent().answerWithContext(
        question,
        ds.instance,
        ds.config.type,
        session.messages,
        { schemaContext }
      );
    } catch (aiError: any) {
      console.error('AI 调用失败:', aiError);
      const errorMsg = aiError.message || '';
      if (errorMsg.includes('没有可用的 AI 配置') || errorMsg.includes('未配置')) {
        return {
          answer: '⚠️ AI 服务未配置：请在【系统管理 → AI 配置】中配置有效的 AI 服务（如 DashScope、OpenAI 等）',
          sessionId: session.id,
          sql: undefined,
          data: undefined,
          skillUsed: 'none',
          toolUsed: 'none',
          visualization: false
        };
      }
      // 其他 AI 错误，返回具体错误信息
      return {
        answer: `❌ AI 处理失败：${errorMsg}`,
        sessionId: session.id,
        sql: undefined,
        data: undefined,
        skillUsed: 'none',
        toolUsed: 'none',
        visualization: false
      };
    }

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
    session.messages.push({
      role: 'assistant',
      content: maskedAnswer,
      sql: response.sql,
      chart: response.chart,
      charts: response.charts,
      timestamp: Date.now()
    });
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

  /**
   * 流式问答（SSE 模式）
   * 内部调用 runAgentLoop()，通过回调输出 SSE 事件
   * 适用于复杂多步任务（生成报告、文件处理等）
   */
  async askStream(
    datasourceId: string,
    question: string,
    sessionId: string | undefined,
    userId: string,
    onEvent: (event: AgentSSEEvent) => void | Promise<void>
  ): Promise<void> {
    const ds = dataSourceManager.get(datasourceId);
    if (!ds || !this.canAccessDataSource(ds, userId)) {
      throw new Error('Datasource not found or access denied');
    }

    // 获取会话历史
    let history: Array<{ role: string; content: string }> = [];
    if (sessionId) {
      const existing = await this.configStore.getChatSession(sessionId, userId);
      if (existing) {
        history = existing.messages.map(m => ({ role: m.role, content: m.content || '' }));
      }
    }

    // 获取 schema 上下文
    let schemaContext = '';
    try {
      const cachedAnalysis = await this.configStore.getSchemaAnalysis(datasourceId, userId);
      if (cachedAnalysis && cachedAnalysis.tables) {
        schemaContext = this.buildSchemaContextFromAnalysis(cachedAnalysis);
      }
    } catch { /* ignore */ }

    // 获取 OpenAI 实例
    const { openai, model } = await this.getAIAgent().getOpenAIInstance();

    // 调用 Agent Loop
    const result = await runAgentLoop({
      userMessage: question + (schemaContext ? `\n\n[数据源上下文]\n${schemaContext}` : ''),
      history: history as any,
      dataSource: ds.instance,
      dbType: ds.config.type,
      openai,
      model,
      workDir: process.cwd(),
      userId,
      assistantName: DATA_QA_AGENT_PROFILE.title,
      assistantDescription: DATA_QA_AGENT_PROFILE.description,
      extraSystemPrompt: DATA_QA_AGENT_PROFILE.systemPrompt,
      toolPolicy: DATA_QA_AGENT_PROFILE.toolPolicy,
      onEvent,
    });

    // 保存到会话
    let session: ChatSession;
    if (sessionId) {
      const existing = await this.configStore.getChatSession(sessionId, userId);
      session = existing || { id: sessionId, datasourceId, messages: [] as ChatMessage[], createdAt: Date.now() };
    } else {
      session = { id: uuidv4(), datasourceId, messages: [] as ChatMessage[], createdAt: Date.now() };
    }

    session.messages.push({ role: 'user', content: question, timestamp: Date.now() });
    session.messages.push({ role: 'assistant', content: result.content, timestamp: Date.now() });
    await this.configStore.saveChatSession(session, userId);
  }

  /**
   * RAG 渐进式检索问答（SSE 模式）
   * 目标：先快速召回 → 扩召回 → (可选) Agentic 补召回 → 最终生成回答
   */
  async ragAskStream(
    question: string,
    userId: string,
    opts: {
      datasourceId?: string;
      categoryId?: string;
      documentId?: string;
      topK1?: number;
      topK2?: number;
      mode?: 'hybrid' | 'vector' | 'agentic' | 'agent-only';
    },
    onEvent: (event: AgentSSEEvent) => void | Promise<void>
  ): Promise<void> {
    const topK1 = Number.isFinite(Number(opts.topK1)) ? Math.max(1, Math.min(50, Number(opts.topK1))) : 5;
    const topK2 = Number.isFinite(Number(opts.topK2)) ? Math.max(1, Math.min(100, Number(opts.topK2))) : 20;
    const mode = opts.mode || 'hybrid';

    const emit = async (stage: string, data: any) => {
      await onEvent({ type: 'rag', stage, data } as any);
    };

    await emit('start', { question, mode, topK1, topK2 });

    // ====== agent-only 模式：完全绕过向量模型 ======
    if (mode === 'agent-only') {
      await this.ragAskStreamAgentOnly(question, userId, opts, emit);
      return;
    }

    // 1) 获取 RAGEngine（原有逻辑）
    const ragEngine = await this.getRAGEngine(userId);

    // 2) Step1：轻量召回
    await emit('retrieve:lite:start', { query: question, topK: topK1 });
    const liteStart = Date.now();
    const lite = await ragEngine.retrieve(question, topK1, opts.categoryId, opts.documentId);
    await emit('retrieve:lite:done', {
      elapsedMs: Date.now() - liteStart,
      chunks: lite.chunks.map((c: any) => ({
        chunkId: c.chunk?.id,
        score: c.score,
        title: (c.chunk?.metadata as any)?.title,
        documentId: (c.chunk?.metadata as any)?.documentId,
        preview: (c.chunk?.content || '').slice(0, 200),
      }))
    });

    // 3) Step2：扩召回（同 query 但更高 topK，后续可替换为 query rewrite）
    await emit('retrieve:expand:start', { query: question, topK: topK2 });
    const expandStart = Date.now();
    const expanded = await ragEngine.retrieve(question, topK2, opts.categoryId, opts.documentId);
    await emit('retrieve:expand:done', {
      elapsedMs: Date.now() - expandStart,
      chunks: expanded.chunks.map((c: any) => ({
        chunkId: c.chunk?.id,
        score: c.score,
        title: (c.chunk?.metadata as any)?.title,
        documentId: (c.chunk?.metadata as any)?.documentId,
        preview: (c.chunk?.content || '').slice(0, 200),
      }))
    });

    // 4) Step3：可选 Agentic 补召回（当向量命中少/置信度低时）
    let agenticSources: any[] = [];
    const needAgentic = mode === 'agentic' || (mode === 'hybrid' && (expanded.chunks?.length || 0) < 8);
    if (needAgentic) {
      await emit('retrieve:agentic:start', { query: question });
      const agenticStart = Date.now();
      try {
        const knowledgePath = process.cwd() + '/knowledge';
        const retriever = new AgenticRetriever(knowledgePath);
        const out = await retriever.retrieve(question);
        agenticSources = (out.sources || []).slice(0, 10).map((s: any) => ({
          file: s.file,
          relevance: s.relevance,
          preview: (s.content || '').slice(0, 200),
        }));
        await emit('retrieve:agentic:done', { elapsedMs: Date.now() - agenticStart, sources: agenticSources });
      } catch (e: any) {
        await emit('retrieve:agentic:error', { elapsedMs: Date.now() - agenticStart, error: e?.message || String(e) });
      }
    }

    // 5) Step4：最终回答（hybridAnswer 会内部构造上下文并生成答案）
    await emit('answer:start', { query: question });
    const answerStart = Date.now();

    let dataContext: any;
    if (opts.datasourceId) {
      const ds = dataSourceManager.get(opts.datasourceId);
      if (ds && this.canAccessDataSource(ds, userId)) {
        try {
          const resp = await this.getAIAgent().answer(question, ds.instance, ds.config.type, []);
          dataContext = { sql: resp.sql, data: resp.data };
          await emit('answer:datacontext', { sql: resp.sql, rowCount: resp.data?.length || 0 });
        } catch {
          // ignore
        }
      }
    }

    const result = await ragEngine.hybridAnswer(question, dataContext, opts.categoryId, opts.documentId);
    await emit('answer:done', {
      elapsedMs: Date.now() - answerStart,
      answer: result.answer,
      confidence: result.confidence,
      sources: (result.sources || []).map((s: any) => ({
        id: s.id,
        title: s.title,
        type: s.type,
        relevance: s.relevance,
        preview: (s.content || '').slice(0, 200),
      })),
      agenticSources,
    });
  }

  /**
   * 纯 Agent 渐进式检索（不依赖向量模型）
   * 步骤：关键词提取 → 领域定位 → 文件检索 → 内容读取 → 重排 → LLM生成
   */
  private async ragAskStreamAgentOnly(
    question: string,
    userId: string,
    opts: any,
    emit: (stage: string, data: any) => Promise<void>
  ): Promise<void> {
    const knowledgePath = process.cwd() + '/knowledge';
    const retriever = new AgenticRetriever(knowledgePath);

    // Step 1: 关键词提取
    await emit('agent:keywords:start', { query: question });
    const keywordsStart = Date.now();
    const keywords = this.extractKeywords(question);
    await emit('agent:keywords:done', { elapsedMs: Date.now() - keywordsStart, keywords });

    // Step 2: 领域定位（目录索引）
    await emit('agent:locate:start', { query: question, keywords });
    const locateStart = Date.now();
    const domains = await retriever['locateDomain'](question, keywords);
    await emit('agent:locate:done', { elapsedMs: Date.now() - locateStart, domains: domains.map((d: any) => d.path) });

    // Step 3: 文件检索（grep搜索）
    await emit('agent:search:start', { keywords, scope: domains.length > 0 ? 'targeted' : 'global' });
    const searchStart = Date.now();
    const allSources: any[] = [];
    const searchHistory: string[] = [];

    for (const domain of domains.length > 0 ? domains : [{ path: knowledgePath, description: '根目录' }]) {
      const files = await retriever['grepSearch'](domain.path, keywords);
      searchHistory.push(`在 ${domain.path} 找到 ${files.length} 个相关文件`);

      // 读取文件内容
      for (const file of files.slice(0, 5)) {
        const content = await retriever['readFileContent'](file.path, keywords);
        if (content) {
          allSources.push({
            file: file.path,
            content: content.substring(0, 2000),
            relevance: file.score,
            matches: file.matches
          });
        }
      }
    }
    await emit('agent:search:done', { elapsedMs: Date.now() - searchStart, sourceCount: allSources.length, history: searchHistory });

    // Step 4: 扩展召回（如果没有找到，尝试改写关键词）
    let expandedSources: any[] = [];
    if (allSources.length === 0) {
      await emit('agent:expand:start', { query: question });
      const expandStart = Date.now();
      const altKeywords = this.generateAlternativeKeywords(keywords, 1);
      const files = await retriever['grepSearch'](knowledgePath, altKeywords);
      for (const file of files.slice(0, 5)) {
        const content = await retriever['readFileContent'](file.path, altKeywords);
        if (content) {
          expandedSources.push({
            file: file.path,
            content: content.substring(0, 2000),
            relevance: file.score * 0.8, // 降低重试结果的相关度
            matches: file.matches
          });
        }
      }
      await emit('agent:expand:done', { elapsedMs: Date.now() - expandStart, sourceCount: expandedSources.length });
    }

    // Step 5: 重排/去重
    await emit('agent:rerank:start', { totalSources: allSources.length + expandedSources.length });
    const rerankStart = Date.now();
    const combinedSources = [...allSources, ...expandedSources];
    // 按文件去重，取最高相关度
    const uniqueSources = new Map<string, any>();
    for (const src of combinedSources) {
      if (!uniqueSources.has(src.file) || uniqueSources.get(src.file).relevance < src.relevance) {
        uniqueSources.set(src.file, src);
      }
    }
    // 按相关度排序
    const rankedSources = Array.from(uniqueSources.values())
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 8); // 取前8个
    await emit('agent:rerank:done', { elapsedMs: Date.now() - rerankStart, rankedCount: rankedSources.length });

    // Step 6: 生成回答（使用 LLM）
    await emit('answer:start', { query: question });
    const answerStart = Date.now();

    // 构建上下文
    const contextText = rankedSources.map((s, idx) =>
      `[来源${idx + 1}: ${s.file.split('/').pop()}]\n${s.content.substring(0, 1500)}`
    ).join('\n\n---\n\n');

    // 调用 LLM 生成答案
    const { openai, model } = await this.getAIAgent().getOpenAIInstance();
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `你是一个智能知识助手。基于提供的参考文档回答用户问题。

### 回答要求：
1. **内容优先**：优先整合参考文档中的信息回答
2. **诚实原则**：如果参考文档无法回答，请直接说明
3. **引用来源**：在回答中标注引用来源编号，如[来源1]、[来源2]`
        },
        {
          role: 'user',
          content: `参考文档:\n${contextText}\n\n用户问题: ${question}`
        }
      ],
      temperature: 0.7,
    });

    const answer = response.choices[0].message.content || '抱歉，无法回答这个问题。';
    const confidence = rankedSources.length > 0 ? rankedSources[0].relevance : 0.3;

    await emit('answer:done', {
      elapsedMs: Date.now() - answerStart,
      answer,
      confidence,
      sources: rankedSources.map(s => ({
        id: s.file,
        title: s.file.split('/').pop(),
        type: 'document',
        relevance: s.relevance,
        preview: s.content.substring(0, 200)
      })),
      agenticSources: [],
      searchHistory
    });
  }

  // 辅助方法：提取关键词
  private extractKeywords(query: string): string[] {
    const stopWords = ['的', '是', '在', '有', '和', '与', '或', '了', '吗', '呢', '啊', '什么', '怎么', '如何', '为什么'];
    const words = query.split(/[\s,，。？！、]+/).filter(w => w.length > 1 && !stopWords.includes(w));
    return [...new Set(words)].slice(0, 5);
  }

  // 辅助方法：生成替代关键词
  private generateAlternativeKeywords(keywords: string[], retryCount: number): string[] {
    // 简单实现：截断关键词或使用同义词
    if (retryCount === 1) {
      return keywords.slice(0, 3); // 使用更宽泛的关键词
    }
    return keywords;
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

  private isMissingRAGConfigError(error: unknown): boolean {
    return error instanceof Error && error.message.includes('无法初始化 RAG 引擎：缺少配置');
  }

  private getEmptyRAGStats(): RAGStats {
    return {
      totalDocuments: 0,
      totalChunks: 0,
      totalTokens: 0,
      categories: []
    };
  }

  private getEmptyKnowledgeGraph(): KnowledgeGraph {
    return {
      entities: [],
      relations: [],
      stats: {
        entityCount: 0,
        relationCount: 0
      }
    };
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
    try {
      const ragEngine = await this.getRAGEngine(userId);
      const stats = ragEngine.getStats();
      return {
        totalDocuments: stats.documents,
        totalChunks: stats.chunks,
        totalTokens: 0,
        categories: []
      } as any;
    } catch (error) {
      if (this.isMissingRAGConfigError(error)) {
        return this.getEmptyRAGStats();
      }
      throw error;
    }
  }

  async getRAGDocuments(userId: string, page: number = 1, pageSize: number = 10, categoryId?: string, keyword?: string): Promise<{ items: RAGDocument[], total: number }> {
    try {
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
    } catch (error) {
      if (this.isMissingRAGConfigError(error)) {
        return { items: [], total: 0 };
      }
      throw error;
    }
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
    try {
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
    } catch (error) {
      if (this.isMissingRAGConfigError(error)) {
        return this.getEmptyKnowledgeGraph();
      }
      throw error;
    }
  }

  async querySubgraph(keywords: string[], userId: string, maxEntities = 20): Promise<{ entities: any[]; relations: any[] }> {
    try {
      const ragEngine = await this.getRAGEngine(userId);
      const graph = ragEngine.getKnowledgeGraph();
      const result = graph.querySubgraph(keywords, maxEntities);
      return {
        entities: result.entities.map((e: any) => ({ id: e.id, name: e.name, nameCn: e.nameCn, type: e.type })),
        relations: result.relations.map((r: any) => ({ source: r.sourceId, target: r.targetId, type: r.type })),
      };
    } catch (error) {
      if (this.isMissingRAGConfigError(error)) {
        return { entities: [], relations: [] };
      }
      throw error;
    }
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
