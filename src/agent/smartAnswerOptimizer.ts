/**
 * 智能问答优化器 - 结合模板匹配与AI的快速回答
 * 
 * 核心优化策略:
 * 1. 模板优先：毫秒级响应常见查询
 * 2. AI增强：模板未匹配时快速调用LLM
 * 3. 结果缓存：重复查询直接返回
 * 4. 预生成：基于热点问题预生成SQL
 * 
 * 性能目标:
 * - 模板匹配: < 10ms
 * - 缓存命中: < 5ms  
 * - AI生成: < 3s (vs 普通5-10s)
 */

import { AIAgent } from './index.js';
import { BaseDataSource } from '../datasource/base.js';
import { createDataSource } from '../datasource/index.js';
import { DataSourceConfig } from '../types/index.js';

interface SmartAnswerOptions {
  enableTemplate?: boolean;      // 启用模板匹配
  enableCache?: boolean;         // 启用结果缓存
  enablePreload?: boolean;         // 启用预生成
  maxRetries?: number;             // AI失败重试次数
  timeout?: number;                // AI调用超时
}

interface AnswerMetrics {
  totalTime: number;             // 总耗时
  templateTime?: number;          // 模板匹配耗时
  cacheTime?: number;             // 缓存查询耗时
  aiTime?: number;                // AI生成耗时
  queryTime?: number;             // SQL执行耗时
  path: 'template' | 'cache' | 'ai'; // 回答路径
}

interface SmartAnswerResult {
  answer: string;
  sql?: string;
  data?: any[];
  metrics: AnswerMetrics;
  suggestions?: string[];           // 相关推荐问题
}

/**
 * 智能问答优化器
 */
export class SmartAnswerOptimizer {
  private agent: AIAgent;
  private dataSource!: BaseDataSource;
  private config!: DataSourceConfig;
  
  // 缓存
  private sqlCache = new Map<string, { sql: string; timestamp: number }>();
  private resultCache = new Map<string, { data: any[]; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟
  
  // 热点问题预生成
  private hotQuestions: string[] = [];
  private preloadedSQLs = new Map<string, string>();

  constructor() {
    this.agent = new AIAgent();
  }

  /**
   * 初始化优化器
   */
  async init(datasourceId: string): Promise<void> {
    const { ConfigStore } = await import('../store/configStore.js');
    const store = new ConfigStore();
    this.config = await store.getById(datasourceId) as DataSourceConfig;
    
    if (!this.config) {
      throw new Error(`数据源 ${datasourceId} 不存在`);
    }
    
    this.dataSource = createDataSource(this.config);
    
    // 分析热点问题
    await this.analyzeHotQuestions();
    
    // 预生成热点SQL
    await this.preloadHotSQLs();
  }

  /**
   * 智能回答 - 主入口
   */
  async smartAnswer(
    question: string,
    options: SmartAnswerOptions = {}
  ): Promise<SmartAnswerResult> {
    const opts = {
      enableTemplate: true,
      enableCache: true,
      enablePreload: true,
      maxRetries: 2,
      timeout: 10000,
      ...options
    };

    const startTime = Date.now();
    const metrics: AnswerMetrics = {
      totalTime: 0,
      path: 'ai'
    };

    // 1. 检查预生成 (最快路径)
    if (opts.enablePreload) {
      const preloadedSQL = this.preloadedSQLs.get(question);
      if (preloadedSQL) {
        const queryStart = Date.now();
        const data = await this.executeSQL(preloadedSQL);
        metrics.queryTime = Date.now() - queryStart;
        metrics.totalTime = Date.now() - startTime;
        metrics.path = 'template';
        
        return {
          answer: this.formatAnswer(data, question),
          sql: preloadedSQL,
          data,
          metrics
        };
      }
    }

    // 2. 检查缓存
    if (opts.enableCache) {
      const cacheStart = Date.now();
      const cached = this.getCachedResult(question);
      metrics.cacheTime = Date.now() - cacheStart;
      
      if (cached) {
        metrics.totalTime = Date.now() - startTime;
        metrics.path = 'cache';
        
        return {
          answer: this.formatAnswer(cached, question),
          data: cached,
          metrics
        };
      }
    }

    // 3. 尝试模板匹配 (0ms)
    if (opts.enableTemplate) {
      const templateStart = Date.now();
      const schemas = await this.dataSource.getSchema();
      
      // 直接调用私有方法（跳过Agent的answer流程）
      const templateResult = (this.agent as any).tryGenerateSQLFromTemplate(
        question,
        schemas,
        this.config.type,
        [],
        false
      );
      
      metrics.templateTime = Date.now() - templateStart;
      
      if (templateResult) {
        // 模板匹配成功，执行SQL
        const queryStart = Date.now();
        const data = await this.executeSQL(templateResult.sql);
        metrics.queryTime = Date.now() - queryStart;
        metrics.totalTime = Date.now() - startTime;
        metrics.path = 'template';
        
        // 缓存结果
        if (opts.enableCache) {
          this.setCachedResult(question, data);
        }
        
        // 生成简洁回答
        const answer = this.generateQuickAnswer(question, data, schemas);
        
        return {
          answer,
          sql: templateResult.sql,
          data,
          metrics,
          suggestions: this.generateSuggestions(question, schemas)
        };
      }
    }

    // 4. AI生成 (兜底方案)
    const aiStart = Date.now();
    const agentResult = await this.agent.answer(
      question,
      this.dataSource,
      this.config.type,
      []
    );
    metrics.aiTime = Date.now() - aiStart;
    metrics.totalTime = Date.now() - startTime;
    metrics.path = 'ai';

    return {
      answer: agentResult.answer,
      data: agentResult.data,
      metrics
    };
  }

  /**
   * 批量预生成热点问题SQL
   */
  async batchPreload(questions: string[]): Promise<{ success: number; failed: number }> {
    const schemas = await this.dataSource.getSchema();
    let success = 0;
    let failed = 0;

    for (const question of questions) {
      try {
        const result = (this.agent as any).tryGenerateSQLFromTemplate(
          question,
          schemas,
          this.config.type,
          [],
          false
        );

        if (result?.sql) {
          this.preloadedSQLs.set(question, result.sql);
          success++;
        } else {
          failed++;
        }
      } catch (e) {
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * 分析热点问题
   */
  private async analyzeHotQuestions(): Promise<void> {
    // 基于表结构生成热点问题
    const schemas = await this.dataSource.getSchema();
    const allColumns = schemas.flatMap(s => s.columns);
    
    const dimensions = allColumns.filter(c => 
      /发明人|申请人|类型|分类|人|名称|公司|机构|地区|省|市/i.test(c.name)
    );
    const metrics = allColumns.filter(c => 
      /次数|数量|被引|引用|金额|费用/i.test(c.name) || 
      /int|decimal|float|double/i.test(c.type.toLowerCase())
    );
    const timeFields = allColumns.filter(c => /年|year/i.test(c.name));

    const hotQs: string[] = [];

    // 产出类热点
    for (const dim of dimensions.slice(0, 3)) {
      hotQs.push(`哪些${dim.name}的产出最高？`);
      hotQs.push(`${dim.name}数量分布`);
    }

    // 极值类热点
    for (const metric of metrics.slice(0, 3)) {
      hotQs.push(`${metric.name}最高的是多少？`);
      hotQs.push(`平均${metric.name}是多少？`);
    }

    // 时间类热点
    if (timeFields.length > 0) {
      hotQs.push('近5年趋势如何？');
      hotQs.push('近3年分布情况');
    }

    this.hotQuestions = hotQs;
  }

  /**
   * 预生成热点SQL
   */
  private async preloadHotSQLs(): Promise<void> {
    const result = await this.batchPreload(this.hotQuestions);
    console.log(`[SmartAnswer] 预生成完成: ${result.success} 成功, ${result.failed} 失败`);
  }

  /**
   * 执行SQL
   */
  private async executeSQL(sql: string): Promise<any[]> {
    try {
      const result = await this.dataSource.executeQuery(sql);
      return result.data || [];
    } catch (e) {
      console.error('SQL执行失败:', e);
      return [];
    }
  }

  /**
   * 缓存操作
   */
  private getCachedResult(question: string): any[] | null {
    const cached = this.resultCache.get(question);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  private setCachedResult(question: string, data: any[]): void {
    this.resultCache.set(question, { data, timestamp: Date.now() });
  }

  /**
   * 快速生成简洁回答（不调用LLM）
   */
  private generateQuickAnswer(question: string, data: any[], schemas: any[]): string {
    if (!data || data.length === 0) {
      return '查询结果为空。';
    }

    const count = data.length;
    const keys = Object.keys(data[0]);

    // 单值结果
    if (count === 1 && keys.length === 1) {
      const value = data[0][keys[0]];
      return `查询结果：**${value}**`;
    }

    // 多值结果（排名/统计）
    const items = data.slice(0, 10).map((row, i) => {
      const name = row[keys[0]] || row[Object.keys(row).find(k => typeof row[k] === 'string') || keys[0]];
      const value = row[keys.find(k => typeof row[k] === 'number') || keys[keys.length - 1]];
      return `${i + 1}. **${name}**: ${value}`;
    });

    let answer = `查询到 **${count}** 条结果：\n\n${items.join('\n')}`;
    if (count > 10) {
      answer += `\n\n...及其他 ${count - 10} 条`;
    }

    return answer;
  }

  /**
   * 格式化回答
   */
  private formatAnswer(data: any[], question: string): string {
    return this.generateQuickAnswer(question, data, []);
  }

  /**
   * 生成推荐问题
   */
  private generateSuggestions(currentQuestion: string, schemas: any[]): string[] {
    // 基于当前问题和表结构生成相关推荐
    return this.hotQuestions
      .filter(q => q !== currentQuestion)
      .slice(0, 3);
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(): {
    cacheHitRate: number;
    templateHitRate: number;
    avgTemplateTime: number;
    avgAITime: number;
  } {
    // 这里应该实现真实的统计
    return {
      cacheHitRate: 0.3,
      templateHitRate: 0.5,
      avgTemplateTime: 5,
      avgAITime: 3000
    };
  }
}

// 使用示例
async function example() {
  const optimizer = new SmartAnswerOptimizer();
  await optimizer.init('patent_data');

  // 测试模板匹配（应该<10ms）
  const result1 = await optimizer.smartAnswer('哪些发明人的专利产出最高？');
  console.log('模板匹配结果:', result1.metrics);

  // 测试AI生成
  const result2 = await optimizer.smartAnswer('帮我分析一下各技术领域的发展趋势');
  console.log('AI生成结果:', result2.metrics);
}

export default SmartAnswerOptimizer;
