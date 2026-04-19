import OpenAI from 'openai';
import { createHash } from 'crypto';
import { TableSchema, ColumnInfo, AIResponse } from '../types';
import { BaseDataSource } from '../datasource';
import { ChatMessage } from '../store/configStore';
import { skillsRegistry, SkillContext, SkillResult } from './skills';
import { mcpRegistry } from './mcp';
import { AutoAnalyst, AnalysisReport } from './analyst';
import axios from 'axios';
import { DashboardGenerator, DashboardResult } from './dashboard';
import { SlideContent } from './skills/report/pptGenerator';
import { QualityInspector, QualityReport } from './qualityInspector';
import { SmartAnswerOptimizer } from './smartAnswerOptimizer';

// Agent 执行结果
export interface AgentResponse extends AIResponse {
  skillUsed?: string;
  toolUsed?: string;
  visualization?: any;
  chart?: ChartData;
  charts?: ChartData[];  // 多图表支持（综合分析）
  tokensUsed?: number;   // Token 使用量
  modelName?: string;    // 使用的模型名称
}

// MySQL 保留字列表（常见的）
const MYSQL_RESERVED_WORDS = new Set([
  'add', 'all', 'alter', 'analyze', 'and', 'as', 'asc', 'before', 'between', 'bigint',
  'binary', 'blob', 'both', 'by', 'call', 'cascade', 'case', 'change', 'char', 'character',
  'check', 'code', 'collate', 'column', 'condition', 'constraint', 'continue', 'convert',
  'create', 'cross', 'current_date', 'current_time', 'current_timestamp', 'current_user',
  'cursor', 'database', 'databases', 'day_hour', 'day_microsecond', 'day_minute', 'day_second',
  'dec', 'decimal', 'declare', 'default', 'delayed', 'delete', 'desc', 'describe', 'deterministic',
  'distinct', 'distinctrow', 'div', 'double', 'drop', 'dual', 'each', 'else', 'elseif', 'enclosed',
  'escaped', 'exists', 'exit', 'explain', 'false', 'fetch', 'float', 'float4', 'float8', 'for',
  'force', 'foreign', 'from', 'fulltext', 'grant', 'group', 'having', 'high_priority', 'hour_microsecond',
  'hour_minute', 'hour_second', 'if', 'ignore', 'in', 'index', 'infile', 'inner', 'inout', 'insensitive',
  'insert', 'int', 'int1', 'int2', 'int3', 'int4', 'int8', 'integer', 'interval', 'into', 'is', 'iterate',
  'join', 'key', 'keys', 'kill', 'leading', 'leave', 'left', 'like', 'limit', 'linear', 'lines', 'load',
  'localtime', 'localtimestamp', 'lock', 'long', 'longblob', 'longtext', 'loop', 'low_priority', 'master_ssl_verify_server_cert',
  'match', 'mediumblob', 'mediumint', 'mediumtext', 'middleint', 'minute_microsecond', 'minute_second', 'mod',
  'modifies', 'natural', 'not', 'no_write_to_binlog', 'null', 'numeric', 'on', 'optimize', 'option', 'optionally',
  'or', 'order', 'out', 'outer', 'outfile', 'precision', 'primary', 'procedure', 'purge', 'range', 'read',
  'reads', 'read_write', 'real', 'references', 'regexp', 'release', 'rename', 'repeat', 'replace', 'require',
  'restrict', 'return', 'revoke', 'right', 'rlike', 'schema', 'schemas', 'second_microsecond', 'select',
  'sensitive', 'separator', 'set', 'show', 'smallint', 'spatial', 'specific', 'sql', 'sqlexception', 'sqlstate',
  'sqlwarning', 'sql_big_result', 'sql_calc_found_rows', 'sql_small_result', 'ssl', 'starting', 'straight_join',
  'table', 'terminated', 'text', 'then', 'time', 'timestamp', 'tinyblob', 'tinyint', 'tinytext', 'to', 'trailing',
  'trigger', 'true', 'undo', 'union', 'unique', 'unlock', 'unsigned', 'update', 'usage', 'use', 'using', 'utc_date',
  'utc_time', 'utc_timestamp', 'values', 'varbinary', 'varchar', 'varcharacter', 'varying', 'when', 'where',
  'while', 'with', 'write', 'xor', 'year_month', 'zerofill', 'rank', 'row', 'rows', 'name', 'type', 'status'
]);

// 字段名映射（英文 -> 中文）
const FIELD_NAME_MAP: Record<string, string> = {
  'language': '语言',
  'population': '人口',
  'gnp': '国民生产总值',
  'continent': '大洲',
  'region': '地区',
  'name': '名称',
  'country': '国家',
  'city': '城市',
  'district': '区县',
  'surfacearea': '面积',
  'indepyear': '独立年份',
  'lifeexpectancy': '预期寿命',
  'gnpold': '旧国民生产总值',
  'localname': '本地名称',
  'governmentform': '政府形式',
  'headofstate': '国家元首',
  'capital': '首都',
  'code': '代码',
  'code2': '代码2',
  'count': '数量',
  'total': '总计',
  'sum': '总和',
  'avg': '平均',
  'max': '最大',
  'min': '最小',
  'percentage': '占比',
  'ratio': '比例',
  'date': '日期',
  'year': '年份',
  'month': '月份',
  'day': '日期',
  'amount': '额度',
  'price': '价格',
  'status': '状态',
  'type': '类型',
  'category': '分类',
  'user': '用户',
  'order': '订单',
  'product': '产品',
  'goods': '商品',
  'score': '分数',
  'grade': '等级',
  'level': '级别',
  'department': '部门',
  'address': '地址',
  'phone': '电话',
  'mobile': '手机',
  'email': '邮箱',
  'gender': '性别',
  'sex': '性别',
  'birthday': '生日',
  'time': '时间',
  'created_at': '创建时间',
  'updated_at': '更新时间',
  'creator': '创建者',
  'modifier': '修改者',
};

// 清理 SQL（移除 <think> 标签、Markdown 代码块等）
function cleanSQL(sql: string): string {
  if (!sql) return '';

  let cleaned = sql.trim();

  // 1. 移除 <think> 标签和其内部内容（Qwen3-32B 模型可能返回）
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // 2. 移除 Markdown 代码块
  cleaned = cleaned.replace(/```sql\n?/gi, '').replace(/```\n?/g, '').trim();

  // 3. 如果有多个 SQL 语句，只取第一个
  const firstStatement = cleaned.split(';')[0].trim();

  return firstStatement;
}

// 转义 MySQL 保留字（只转义明确的字段名，避免误转义 SQL 语法关键字）
function escapeReservedWords(sql: string, dbType: string): string {
  if (dbType !== 'mysql') return sql;

  // SQL 语法关键字列表（不应被转义）
  const SQL_SYNTAX_KEYWORDS = new Set([
    'select', 'from', 'where', 'and', 'or', 'not', 'in', 'is', 'like', 'between',
    'case', 'when', 'then', 'else', 'end', 'null', 'as', 'on', 'join', 'left', 'right', 'inner', 'outer',
    'group', 'by', 'order', 'having', 'limit', 'offset', 'asc', 'desc',
    'count', 'sum', 'avg', 'max', 'min', 'distinct', 'all', 'any', 'some',
    'true', 'false', 'exists', 'over', 'partition', 'round', 'if', 'ifnull', 'coalesce',
    'union', 'intersect', 'except', 'into', 'values', 'set', 'update', 'delete', 'insert',
    'create', 'drop', 'alter', 'table', 'index', 'primary', 'key', 'foreign', 'references',
    'null', 'default', 'auto_increment', 'unsigned', 'int', 'varchar', 'text', 'date', 'datetime', 'timestamp'
  ]);

  let escapedSql = sql;

  // 只转义 "表名.字段名" 格式中的保留字字段名
  escapedSql = escapedSql.replace(
    /\b([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z_][a-zA-Z0-9_]*)\b/g,
    (match, table, field) => {
      if (MYSQL_RESERVED_WORDS.has(field.toLowerCase()) && !SQL_SYNTAX_KEYWORDS.has(field.toLowerCase())) {
        return `${table}.\`${field}\``;
      }
      return match;
    }
  );

  // 转义 COUNT(field), SUM(field) 等聚合函数中的保留字
  escapedSql = escapedSql.replace(
    /\b(COUNT|SUM|AVG|MAX|MIN|GROUP_CONCAT)\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)/gi,
    (match, func, field) => {
      if (MYSQL_RESERVED_WORDS.has(field.toLowerCase()) && !SQL_SYNTAX_KEYWORDS.has(field.toLowerCase())) {
        return `${func}(\`${field}\`)`;
      }
      return match;
    }
  );

  return escapedSql;
}

// 内嵌图表数据
export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'area' | 'scatter';
  title: string;
  data: any[];
  config: {
    xField?: string;
    yField?: string;
    labelField?: string;
    valueField?: string;
  };
  // AI 智能判断的单位元信息（前端优先使用，避免正则猜测）
  unitInfo?: {
    unitName: string;   // 显示单位（如 '万美元'、'万人'、'平方公里'）
    scale: number;      // 缩放比例（displayVal = rawVal / scale）
    yFieldCn: string;   // Y 轴字段中文名
    xFieldCn: string;   // X 轴字段中文名
  };
}

// 内容编排结果
export interface FormattedContent {
  title: string;
  sections: ContentSection[];
  markdown: string;
  pptSlides?: SlideContent[];
}

export interface ContentSection {
  type: 'summary' | 'keyPoints' | 'table' | 'analysis' | 'recommendation' | 'conclusion';
  title: string;
  content: string | string[] | string[][];
}

// 工具调用结构
interface ToolCall {
  type: 'skill' | 'mcp' | 'sql' | 'chitchat';
  name: string;
  params: Record<string, any>;
  postProcess?: 'format' | 'ppt' | 'format_and_ppt' | null;
  needChart?: boolean;
  chartType?: 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'none';
  methodology?: string;  // 分析方法论
  missingData?: string;  // 缺少的数据说明
  chartTitle?: string;   // 图表标题
  chartConfig?: {        // AI 配置的图表参数
    xField?: string;
    yField?: string;
    seriesField?: string;
  };
}

// AI 配置类型
interface AIConfigItem {
  apiKey?: string;
  baseURL?: string;
  model: string;
  name?: string;
}

// AI 配置获取函数类型（返回所有可用配置，按优先级排序）
type AIConfigGetter = () => Promise<AIConfigItem[]>;

export class AIAgent {
  private openai!: OpenAI;
  private model!: string;
  private currentConfigName?: string;
  private analyst!: AutoAnalyst;
  private dashboardGen!: DashboardGenerator;
  private qualityInspector!: QualityInspector;
  private smartOptimizer?: SmartAnswerOptimizer;  // 智能问答优化器
  private configGetter?: AIConfigGetter;
  private allConfigs: AIConfigItem[] = [];
  private currentConfigIndex = 0;
  private initialized = false;
  private lastRequestTokens = 0;  // 上次请求的 token 使用量
  private configCacheTime = 0;  // AI 配置缓存时间戳
  private static readonly CONFIG_CACHE_TTL = 5 * 60 * 1000;  // 5 分钟

  // SQL 缓存（相同问题直接返回缓存的SQL，跳过LLM调用）
  private sqlCache = new Map<string, { sql: string; chartType?: string; chartTitle?: string; chartConfig?: any; timestamp: number }>();
  private static readonly SQL_CACHE_TTL = 10 * 60 * 1000;  // 10 分钟
  private static readonly SQL_CACHE_MAX_SIZE = 200;  // 最多缓存200条

  private normalizeQuestionForCache(question: string): string {
    return (question || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  private hashSchemaContext(schemaContext: string): string {
    const text = schemaContext || '';
    return createHash('sha256').update(text).digest('hex').slice(0, 16);
  }

  private getRecentYearsWindow(question: string): number | null {
    const q = (question || '').toLowerCase();
    const m = q.match(/近\s*(\d{1,2})\s*年/);
    if (m && m[1]) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0 && n <= 50) return n;
    }
    if (/近年来|近几年|最近|近年|近\s*一\s*段\s*时间/.test(q)) return 10;
    return null;
  }

  private rewriteSqlForRecentYears(question: string, sql: string): string {
    const windowN = this.getRecentYearsWindow(question);
    if (!windowN) return sql;
    const s = (sql || '').trim();
    if (!/^select\b/i.test(s)) return sql;
    if (/\bunion\b|\bintersect\b|\bexcept\b/i.test(s)) return sql;

    const yearMatch = s.match(/\b(order\s+by\s+)([`"\[]?[\u4e00-\u9fa5A-Za-z_][\u4e00-\u9fa5A-Za-z0-9_]*[`"\]]?)\s+(asc|desc)\b/i);
    const hasGroupBy = /\bgroup\s+by\b/i.test(s);
    const hasLimit = /\blimit\s+\d+\b/i.test(s);
    if (!hasGroupBy || !yearMatch || !hasLimit) return sql;

    const yearCol = yearMatch[2];
    // 仅对「年份列升序 + limit」这种明显不符合"近年"的情况改写
    if (!/\basc\b/i.test(yearMatch[3])) return sql;
    if (!/(年|year)/i.test(yearCol)) return sql;

    // 提取表名（简化处理，取 FROM 后的第一个标识符）
    const fromMatch = s.match(/\bfrom\s+([`"\[]?[\u4e00-\u9fa5A-Za-z_][\u4e00-\u9fa5A-Za-z0-9_]*[`"\]]?)/i);
    const tableName = fromMatch ? fromMatch[1] : 'data';

    // 性能优化：使用年份范围查询代替 JOIN
    // WHERE 年份 >= (SELECT MAX(年份) FROM 表) - (N-1)
    // 这种方式比 JOIN 子查询快得多，MySQL 也能很好优化
    const rangeSql = s
      .replace(new RegExp(`\\blimit\\s+\\d+\\b`, 'i'), '')
      .replace(new RegExp(`\\border\\s+by\\s+[^;]+\\basc\\b`, 'i'), '')
      .replace(/;\s*$/, '');

    // 构建年份范围条件：取最大年份往前推 windowN-1 年
    const whereCondition = `${yearCol} >= (SELECT MAX(${yearCol}) FROM ${tableName}) - ${windowN - 1}`;

    // 检查原 SQL 是否已有 WHERE
    const hasWhere = /\bwhere\b/i.test(rangeSql);
    const connector = hasWhere ? ' AND ' : ' WHERE ';

    // 添加年份范围条件并重新排序
    return `${rangeSql}${connector}${whereCondition} GROUP BY ${yearCol} ORDER BY ${yearCol} ASC`;
  }

  // 生成缓存key
  private getSQLCacheKey(question: string, dbType: string, schemaContext: string): string {
    // 用问题+数据库类型+schema摘要生成key
    const q = this.normalizeQuestionForCache(question);
    const schemaHash = this.hashSchemaContext(schemaContext);
    return `${q}|${dbType}|${schemaHash}`;
  }

  // 获取SQL缓存
  private getSQLFromCache(key: string): { sql: string; chartType?: string; chartTitle?: string; chartConfig?: any } | null {
    const cached = this.sqlCache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > AIAgent.SQL_CACHE_TTL) {
      this.sqlCache.delete(key);
      return null;
    }
    // 命中时刷新为最新使用，模拟 LRU 行为
    this.sqlCache.delete(key);
    this.sqlCache.set(key, { ...cached, timestamp: Date.now() });
    return cached;
  }

  // 设置SQL缓存
  private setSQLCache(key: string, value: { sql: string; chartType?: string; chartTitle?: string; chartConfig?: any }) {
    // 超过上限时清理最旧的
    if (this.sqlCache.size >= AIAgent.SQL_CACHE_MAX_SIZE) {
      const firstKey = this.sqlCache.keys().next().value;
      if (firstKey) this.sqlCache.delete(firstKey);
    }
    this.sqlCache.set(key, { ...value, timestamp: Date.now() });
  }


  constructor(apiKey?: string, baseURL?: string, model: string = 'gpt-4o') {
    if (apiKey) {
      // 兼容旧的静态配置方式
      this.initWithConfig({ apiKey, baseURL, model, name: 'default' });
    }
  }

  // 设置动态配置获取函数
  setConfigGetter(getter: AIConfigGetter) {
    this.configGetter = getter;
    this.initialized = false;
    this.allConfigs = [];
    this.currentConfigIndex = 0;
    this.configCacheTime = 0;
  }

  // 使用配置初始化
  private initWithConfig(config: AIConfigItem) {
    // 支持 API Key 为空的情况
    const openaiConfig: any = {
      baseURL: config.baseURL,
      timeout: 60000, // 60 秒单次调用超时（复杂 SQL/分析可能需要较长思考时间）
      maxRetries: 1,  // SDK 层最多重试 1 次（配合 callWithRetry 外层重试）
    };

    if (config.apiKey && config.apiKey.trim() !== '') {
      openaiConfig.apiKey = config.apiKey;
    }

    this.openai = new OpenAI(openaiConfig);
    this.model = config.model;
    this.currentConfigName = config.name;

    // 传递空 API Key 配置给其他组件
    const analystConfig = { ...config };
    if (!analystConfig.apiKey || analystConfig.apiKey.trim() === '') {
      delete analystConfig.apiKey;
    }

    this.analyst = new AutoAnalyst(config.apiKey || '', config.baseURL, config.model);
    this.dashboardGen = new DashboardGenerator(config.apiKey || '', config.baseURL, config.model);
    this.qualityInspector = new QualityInspector(this.openai, config.model);
    this.smartOptimizer = new SmartAnswerOptimizer();
    this.initialized = true;
    console.log(`>>> 使用 AI 配置: ${config.name || 'unknown'} (${config.model})`);
  }

  // 切换到下一个配置
  private switchToNextConfig(): boolean {
    if (this.currentConfigIndex + 1 < this.allConfigs.length) {
      this.currentConfigIndex++;
      const nextConfig = this.allConfigs[this.currentConfigIndex];
      console.log(`>>> 自动切换到备用配置: ${nextConfig.name || 'unknown'} (${nextConfig.model})`);
      this.initWithConfig(nextConfig);
      return true;
    }
    return false;
  }

  // 重置到第一个配置
  private resetToFirstConfig() {
    if (this.allConfigs.length > 0) {
      this.currentConfigIndex = 0;
      this.initWithConfig(this.allConfigs[0]);
    }
  }

  // 确保已初始化（从数据库获取最新配置，带 30 秒缓存）
  private async ensureInitialized(): Promise<void> {
    if (this.configGetter) {
      const now = Date.now();

      // 缓存未过期且已初始化，直接返回
      if (this.initialized && this.openai && (now - this.configCacheTime) < AIAgent.CONFIG_CACHE_TTL) {
        return;
      }

      const freshConfigs = await this.configGetter();
      if (!freshConfigs || freshConfigs.length === 0) {
        throw new Error('没有可用的 AI 配置，请在管理后台配置 AI 服务');
      }

      // 检查配置是否有变化（对比名称+模型列表）
      const configKey = freshConfigs.map(c => `${c.name}:${c.model}`).join(',');
      const currentKey = this.allConfigs.map(c => `${c.name}:${c.model}`).join(',');

      if (configKey !== currentKey || !this.initialized || !this.openai) {
        if (this.initialized && configKey !== currentKey) {
          console.log(`>>> AIAgent: 检测到配置变更，正在刷新...`);
        }
        this.allConfigs = freshConfigs;
        this.currentConfigIndex = 0;
        this.initWithConfig(this.allConfigs[0]);
      }

      this.configCacheTime = now;
    } else {
      if (this.initialized && this.openai) return;
      throw new Error('AI Agent 未配置');
    }
  }

  // 手动重置状态
  public reset() {
    this.initialized = false;
    this.configCacheTime = 0;
  }

  /** 获取当前 OpenAI 实例（供 agentLoop 等外部模块使用） */
  public async getOpenAIInstance(): Promise<{ openai: any; model: string }> {
    await this.ensureInitialized();
    return { openai: this.openai, model: this.model };
  }

  // 带取消信号的 OpenAI 调用
  private async callWithRetryWithSignal<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    maxRetries: number = 2,
    signal?: AbortSignal
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // 检查取消信号
        if (signal?.aborted) {
          throw new Error('Request cancelled');
        }

        // 关键修复：如果 openai 实例丢失，强制重新初始化
        if (!this.openai) {
          console.warn(`>>> AIAgent: openai 实例未定义，尝试执行 ensureInitialized...`);
          await this.ensureInitialized();
        }

        const result = await fn(signal!);
        // 记录 token 使用量（如果响应中包含 usage 信息）
        if (result && typeof result === 'object' && 'usage' in result) {
          const usage = (result as any).usage;
          if (usage && usage.total_tokens) {
            console.log(`>>> Token usage: prompt=${usage.prompt_tokens}, completion=${usage.completion_tokens}, total=${usage.total_tokens}`);
            this.lastRequestTokens += usage.total_tokens;
          }
        }
        return result;
      } catch (error: any) {
        lastError = error;
        const errorMsg = error.message || String(error);

        // 如果是取消错误，直接抛出不再重试
        if (errorMsg === 'Request cancelled' || errorMsg.includes('cancelled') || errorMsg.includes('aborted')) {
          console.warn(`[AIAgent] 请求被取消，停止重试`);
          throw error;
        }

        console.error(`AI 调用失败 [${this.currentConfigName}]: ${errorMsg}`);

        // 判断是否需要切换配置的错误类型
        const shouldSwitch =
          errorMsg.includes('429') ||  // 限流/余额不足
          errorMsg.includes('余额') ||
          errorMsg.includes('quota') ||
          errorMsg.includes('rate limit') ||
          errorMsg.includes('insufficient') ||
          errorMsg.includes('Connection error') ||
          errorMsg.includes('ECONNREFUSED') ||
          errorMsg.includes('timeout') ||
          errorMsg.includes('401') ||  // API Key 无效
          errorMsg.includes('403') ||  // 权限问题
          errorMsg.includes('503');   // 服务不可用

        if (shouldSwitch) {
          // 尝试切换到下一个配置
          if (this.switchToNextConfig()) {
            console.log(`>>> 第 ${attempt + 2} 次尝试，使用新配置...`);
            continue;
          }
        }

        // 如果是最后一次尝试或不需要切换，抛出错误
        if (attempt === maxRetries - 1) {
          throw error;
        }
      }
    }

    throw lastError || new Error('AI 调用失败');
  }

  // 带自动重试的 OpenAI 调用（向后兼容，不带取消信号）
  private async callWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 2
  ): Promise<T> {
    // 包装函数以适配 callWithRetryWithSignal
    return this.callWithRetryWithSignal(
      async () => fn(),
      maxRetries,
      undefined
    );
  }

  // 数据质量检测入口
  async inspectQuality(
    dataSource: BaseDataSource,
    dbType: string,
    tableNameCn?: string
  ): Promise<{ reports: QualityReport[]; markdown: string }> {
    await this.ensureInitialized();
    const reports = await this.qualityInspector.inspect(dataSource, dbType, tableNameCn);
    const markdown = this.qualityInspector.formatReportAsMarkdown(reports);
    return { reports, markdown };
  }

  // 自动分析入口
  async autoAnalyze(
    topic: string,
    dataSource: BaseDataSource,
    dbType: string,
    onProgress?: (step: any) => void
  ): Promise<AnalysisReport> {
    await this.ensureInitialized();
    return this.analyst.analyze(topic, dataSource, dbType, onProgress);
  }

  // 生成大屏入口
  async generateDashboard(
    topic: string,
    dataSource: BaseDataSource,
    dbType: string,
    theme: 'light' | 'dark' | 'tech' = 'dark'
  ): Promise<DashboardResult> {
    await this.ensureInitialized();
    return this.dashboardGen.generate(topic, dataSource, dbType, theme);
  }

  // 获取 analyst 实例
  getAnalyst(): AutoAnalyst {
    if (!this.analyst) {
      throw new Error('AutoAnalyst not initialized');
    }
    return this.analyst;
  }

  // 根据问题筛选相关表（数据源表多时只发送相关表，减少 prompt token）
  private filterRelevantSchemas(schemas: TableSchema[], question: string): TableSchema[] {
    // 表少于5个时全部发送
    if (schemas.length <= 5) return schemas;

    const q = question.toLowerCase();
    const scored = schemas.map(table => {
      let score = 0;
      const tn = table.tableName.toLowerCase();
      // 表名匹配
      if (q.includes(tn)) score += 10;
      // 字段名匹配
      for (const col of table.columns) {
        const cn = col.name.toLowerCase();
        if (q.includes(cn)) score += 5;
        if (col.comment && q.includes(col.comment.toLowerCase())) score += 5;
      }
      return { table, score };
    });

    // 按相关度排序，取分数>0的表，至少保留3个表，最多10个
    scored.sort((a, b) => b.score - a.score);
    const relevant = scored.filter(s => s.score > 0).map(s => s.table);
    if (relevant.length >= 3) return relevant.slice(0, 10);
    // 如果匹配不足，返回前10个表
    return schemas.slice(0, 10);
  }

  // 格式化schema
  private formatSchemaForAI(schemas: TableSchema[]): string {
    return schemas.map(table => {
      const cols = table.columns.map(c =>
        `  - ${c.name} (${c.type}${c.isPrimaryKey ? ', PK' : ''}${c.comment ? `, ${c.comment}` : ''})`
      ).join('\n');

      // 优化：样例数据只取第一条，减少 token
      let sampleText = '';
      if (table.sampleData && table.sampleData.length > 0) {
        sampleText = `\n样例: ${JSON.stringify(table.sampleData[0])}`;
      }

      return `表名: ${table.tableName}\n字段:\n${cols}${sampleText}`;
    }).join('\n\n');
  }

  private buildSqlIdentifierRules(schemas: TableSchema[], dbType: string): string {
    // 强制 SQL 只能使用真实表名/字段名，避免模型用中文“别名表名”导致执行失败
    const tableNames = schemas.map(s => s.tableName);
    const columnNames = Array.from(new Set(schemas.flatMap(s => s.columns.map(c => c.name))));

    const hasNonAsciiTable = tableNames.some(n => /[^\x00-\x7F]/.test(n));
    const hasNonAsciiCol = columnNames.some(n => /[^\x00-\x7F]/.test(n));

    // 如果数据源本身就有中文表/字段名，就不要禁止中文标识符
    const canForbidChineseIdentifiers = !hasNonAsciiTable && !hasNonAsciiCol;
    if (!canForbidChineseIdentifiers) return '';

    // 构建可用的真实表名和字段名列表（白名单）
    const availableTables = tableNames.map(t => `\`${t}\``).join(', ');
    const availableColumns = columnNames.slice(0, 20).map(c => `\`${c}\``).join(', '); // 最多显示20个，避免过长
    const moreCols = columnNames.length > 20 ? ` 等共${columnNames.length}个字段` : '';

    return `\n\n【强制约束 - 必须严格遵守，违反将导致执行失败】：
1. 【表名白名单】只能使用以下真实表名：${availableTables}
2. 【字段白名单】只能使用以下真实字段名：${availableColumns}${moreCols}
3. 【绝对禁止】严禁在 SQL 中使用中文作为表名、字段名或别名（错误示例：FROM 专利数据表、SELECT 申请年份）
4. 【绝对禁止】严禁在 SQL 中使用中文拼音或中英文混合作为标识符（错误示例：FROM patent_data_zhuanli）
5. 【允许范围】仅允许在 AS 别名中使用中文（正确示例：SELECT apply_year AS 申请年份）
6. 【校验规则】如果生成的 SQL 包含任何非 ASCII 标识符（中文、全角符号等），必须立即使用白名单中的英文原名替换。`;
  }

  private hasNonAsciiIdentifier(sql: string): boolean {
    // 检测 SQL 中是否包含中文汉字或其他非 ASCII 字符（可能用于表名/字段名）
    // 注意：只检测可能作为标识符的非 ASCII 字符，不包括 AS 别名中的中文
    // 匹配模式：中文汉字、中文标点、全角符号
    const raw = sql || '';
    if (!raw) return false;

    // 先剥离字符串字面量，避免误伤
    let withoutStringLiterals = raw.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');

    // 允许 `AS` 别名使用中文/非ASCII：剥离 AS 后面的别名部分
    // 覆盖三种常见写法：
    // - AS 别名
    // - AS `别名`
    // - AS "别名"
    // 注：这里只处理别名本身，保留 AS 关键字和前面的表达式
    withoutStringLiterals = withoutStringLiterals
      .replace(/\bAS\s+`[^`]*`/gi, 'AS `__alias__`')
      .replace(/\bAS\s+"[^"]*"/gi, 'AS "__alias__"')
      .replace(/\bAS\s+[\u4e00-\u9fa5\w_]+/gi, 'AS __alias__');

    // 如果仍然出现中文，说明中文不在 AS 别名位置（可能是表/字段/函数名等）
    if (/[\u4e00-\u9fa5]/.test(withoutStringLiterals)) return true;

    // 检测其它非 ASCII 字符（全角符号等），但排除常见 SQL 符号
    if (/[^ -\s\(\),.;=<>!+-/*]/.test(withoutStringLiterals)) return true;
    return false;
  }

  private shouldForbidChineseIdentifiers(schemas: TableSchema[]): boolean {
    const tableNames = schemas.map(s => s.tableName);
    const columnNames = Array.from(new Set(schemas.flatMap(s => s.columns.map(c => c.name))));
    const hasNonAsciiTable = tableNames.some(n => /[^\x00-\x7F]/.test(n));
    const hasNonAsciiCol = columnNames.some(n => /[^\x00-\x7F]/.test(n));
    return !hasNonAsciiTable && !hasNonAsciiCol;
  }

  private async ensureSqlIdentifiersAreValid(
    question: string,
    sql: string,
    schemas: TableSchema[],
    dbType: string,
    history: ChatMessage[],
    noChart?: boolean
  ): Promise<string> {
    // 仅当 schema 本身没有中文表/字段名时，才禁止 SQL 出现中文标识符
    if (!(dbType === 'mysql' || dbType === 'postgres')) return sql;
    if (!this.shouldForbidChineseIdentifiers(schemas)) return sql;
    if (!sql || !this.hasNonAsciiIdentifier(sql)) return sql;

    console.warn('[AIAgent] SQL 包含非ASCII标识符，触发强制重写');
    console.warn('[AIAgent] 原始SQL:', sql);

    // 第一次重写尝试 - 使用强约束提示
    const tableList = schemas.map(s => s.tableName).join(', ');
    const fieldList = Array.from(new Set(schemas.flatMap(s => s.columns.map(c => c.name)))).join(', ');

    const reason = `【严重错误】生成的SQL包含中文或非ASCII标识符，但数据库真实表名/字段名都是英文。

【强制白名单 - 只能使用以下标识符】
表名: ${tableList}
字段: ${fieldList}

【禁止示例】
❌ FROM 专利数据表
❌ SELECT 申请年份
❌ WHERE 申请类型 = '发明'

【正确示例】
✓ FROM patent_data
✓ SELECT apply_year AS 申请年份
✓ WHERE apply_type = '发明'

必须使用白名单中的英文原名重写，AS别名可用中文，其他位置绝对禁止中文。`;

    let corrected = await this.regenerateSQL(question, schemas, dbType, history, sql, reason, noChart);

    // 如果重写后的 SQL 仍包含非 ASCII 标识符，再次强制重写
    if (corrected && this.hasNonAsciiIdentifier(corrected)) {
      console.warn('[AIAgent] 重写后的 SQL 仍包含非ASCII标识符，再次强制重写');
      const stricterReason = `SQL 重写后仍包含中文标识符。这是第二次尝试，必须严格遵守：
【强制规则】只能使用以下英文标识符，绝对禁止中文：
表名: ${schemas.map(s => s.tableName).join(', ')}
字段: ${Array.from(new Set(schemas.flatMap(s => s.columns.map(c => c.name)))).join(', ')}
如果再次包含中文，SQL将无法执行。`;
      corrected = await this.regenerateSQL(question, schemas, dbType, history, corrected, stricterReason, noChart);
    }

    // 如果第二次重写仍失败，使用模板匹配生成最简 SQL
    if (corrected && this.hasNonAsciiIdentifier(corrected)) {
      console.error('[AIAgent] 两次重写仍包含非ASCII标识符，回退到模板生成');
      const fallback = this.tryGenerateSQLFromTemplate(question, schemas, dbType, history, noChart);
      if (fallback) {
        console.log('[AIAgent] 使用模板回退SQL:', fallback.sql);
        return fallback.sql;
      }
    }

    return corrected || sql;
  }

  // 清理技术细节，转换为自然语言
  private cleanTechnicalDetails(text: string): string {
    if (!text) return '';

    let cleaned = text;

    // 移除字段名格式 (field_name: value) -> 更自然的描述
    cleaned = cleaned.replace(/record_count:\s*(\d+)/gi, '共 $1 条记录');
    cleaned = cleaned.replace(/count:\s*(\d+)/gi, '共 $1 条');
    cleaned = cleaned.replace(/total:\s*(\d+)/gi, '总计 $1');
    cleaned = cleaned.replace(/max_age:\s*(\d+)/gi, '最大年龄 $1 岁');
    cleaned = cleaned.replace(/min_age:\s*(\d+)/gi, '最小年龄 $1 岁');
    cleaned = cleaned.replace(/avg_age:\s*([\d.]+)/gi, '平均年龄 $1 岁');
    cleaned = cleaned.replace(/max:\s*(\d+)/gi, '最大值 $1');
    cleaned = cleaned.replace(/min:\s*(\d+)/gi, '最小值 $1');
    cleaned = cleaned.replace(/avg:\s*([\d.]+)/gi, '平均值 $1');
    cleaned = cleaned.replace(/sum:\s*(\d+)/gi, '总和 $1');

    // 移除下划线命名的字段名
    cleaned = cleaned.replace(/(\w+)_(\w+):\s*/gi, (match, p1, p2) => {
      // 保留中文
      if (/[\u4e00-\u9fa5]/.test(match)) return match;
      return '';
    });

    // 清理多余的逗号和空格
    cleaned = cleaned.replace(/,\s*,/g, ',');
    cleaned = cleaned.replace(/\s+/g, ' ');
    cleaned = cleaned.trim();

    // 如果清理后太短，返回原文
    if (cleaned.length < 5) return text;

    return cleaned;
  }

  // 构建上下文消息（限制数量节省 token）
  private buildContextMessages(history: ChatMessage[]): { role: 'user' | 'assistant' | 'system'; content: string }[] {
    const recentHistory = history.slice(-4); // 只保留最近4条，节省 token
    return recentHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content.slice(0, 200) // 限制每条消息长度
    }));
  }


  // 意图识别 - 使用 AI 规划 SQL 查询
  private async planAction(
    question: string,
    schemas: TableSchema[],
    dbType: string,
    history: ChatMessage[]
  ): Promise<ToolCall> {
    // 检测是否为非数据查询（闲聊、问候等）
    const q = question.toLowerCase();
    const isChitChat = this.isChitChatQuestion(q);

    if (isChitChat) {
      return {
        type: 'chitchat',
        name: 'chitchat',
        params: { question },
        needChart: false
      };
    }

    // 使用 AI 进行意图识别和路由
    try {
      // 构建精简的表结构描述
      const schemaDesc = schemas.slice(0, 100).map(t => {
        const cols = t.columns.slice(0, 1000).map(c => `${c.name}(${c.type.split('(')[0]})`).join(',');
        return `${t.tableName}: ${cols}`;
      }).join('\n');

      // 1. 构建提示词
      const identifierRules = this.buildSqlIdentifierRules(schemas, dbType);
      const prompt = `你是 AI 数据助手。请根据用户问题选择最合适的工具、图表类型和图表配置。

可选工具:
- sql: 查询具体数据 (如: "查询用户表", "统计销售额", "画个图", "Top 10")
- data.advanced_query: 高级数据分析 (如: "同比/环比分析", "增长率计算", "复杂聚合", "多表关联分析")
- qa.expert: 专家问答/咨询 (如: "如何优化库存", "给出营销建议", "深度分析原因")
- report.summary: 生成数据摘要报告 (如: "生成摘要报告", "做个数据总结")
- report.ppt: 生成 PPT 报告 (如: "生成 PPT", "导出演示文稿")
- report.dashboard: 生成数据大屏/看板 (如: "生成大屏", "做个 dashboard")
- report.excel: 生成 Excel 报表 (如: "导出 Excel 报表", "做个 Excel 数据包")
- report.insight: 自动生成智能洞察 (如: "给出洞察", "总结关键发现")
- report.compare: 生成对比分析报告 (如: "按地区对比销售额", "对比各渠道表现")
- report.comprehensive: 生成综合报告 (如: "生成销售分析报告", "写一份市场调研文档")
- crawler.extract: 网页抓取/提取 (如: "抓取这个网站的内容", "提取网页上的价格", "从网址获取信息")
- data.analyze: 深度分析/总结/洞察 (如: "分析这个数据源", "给出业务总结")
- file.readFile: 读取文件内容 (如: "读取这个文件", "查看文件内容")
- file.writeFile: 写入文件 (如: "把结果保存到文件", "导出为文件")
- web.fetchUrl: 获取网页内容 (如: "访问这个网址", "获取API数据")
- pdf.readPdf: 读取PDF文件 (如: "解析这个PDF", "提取PDF内容")
- docx.readWord: 读取Word文档 (如: "读取这个Word文件")
- docx.createWordDocument: 创建Word文档 (如: "生成一份Word报告", "导出为Word")
- pptx.pptxInventory: 查看PPT内容 (如: "分析这个PPT", "查看幻灯片内容")
- image_ocr.ocrImage: 图片文字识别 (如: "识别图片中的文字", "OCR这张图")
- shell.runCommand: 执行系统命令 (如: "运行命令", "执行脚本")
- dataAnalysis.executePython: Python数据分析 (如: "用Python分析", "计算统计指标")
- dataAnalysis.statisticalAnalysis: 统计分析 (如: "算均值/中位数/标准差", "做描述性统计")
- dataAnalysis.createVisualization: Python 绘图 (如: "用 Python 画柱状图", "生成折线图")
- dataAnalysis.pythonEval: Python 表达式计算 (如: "用 Python 计算这个公式")
- chitchat: 闲聊/问候 (如: "你好", "谢谢")

选择规则:
- 明确要“导出 Excel / PPT / 大屏 / 报告 / 洞察 / 对比分析”时，优先选择对应的 report.* 工具
- 选择 report.* 或 dataAnalysis.* 时，必须在 args 中补齐执行所需参数；datasourceId 固定写 "current"
- 选择 report.excel 时，args.queries 必须至少包含一个 { "name": "...", "sql": "SELECT ..." }
- 选择 report.compare 时，args.dimensions 和 args.metrics 必须是数组
- 选择 dataAnalysis.executePython 时，args.code 必须是可直接执行的完整 Python 代码
- 如果需求本质上只是查数/筛选/排序/聚合，优先选 sql，不要滥用 report.* 或 dataAnalysis.*

可选图表类型:
- bar: 柱状图 (适合分类对比、排名)
- line: 折线图 (适合趋势、时间序列)
- pie: 饼图 (适合占比、构成分析，数据项<10个)
- area: 面积图 (适合趋势+累计)
- scatter: 散点图 (适合相关性分析)
- none: 不需要图表 (简单数值查询)

数据表结构:
${schemaDesc}

${identifierRules}

用户问题: ${question}

返回JSON格式: 
{
  "tool": "sql" | "data.advanced_query" | "qa.expert" | "report.summary" | "report.ppt" | "report.dashboard" | "report.excel" | "report.insight" | "report.compare" | "report.comprehensive" | "data.analyze" | "chitchat" | "crawler.extract" | "file.readFile" | "file.writeFile" | "web.fetchUrl" | "pdf.readPdf" | "docx.readWord" | "docx.createWordDocument" | "pptx.pptxInventory" | "image_ocr.ocrImage" | "shell.runCommand" | "dataAnalysis.executePython" | "dataAnalysis.statisticalAnalysis" | "dataAnalysis.createVisualization" | "dataAnalysis.pythonEval", 
  "reason": "原因",
  "args": {
    "toolSpecificParams": "当 tool 是 skill 时填写具体参数"
  },
  "url": "要抓取的网址（如果是抓取工具则必填）",
  "extractDescription": "提取需求描述（如果是抓取工具则必填）",
  "chartType": "bar" | "line" | "pie" | "area" | "scatter" | "none",
  "chartTitle": "简短且具业务意义的图表标题，务必简洁（如'语言分布'而非'各表语言占比统计'）",
  "chartConfig": {
    "xField": "X轴字段名（分类/标签字段，如Name、Date）",
    "yField": "Y轴字段名（数值字段，如GNP、Count）",
    "seriesField": "系列字段名（用于分组，可选，如Region）"
  }
}
`;

      const response = await this.callWithRetry(() => this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })) as any;

      const content = response.choices[0].message.content || '{}';
      const result = JSON.parse(content);
      const tool = result.tool || 'sql';
      const chartTitle = result.chartTitle;
      const chartType = result.chartType || 'bar';
      const chartConfig = result.chartConfig || {};  // AI 配置的图表参数

      console.log(`>>> 意图识别: ${tool} (${result.reason}) - ChartType: ${chartType} - Config: ${JSON.stringify(chartConfig)}`);

      // 2. 根据 AI 选择的工具返回
      switch (tool) {
        case 'chitchat':
          return {
            type: 'chitchat',
            name: 'chitchat',
            params: { question },
            needChart: false
          };

        case 'crawler.extract':
          return {
            type: 'skill',
            name: 'crawler.extract',
            params: {
              url: result.url || (question.match(/https?:\/\/[^\s]+/i) || [])[0],
              description: result.extractDescription || question,
              format: 'json'
            },
            needChart: false
          };

        case 'data.analyze':
          return {
            type: 'skill',
            name: 'data.analyze',
            params: {
              datasourceId: 'current',
              topic: chartTitle || question,
              depth: question.includes('深度') ? 'deep' : 'normal'
            },
            needChart: false
          };

        case 'data.clean':
          return {
            type: 'skill',
            name: 'data.clean',
            params: {
              datasourceId: 'current',
              table: schemas[0]?.tableName || 'unknown'
            },
            needChart: false
          };

        // 新增技能路由：统一通过 skill 类型分发到 skillsRegistry
        case 'file.readFile':
        case 'file.writeFile':
        case 'file.searchFiles':
        case 'web.fetchUrl':
        case 'web.httpRequest':
        case 'pdf.readPdf':
        case 'pdf.mergePdf':
        case 'docx.readWord':
        case 'docx.createWordDocument':
        case 'docx.generateWordReport':
        case 'pptx.pptxInventory':
        case 'pptx.pptxReplaceText':
        case 'image_ocr.ocrImage':
        case 'shell.runCommand':
        case 'report.summary':
        case 'report.ppt':
        case 'report.dashboard':
        case 'report.excel':
        case 'report.insight':
        case 'report.compare':
        case 'report.comprehensive':
        case 'dataAnalysis.executePython':
        case 'dataAnalysis.statisticalAnalysis':
        case 'dataAnalysis.createVisualization':
        case 'dataAnalysis.pythonEval':
        case 'data_analysis.executePython':
          return {
            type: 'skill',
            name: tool,
            params: {
              ...(result.args || {}),
              question,
              path: result.path || result.filePath,
              url: result.url,
            },
            needChart: false
          };

        case 'sql':
        default:
          return {
            type: 'sql',
            name: 'ai_query',
            params: {},
            needChart: chartType !== 'none',
            chartType: chartType,
            chartTitle: chartTitle,
            chartConfig: {
              xField: chartConfig.xField,
              yField: chartConfig.yField,
              seriesField: chartConfig.seriesField
            }
          };
      }
    } catch (error) {
      console.error('意图识别失败，回退到 SQL 模式:', error);
      // 回退逻辑
      return {
        type: 'sql',
        name: 'ai_query',
        params: {},
        needChart: true,
        chartType: 'bar'
      };
    }
  }

  private normalizeSkillName(name: string): string {
    if (!name) return name;
    if (name.startsWith('data_analysis.')) {
      return `dataAnalysis.${name.slice('data_analysis.'.length)}`;
    }
    return name;
  }

  private isNumericColumnType(type?: string): boolean {
    return /int|decimal|numeric|float|double|real|number|bigint|smallint|tinyint/i.test(type || '');
  }

  private isDimensionColumnType(type?: string): boolean {
    return /char|text|enum|date|time|year/i.test(type || '');
  }

  private pickDimensionField(schemas: TableSchema[]): string | undefined {
    const preferredPatterns = [
      /name/i, /名称/, /类型/, /类别/, /分类/, /category/i, /region/i, /地区/, /城市/, /省份/, /部门/,
      /客户/, /产品/, /渠道/, /date/i, /time/i, /year/i, /month/i
    ];

    for (const schema of schemas) {
      for (const column of schema.columns) {
        if (preferredPatterns.some(pattern => pattern.test(column.name))) {
          return column.name;
        }
      }
    }

    for (const schema of schemas) {
      const candidate = schema.columns.find(column => this.isDimensionColumnType(column.type));
      if (candidate) return candidate.name;
    }

    return schemas[0]?.columns[0]?.name;
  }

  private pickMetricField(schemas: TableSchema[]): string | undefined {
    const preferredPatterns = [
      /amount/i, /total/i, /count/i, /num/i, /qty/i, /price/i, /sales/i, /revenue/i, /profit/i,
      /score/i, /rate/i, /value/i, /population/i, /gdp/i, /数量/, /金额/, /销量/, /收入/, /利润/, /得分/, /占比/
    ];

    for (const schema of schemas) {
      for (const column of schema.columns) {
        if (preferredPatterns.some(pattern => pattern.test(column.name))) {
          return column.name;
        }
      }
    }

    for (const schema of schemas) {
      const candidate = schema.columns.find(column => this.isNumericColumnType(column.type));
      if (candidate) return candidate.name;
    }

    return schemas[0]?.columns[1]?.name;
  }

  private buildDefaultSkillParams(
    skillName: string,
    question: string,
    schemas: TableSchema[]
  ): Record<string, any> {
    const primaryTable = schemas[0]?.tableName;
    const dimensionField = this.pickDimensionField(schemas);
    const metricField = this.pickMetricField(schemas);

    switch (skillName) {
      case 'data.analyze':
        return {
          datasourceId: 'current',
          topic: question,
          depth: question.includes('深度') || question.includes('深入') ? 'deep' : 'normal',
        };
      case 'report.summary':
      case 'report.ppt':
      case 'report.dashboard':
      case 'report.comprehensive':
        return {
          datasourceId: 'current',
          topic: question,
        };
      case 'report.insight':
        return {
          datasourceId: 'current',
          focus: question,
          depth: question.includes('深度') || question.includes('深入') ? 'deep' : 'quick',
        };
      case 'report.compare': {
        const params: Record<string, any> = { datasourceId: 'current', format: 'markdown' };
        if (dimensionField) params.dimensions = [dimensionField];
        if (metricField) params.metrics = [metricField];
        return params;
      }
      case 'report.excel':
        return {
          datasourceId: 'current',
          charts: true,
          queries: primaryTable
            ? [{ name: '数据概览', sql: `SELECT * FROM ${primaryTable} LIMIT 100` }]
            : undefined,
        };
      default:
        return {};
    }
  }

  private buildSkillContext(
    dataSource: BaseDataSource,
    schemas: TableSchema[],
    dbType: string,
    workDir = 'public/downloads',
    userId?: string
  ): SkillContext {
    return {
      dataSource,
      schemas,
      dbType,
      openai: this.openai,
      model: this.model,
      workDir,
      userId,
    };
  }

  private buildSkillAnswer(
    skillName: string,
    skillResult: SkillResult
  ): string | undefined {
    const data = skillResult.data;
    const outputPath = skillResult.outputPath || (data && typeof data === 'object' ? data.outputPath : undefined);

    if (typeof data === 'string' && data.trim()) {
      const content = data.trim();
      if (skillResult.message && !content.startsWith(skillResult.message)) {
        return `${skillResult.message}\n\n${content}`;
      }
      return content;
    }

    if (!data || typeof data !== 'object') {
      return skillResult.message;
    }

    if (skillName === 'report.summary' && typeof data.content === 'string') {
      return data.content;
    }

    if (skillName === 'report.ppt') {
      const sections = Array.isArray(data.sections) ? data.sections.join('、') : '未提供';
      return [
        skillResult.message || 'PPT 报告已生成。',
        outputPath ? `输出位置：${outputPath}` : '',
        typeof data.slideCount === 'number' ? `页数：${data.slideCount}` : '',
        `章节：${sections}`,
      ].filter(Boolean).join('\n');
    }

    if (skillName === 'report.dashboard') {
      const chartCount = Array.isArray(data.charts) ? data.charts.length : 0;
      return [
        skillResult.message || '数据大屏已生成。',
        data.previewUrl ? `预览地址：${data.previewUrl}` : '',
        chartCount ? `图表数量：${chartCount}` : '',
      ].filter(Boolean).join('\n');
    }

    if (skillName === 'report.excel') {
      const sheets = Array.isArray(data.sheets) ? data.sheets.join('、') : '未提供';
      return [
        skillResult.message || 'Excel 报表已生成。',
        outputPath ? `输出位置：${outputPath}` : '',
        typeof data.rowCount === 'number' ? `数据行数：${data.rowCount}` : '',
        `工作表：${sheets}`,
      ].filter(Boolean).join('\n');
    }

    if (skillName === 'report.insight') {
      const insights = Array.isArray(data.insights) ? data.insights : [];
      const recommendations = Array.isArray(data.recommendations) ? data.recommendations : [];
      return [
        skillResult.message || '已生成智能洞察。',
        insights.length ? '关键洞察：' : '',
        ...insights.slice(0, 5).map((item: any) => `- ${item.description || JSON.stringify(item)}`),
        recommendations.length ? '建议：' : '',
        ...recommendations.slice(0, 5).map((item: string) => `- ${item}`),
      ].filter(Boolean).join('\n');
    }

    if (skillName === 'report.compare') {
      const comparisons = Array.isArray(data.comparisons) ? data.comparisons : [];
      const preview = comparisons.slice(0, 3).map((item: any) => {
        const values = Array.isArray(item.values)
          ? item.values.map((value: any) => `${value.label}: ${value.value}`).join('，')
          : '';
        return `- ${item.dimension} / ${item.metric}${values ? ` -> ${values}` : ''}`;
      });
      return [
        data.summary || skillResult.message || '对比分析已完成。',
        outputPath ? `输出位置：${outputPath}` : '',
        ...preview,
      ].filter(Boolean).join('\n');
    }

    return skillResult.message;
  }

  // 检测是否为闲聊/非数据查询
  private isChitChatQuestion(question: string): boolean {
    const chitChatPatterns = [
      /你是谁/, /你叫什么/, /你的名字/,
      /你好/, /您好/, /嗨/, /hi/i, /hello/i,
      /谢谢/, /感谢/, /thanks/i,
      /再见/, /拜拜/, /bye/i,
      /你能做什么/, /你会什么/, /你的功能/,
      /帮助/, /help/i,
      /今天天气/, /几点了/, /什么时间/,
      /讲个笑话/, /说个故事/,
    ];

    return chitChatPatterns.some(pattern => pattern.test(question));
  }

  // 快速判断是否为明确的数据查询（跳过 AI 意图识别，节省一次 LLM 调用）
  private isClearDataQuery(question: string): boolean {
    const dataQueryPatterns = [
      /多少/, /几个/, /有哪些/, /哪些/, /哪个/,
      /排名/, /top\s*\d/i, /前\d/, /最大/, /最小/, /最高/, /最低/, /最多/, /最少/,
      /统计/, /汇总/, /总数/, /总量/, /平均/, /总和/, /总共/, /合计/,
      /分布/, /占比/, /比例/, /趋势/, /增长/, /下降/,
      /查询/, /查一下/, /列出/, /显示/, /展示/,
      /画个图/, /生成图/, /柱状图/, /饼图/, /折线图/,
      /group\s+by/i, /select/i, /count/i, /sum/i, /avg/i,
      // 分析类问题（在数据平台上几乎都是数据查询）
      /分析/, /特征/, /对比/, /比较/, /变化/, /波动/, /规律/,
      /相关/, /关系/, /影响/, /因素/, /原因/,
      /指标/, /维度/, /概况/, /情况/, /现状/,
      /增减/, /消耗/, /营收/, /销售/, /利润/,
      /发明/, /专利/, /申请/, /授权/, /引用/,
    ];
    return dataQueryPatterns.some(pattern => pattern.test(question));
  }

  // 保留旧的简单规划逻辑作为备用
  private planActionSimple(
    question: string,
    schemas: TableSchema[]
  ): ToolCall {
    const tables = schemas.map(s => s.tableName);
    const firstTable = tables[0] || 'data';

    // 获取第一个表的字段
    const firstSchema = schemas[0];

    // 智能识别数值字段
    const numericFields = firstSchema?.columns
      .filter(c => {
        const t = c.type.toLowerCase();
        return t.includes('int') || t.includes('decimal') || t.includes('float') || t.includes('double') || t.includes('number');
      })
      .map(c => c.name) || [];

    // 智能识别标签字段（名称、类型等）
    const labelFields = firstSchema?.columns
      .filter(c => {
        const n = c.name.toLowerCase();
        const t = c.type.toLowerCase();
        return (t.includes('char') || t.includes('text') || t.includes('string')) &&
          (n.includes('name') || n.includes('名') || n.includes('type') || n.includes('类') ||
            n.includes('region') || n.includes('区') || n.includes('category') || n.includes('分类'));
      })
      .map(c => c.name) || [];

    // 智能识别日期字段
    const dateFields = firstSchema?.columns
      .filter(c => {
        const t = c.type.toLowerCase();
        const n = c.name.toLowerCase();
        return t.includes('date') || t.includes('time') || n.includes('date') || n.includes('日期') || n.includes('时间');
      })
      .map(c => c.name) || [];

    // 如果没有找到合适的字段，使用第一个字段
    const labelField = labelFields[0] || firstSchema?.columns[0]?.name || 'id';
    const numericField = numericFields[0] || firstSchema?.columns.find(c => c.type.toLowerCase().includes('int'))?.name || 'id';
    const dateField = dateFields[0];

    const q = question.toLowerCase();

    // 1. 趋势分析（需要日期字段）
    if ((q.includes('趋势') || q.includes('变化') || q.includes('走势')) && dateField) {
      return {
        type: 'skill',
        name: 'trend_analysis',
        params: {
          table: firstTable,
          dateField: dateField,
          valueField: numericField,
          aggregation: 'count'
        },
        needChart: true,
        chartType: 'line'
      };
    }

    // 2. 分布/占比类问题
    if (q.includes('分布') || q.includes('占比') || q.includes('各') || q.includes('每个') || q.includes('按')) {
      // 找分组字段
      const groupField = firstSchema?.columns.find(c => {
        const n = c.name.toLowerCase();
        return n.includes('type') || n.includes('类') || n.includes('region') || n.includes('区') ||
          n.includes('category') || n.includes('分类') || n.includes('性别') || n.includes('sex');
      })?.name || labelField;

      return {
        type: 'skill',
        name: 'data_comparison',
        params: {
          table: firstTable,
          compareField: groupField,
          valueField: numericField || 'COUNT(1)'
        },
        needChart: true,
        chartType: 'pie'
      };
    }

    // 3. 统计类问题
    if (q.includes('多少') || q.includes('总数') || q.includes('统计') || q.includes('数量') || q.includes('总共')) {
      // 找分组字段
      const groupField = firstSchema?.columns.find(c => {
        const n = c.name.toLowerCase();
        return n.includes('type') || n.includes('类') || n.includes('region') || n.includes('区') ||
          n.includes('category') || n.includes('分类');
      })?.name;

      return {
        type: 'skill',
        name: 'data_statistics',
        params: {
          table: firstTable,
          field: numericField,
          groupBy: groupField
        },
        needChart: !!groupField,
        chartType: 'bar'
      };
    }

    // 4. 排名类问题
    if (q.includes('最多') || q.includes('最大') || q.includes('最高') || q.includes('top') || q.includes('排名') || q.includes('哪个')) {
      return {
        type: 'skill',
        name: 'top_ranking',
        params: {
          table: firstTable,
          rankField: numericField,
          labelField: labelField,
          limit: 10
        },
        needChart: true,
        chartType: 'bar'
      };
    }

    // 5. 图表类问题
    if (q.includes('图') || q.includes('chart') || q.includes('画')) {
      return {
        type: 'skill',
        name: 'top_ranking',
        params: {
          table: firstTable,
          rankField: numericField,
          labelField: labelField,
          limit: 10
        },
        needChart: true,
        chartType: 'bar'
      };
    }

    // 默认：统计总数
    return {
      type: 'skill',
      name: 'data_statistics',
      params: {
        table: firstTable,
        field: numericField
      },
      needChart: false,
      chartType: 'bar'
    };
  }


  // 检测地址类字段
  private detectAddressFields(schemas: TableSchema[]): string {
    const addressKeywords = ['地址', '住址', '籍贯', '户籍', '居住地', 'address', '所在地'];
    const addressFields: string[] = [];

    for (const schema of schemas) {
      for (const col of schema.columns) {
        const name = col.name.toLowerCase();
        const comment = (col.comment || '').toLowerCase();

        if (addressKeywords.some(k => name.includes(k) || comment.includes(k))) {
          addressFields.push(`- ${schema.tableName}.${col.name} 是地址字段，统计时应按省份分组`);
        }
      }
    }

    if (addressFields.length === 0) {
      return '- 当前数据中未检测到地址字段';
    }

    return addressFields.join('\n');
  }

  // 分析表关系
  private analyzeTableRelations(schemas: TableSchema[]): string {
    const tableNames = schemas.map(s => s.tableName.toLowerCase());
    let relations = '**表关系说明**:\n';

    // 检测常见的表关系
    if (tableNames.includes('country') && tableNames.includes('city')) {
      relations += '- country 表存储国家信息（包含国家人口 Population）\n';
      relations += '- city 表存储城市信息（包含城市人口 Population，通过 CountryCode 关联 country）\n';
      relations += '- 注意：city.Population 是城市人口，country.Population 是国家人口，两者不同！\n';
    }

    if (tableNames.includes('countrylanguage')) {
      relations += '- countrylanguage 表存储国家语言信息（通过 CountryCode 关联 country）\n';
    }

    // 检测主键外键关系
    for (const schema of schemas) {
      const pkCols = schema.columns.filter(c => c.isPrimaryKey);
      if (pkCols.length > 0) {
        relations += `- ${schema.tableName} 主键: ${pkCols.map(c => c.name).join(', ')}\n`;
      }
    }

    return relations;
  }

  // 验证查询结果的合理性
  private async validateResult(
    question: string,
    sql: string,
    result: any[],
    schemas: TableSchema[]
  ): Promise<{ isValid: boolean; reason?: string }> {
    if (!result || result.length === 0) {
      return { isValid: true }; // 空结果不一定是错误
    }

    const q = question.toLowerCase();
    const sqlLower = sql.toLowerCase();

    // 检查1: 世界/全球人口统计应该用 country 表
    if ((q.includes('世界') || q.includes('全球') || q.includes('总人口')) &&
      q.includes('人口') &&
      sqlLower.includes('from city')) {
      return {
        isValid: false,
        reason: '统计世界/全球人口应该使用 country 表的 Population 字段，而不是 city 表。city 表只包含城市人口，会导致重复计算或遗漏。'
      };
    }

    // 检查2: 国家数量统计应该用 country 表
    if ((q.includes('国家') || q.includes('多少个国家')) &&
      q.includes('多少') &&
      !sqlLower.includes('country')) {
      return {
        isValid: false,
        reason: '统计国家数量应该使用 country 表。'
      };
    }

    // 检查3: 结果数值的合理性检查
    if (result.length === 1) {
      const firstRow = result[0];
      const values = Object.values(firstRow);

      for (const val of values) {
        if (typeof val === 'number') {
          // 世界人口应该在 60-80 亿之间
          if ((q.includes('世界') || q.includes('全球')) && q.includes('人口')) {
            if (val < 1000000000 || val > 100000000000) {
              // 如果结果不在合理范围内，可能查错了表
              if (val < 5000000000) {
                return {
                  isValid: false,
                  reason: `统计结果 ${val} 看起来偏小，世界人口应该约为 60-80 亿。请检查是否使用了正确的表（应该用 country 表）。`
                };
              }
            }
          }
        }
      }
    }

    return { isValid: true };
  }

  // 重新生成 SQL（带错误修正提示）- 精简版
  private async regenerateSQL(
    question: string,
    schemas: TableSchema[],
    dbType: string,
    history: ChatMessage[],
    previousSql: string,
    errorReason: string,
    noChart?: boolean
  ): Promise<string> {
    await this.ensureInitialized();

    const schemaCompact = schemas.map(t => t.tableName + ':' + t.columns.slice(0, 1000).map(c => c.name).join(',')).join('\n');

    const response = await this.callWithRetry(() => this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `SQL修正器(${dbType})。只返回正确SQL。统计条数用COUNT(1)不用COUNT(*)。
表:${schemaCompact}
错误SQL:${previousSql}
原因:${errorReason}
注意：请确保SQL语句中不使用中文标识符。`
        },
        { role: 'user', content: question }
      ],
      temperature: 0,
    })) as any;

    const sql = response.choices[0].message.content?.trim() || '';
    return cleanSQL(sql);
  }

  // 处理闲聊/非数据查询 - 使用固定回复节省 token
  private handleChitChat(question: string): string {
    const q = question.toLowerCase();

    // 问身份
    if (/你是谁|你叫什么|你的名字|介绍.*自己/.test(q)) {
      return '你好！我是AI数据问答平台的智能助手，可以帮你分析数据、生成SQL查询、创建图表。支持MySQL、PostgreSQL等数据库，以及CSV、Excel文件。有什么数据问题可以问我哦！😊';
    }

    // 打招呼
    if (/^(你好|您好|嗨|hi|hello|hey)/i.test(q)) {
      return '你好！有什么数据分析问题需要帮忙吗？';
    }

    // 感谢
    if (/谢谢|感谢|thanks/i.test(q)) {
      return '不客气！还有其他数据问题可以继续问我。';
    }

    // 再见
    if (/再见|拜拜|bye/i.test(q)) {
      return '再见！有问题随时来找我。';
    }

    // 问功能
    if (/你能做什么|你会什么|你的功能|帮助|help/i.test(q)) {
      return '我可以帮你：\n1. 查询和分析数据库数据\n2. 生成SQL查询语句\n3. 创建数据可视化图表\n4. 进行数据质量检测\n5. 生成分析报告\n\n直接用自然语言描述你的问题就行！';
    }

    // 默认回复
    return '你好！我是数据分析助手。请问有什么数据相关的问题需要帮忙吗？';
  }

  /**
   * AI 翻译功能：将图表中的标签批量翻译为中文
   */
  async translate(texts: string[]): Promise<Record<string, string>> {
    await this.ensureInitialized();

    if (!texts || texts.length === 0) return {};

    // 过滤掉纯数字或已存在的中文（简单判断）
    const toTranslate = Array.from(new Set(texts.filter(t => /[a-zA-Z]/.test(t))));
    if (toTranslate.length === 0) return {};

    console.log(`>>> AI 翻译请求: ${toTranslate.length} 个文本`);

    try {
      const response = await this.callWithRetry(() => this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `你是一个数据翻译专家。输入一系列数据标签（JSON数组），将其翻译为简洁、准确的中文。保留专有名词（如ID或特殊缩写），地名转换成常用中文名。
只返回JSON对象，Key为原词，Value为翻译词。`
          },
          {
            role: 'user',
            content: JSON.stringify(toTranslate)
          }
        ],
        temperature: 0,
        response_format: { type: 'json_object' }
      })) as any;

      let content = response.choices[0].message.content || '{}';
      // 清理可能的 Markdown 代码块
      content = content.replace(/```json\n?/, '').replace(/\n?```/, '').trim();
      const mapping = JSON.parse(content);
      console.log(`>>> AI 翻译成功: 获得 ${Object.keys(mapping).length} 个映射`);
      return mapping;
    } catch (error: any) {
      console.error('AI 翻译失败:', error.message);
      return {};
    }
  }


  /**
   * 直接翻译功能：调用 Python PaddleOCR 服务的翻译接口（极速）
   */
  async directTranslate(texts: string[]): Promise<Record<string, string>> {
    const ocrPort = process.env.OCR_PORT || 5100;
    const url = `http://localhost:${ocrPort}/translate`;

    try {
      console.log(`>>> 调用 Python 直接翻译: ${texts.length} 个文本`);
      const response = await axios.post(url, { texts, target: 'zh-CN' }, { timeout: 30000 });

      if (response.data && response.data.success) {
        console.log(`>>> Python 直接翻译成功: 获得 ${Object.keys(response.data.data).length} 个映射`);
        return response.data.data;
      }
      throw new Error(response.data?.error || '翻译服务返回失败');
    } catch (error: any) {
      console.error('Python 直接翻译失败, 回退到 AI 翻译:', error.message);
      return this.translate(texts); // 失败时回退到 AI 翻译
    }
  }


  // 主入口：智能问答
  async answer(
    question: string,
    dataSource: BaseDataSource,
    dbType: string,
    history: ChatMessage[] = [],
    noChart?: boolean
  ): Promise<AgentResponse> {
    // 重置 token 计数
    this.lastRequestTokens = 0;

    try {
      // 首先检测是否为闲聊/非数据查询
      const q = question.toLowerCase();
      if (this.isChitChatQuestion(q)) {
        console.log('=== Detected chitchat question (no AI call)');
        const chitChatAnswer = this.handleChitChat(question);
        return { answer: chitChatAnswer, tokensUsed: 0, modelName: 'none' };
      }

      const schemas = await dataSource.getSchema();

      // 检测是否需要数据质量检测
      const needQualityCheck = q.includes('质量') && (q.includes('检测') || q.includes('检查') || q.includes('分析') || q.includes('评估'));

      if (needQualityCheck) {
        console.log('=== Using quality inspection mode');
        const { reports, markdown } = await this.inspectQuality(dataSource, dbType);

        return {
          answer: markdown,
          sql: '',
          data: reports,
          tokensUsed: this.lastRequestTokens,
          modelName: this.model
        };
      }

      // 检测是否需要综合分析（更宽松的匹配）
      const hasAnalysisKeyword = q.includes('分析');
      const hasComprehensiveKeyword =
        q.includes('整体') || q.includes('全面') || q.includes('综合') ||
        q.includes('深入') || q.includes('详细') || q.includes('完整') ||
        q.includes('所有') || q.includes('全部');
      const needComprehensiveAnalysis = hasAnalysisKeyword && hasComprehensiveKeyword;

      if (needComprehensiveAnalysis) {
        console.log('=== Using comprehensive analysis mode');
        await this.ensureInitialized();
        const report = await this.getAnalyst().analyze(question, dataSource, dbType);

        // 格式化报告为自然语言 Markdown
        let answer = `## ${report.title}\n\n`;
        answer += `${report.objective}\n\n`;

        // 分析过程
        answer += `### 分析过程\n\n`;
        for (const step of report.steps) {
          const cleanSummary = this.cleanTechnicalDetails(step.summary || '');
          answer += `**${step.step}. ${step.description}**\n`;
          answer += `${cleanSummary}\n\n`;
        }

        if (report.insights && report.insights.length > 0) {
          answer += `### 主要发现\n\n`;
          for (const insight of report.insights) {
            answer += `- ${insight}\n`;
          }
        }

        answer += `\n### 结论\n\n${report.conclusion}\n`;

        if (report.recommendations && report.recommendations.length > 0) {
          answer += `\n### 建议\n\n`;
          for (const rec of report.recommendations) {
            answer += `- ${rec}\n`;
          }
        }

        // 返回图表数据
        const reportCharts = (!noChart && report.charts) ? report.charts.map(c => ({
          type: c.type,
          title: c.title,
          data: c.data,
          config: {
            labelField: c.labelField,
            valueField: c.valueField,
            xField: c.labelField,
            yField: c.valueField
          }
        })) : [];

        return {
          answer,
          skillUsed: 'comprehensive_analysis',
          charts: reportCharts,  // 返回多个图表
          tokensUsed: this.lastRequestTokens,
          modelName: this.model
        };
      }

      let result: any;
      let sql: string | undefined;
      let skillUsed: string | undefined;
      let toolUsed: string | undefined;
      let chart: ChartData | undefined;

      // 响应时间统计
      const timings: { [key: string]: number } = {};
      const startTime = Date.now();

      // 对于文件类型，使用 AI 来规划查询
      if (dbType === 'file') {
        const planningStart = Date.now();
        console.log('=== Using AI planning for file datasource');
        const queryPlan = await this.planFileQuery(question, schemas, history, noChart);
        timings['规划'] = Date.now() - planningStart;
        const internalSql = queryPlan.sql;
        console.log('AI generated query:', internalSql);

        // 执行查询
        const executionStart = Date.now();
        const queryResult = await dataSource.executeQuery(internalSql);
        timings['执行'] = Date.now() - executionStart;
        console.log('Query result:', queryResult.success, 'rows:', queryResult.rowCount);

        if (!queryResult.success) {
          return { answer: `查询失败: ${queryResult.error}`, tokensUsed: this.lastRequestTokens, modelName: this.model };
        }

        result = queryResult.data;

        // 生成图表
        if (queryPlan.chartType && queryPlan.chartType !== 'none' && result && result.length > 1 && !noChart) {
          chart = this.generateChartData(result, (queryPlan.chartType || 'bar') as any, queryPlan.chartTitle || question, schemas, queryPlan.chartConfig);
        }
        console.log('Generated chart:', chart ? 'yes' : 'no', 'data rows:', result.length);

        // 解读结果
        const explanationStart = Date.now();
        const explanation = await this.explainResult(question, result, history, noChart);
        timings['总结'] = Date.now() - explanationStart;

        // 格式化耗时
        const totalTime = Date.now() - startTime;
        const timeStr = `\n\n> ⏱️ 响应耗时: ${totalTime}ms (规划:${timings['规划']}ms, 执行:${timings['执行']}ms, 总结:${timings['总结']}ms)`;

        // 文件类型不返回 SQL
        return {
          answer: explanation + timeStr,
          data: result,
          chart,
          tokensUsed: this.lastRequestTokens,
          modelName: this.model
        };
      }

      // 数据库类型使用技能系统
      // 1. 规划执行方案
      let plan: ToolCall;
      try {
        const planningStart = Date.now();
        plan = await this.planAction(question, schemas, dbType, history);
        timings['规划'] = Date.now() - planningStart;
        console.log('Plan:', JSON.stringify(plan));
      } catch (e: any) {
        console.error('Plan error:', e.message);
        plan = {
          type: 'skill',
          name: 'data_statistics',
          params: { table: schemas[0]?.tableName || 'data' },
          needChart: true,
          chartType: 'bar'
        };
      }

      // 2. 执行
      console.log('=== Executing plan type:', plan.type, 'name:', plan.name);
      const executionStart = Date.now();

      // 处理闲聊/非数据查询
      if (plan.type === 'chitchat') {
        const chitChatAnswer = this.handleChitChat(question);
        return { answer: chitChatAnswer, tokensUsed: 0, modelName: 'none' };
      }

      let prefixNote = '';
      if (plan.methodology) {
        prefixNote += `📊 分析方法论：${plan.methodology}\n\n`;
      }
      if (plan.missingData) {
        prefixNote += `⚠️ 数据局限：${plan.missingData}\n\n`;
      }

      if (plan.type === 'sql') {
        // 使用 AI 生成 SQL 查询
        console.log('=== Using AI to generate SQL');
        sql = await this.generateSQL(question, schemas, dbType, history, noChart);
        sql = await this.ensureSqlIdentifiersAreValid(question, sql, schemas, dbType, history, noChart);
        console.log('AI generated SQL:', sql);

        // 转义 MySQL 保留字
        const escapedSql = escapeReservedWords(sql, dbType);
        if (escapedSql !== sql) {
          console.log('Escaped SQL:', escapedSql);
        }

        const queryResult = await dataSource.executeQuery(escapedSql);
        if (!queryResult.success) {
          return { answer: `查询失败: ${queryResult.error}`, sql, tokensUsed: this.lastRequestTokens, modelName: this.model };
        }
        result = queryResult.data;

        // 验证结果合理性
        const validation = await this.validateResult(question, sql, result, schemas);
        if (!validation.isValid && validation.reason) {
          console.log('Result validation failed:', validation.reason);
          console.log('Regenerating SQL with correction...');

          // 重新生成 SQL，带上错误提示
          sql = await this.regenerateSQL(question, schemas, dbType, history, sql || '', validation.reason, noChart);
          console.log('Corrected SQL:', sql);

          // 转义保留字
          const escapedCorrectedSql = escapeReservedWords(sql, dbType);
          const retryResult = await dataSource.executeQuery(escapedCorrectedSql);
          if (retryResult.success) {
            result = retryResult.data;
          }
        }

        // 根据结果生成图表
        if (result && result.length > 1 && !noChart) {
          chart = this.generateChartData(result, 'bar', plan.chartTitle || question, schemas);
        }
      }

      if (plan.type === 'skill') {
        const resolvedSkillName = this.normalizeSkillName(plan.name);
        const skill = skillsRegistry.get(resolvedSkillName);
        console.log('Looking for skill:', resolvedSkillName, 'found:', !!skill);

        if (skill) {
          const skillParams = {
            ...this.buildDefaultSkillParams(resolvedSkillName, question, schemas),
            ...(plan.params || {}),
          };
          console.log('Executing skill:', resolvedSkillName, 'params:', JSON.stringify(skillParams));
          const ctx = this.buildSkillContext(dataSource, schemas, dbType, 'public/downloads');

          try {
            const skillResult = await skill.execute(skillParams, ctx);
            console.log('Skill result success:', skillResult.success);
            result = skillResult.data;
            skillUsed = resolvedSkillName;

            // 如果技能返回了可视化配置，生成图表
            if (skillResult.visualization && !noChart) {
              chart = {
                type: skillResult.visualization.type as any,
                title: skillResult.visualization.title || question.slice(0, 30),
                data: skillResult.visualization.data,
                config: {
                  xField: skillResult.visualization.xField,
                  yField: skillResult.visualization.yField,
                  labelField: skillResult.visualization.xField,
                  valueField: skillResult.visualization.yField
                }
              };
            }

            if (!skillResult.success) {
              return { answer: skillResult.message || '技能执行失败', skillUsed, tokensUsed: this.lastRequestTokens, modelName: this.model };
            }

            const directSkillAnswer = this.buildSkillAnswer(resolvedSkillName, skillResult);
            if (directSkillAnswer) {
              const totalTime = Date.now() - startTime;
              const timeStr = `\n\n> ⏱️ 响应耗时: ${totalTime}ms (规划:${timings['规划']}ms, 执行:${Date.now() - executionStart}ms)`;
              return {
                answer: prefixNote + directSkillAnswer + timeStr,
                data: typeof result === 'string' ? undefined : result,
                skillUsed,
                chart,
                visualization: skillResult.visualization,
                tokensUsed: this.lastRequestTokens,
                modelName: this.model
              };
            }
          } catch (skillError: any) {
            console.error('Skill execution error:', skillError);
            return { answer: `技能执行出错: ${skillError.message}`, skillUsed: resolvedSkillName, tokensUsed: this.lastRequestTokens, modelName: this.model };
          }
        } else {
          // 技能不存在，回退到简单SQL
          console.log('Skill not found, falling back to SQL');
          sql = await this.generateSQL(question, schemas, dbType, history, noChart);
          const escapedSql = escapeReservedWords(sql, dbType);
          const queryResult = await dataSource.executeQuery(escapedSql);
          if (!queryResult.success) {
            return { answer: `查询失败: ${queryResult.error}`, sql, tokensUsed: this.lastRequestTokens, modelName: this.model };
          }
          result = queryResult.data;
        }
      } else if (plan.type === 'mcp') {
        const { server, tool, ...toolParams } = plan.params;
        const mcpResult = await mcpRegistry.callTool(server, tool, toolParams);
        toolUsed = `${server}/${tool}`;
        if (mcpResult.isError) {
          return { answer: mcpResult.content[0]?.text || '工具执行失败', toolUsed, tokensUsed: this.lastRequestTokens, modelName: this.model };
        }
        result = mcpResult.content.map((c: any) => c.text).join('\n');
      }

      timings['执行'] = Date.now() - executionStart;

      // 3. 生成图表（如果技能没有生成且需要图表）
      if (!chart && plan.needChart && Array.isArray(result) && result.length > 1 && !noChart) {
        chart = this.generateChartData(result, plan.chartType || 'bar', plan.chartTitle || question, schemas, plan.chartConfig);
      }

      // 4. 解读结果
      const explanationStart = Date.now();
      const explanation = await this.explainResult(question, result, history, noChart);
      timings['总结'] = Date.now() - explanationStart;

      // 格式化耗时
      const totalTime = Date.now() - startTime;
      const timeStr = `\n\n> ⏱️ 响应耗时: ${totalTime}ms (规划:${timings['规划']}ms, 执行:${timings['执行']}ms, 总结:${timings['总结']}ms)`;

      return {
        answer: prefixNote + explanation + timeStr,
        sql,
        data: Array.isArray(result) ? result : (result?.dimensions ? result : undefined),
        skillUsed,
        toolUsed,
        chart,
        tokensUsed: this.lastRequestTokens,
        modelName: this.model
      };
    } catch (error: any) {
      return { answer: `处理失败: ${error.message}`, tokensUsed: this.lastRequestTokens, modelName: this.model };
    }
  }

  // 全局超时守卫：复杂问答流程（意图识别→SQL生成→执行→验证→回答）可能涉及 3-4 次 AI 调用，
  // 每次 30-60 秒属于正常范围，需要留足时间以保证回答正确性。
  private static readonly ANSWER_TIMEOUT_MS = 300_000; // 300 秒（5 分钟）

  // 带上下文的智能问答（优化版，减少 token 使用）
  async answerWithContext(
    question: string,
    dataSource: BaseDataSource,
    dbType: string,
    history: ChatMessage[] = [],
    context?: {
      schemaContext?: string;  // 预处理的 schema 上下文（中文名称）
      ragContext?: string;     // RAG 知识库上下文
      noChart?: boolean;       // 是否禁用图表
      signal?: AbortSignal;    // 取消信号
      requestId?: string;      // 可选：外部传入的请求ID，用于串联日志
    }
  ): Promise<AgentResponse> {
    // 检查取消信号
    if (context?.signal?.aborted) {
      return { answer: '请求已取消', tokensUsed: 0, modelName: 'none' };
    }

    const requestId = context?.requestId || `req_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const stage = { name: 'init' as string, startAt: Date.now() };

    // 全局超时守卫：用于兜底整个流程（SQL执行/AI调用等）。
    // 注意：回答生成阶段本身已在 generateChineseAnswer 内部做了硬超时+降级，因此这里主要防止极端卡死。
    try {
      console.log(`[AIAgent][${requestId}] answerWithContext start dbType=${dbType} q=${String(question).slice(0, 80)}`);
      return await Promise.race([
        this._answerWithContextImpl(question, dataSource, dbType, history, { ...context, requestId }, stage),
        new Promise<AgentResponse>((_, reject) =>
          setTimeout(() => {
            const elapsed = Date.now() - stage.startAt;
            console.error(`[AIAgent][${requestId}] answerWithContext timeout after ${elapsed}ms, stage=${stage.name}`);
            reject(new Error('AI 响应超时（300s），请稍后重试或简化问题'));
          }, AIAgent.ANSWER_TIMEOUT_MS)
        ),
      ]);
    } catch (error: any) {
      const elapsed = Date.now() - stage.startAt;
      console.error(`[AIAgent][${requestId}] answerWithContext failed after ${elapsed}ms, stage=${stage.name}, err=${error?.message || error}`);
      return {
        answer: error.message?.includes('超时') ? error.message : `处理失败: ${error.message}`,
        tokensUsed: this.lastRequestTokens,
        modelName: this.model || 'unknown',
      };
    }
  }

  // answerWithContext 实际实现
  private async _answerWithContextImpl(
    question: string,
    dataSource: BaseDataSource,
    dbType: string,
    history: ChatMessage[] = [],
    context?: {
      schemaContext?: string;
      ragContext?: string;
      noChart?: boolean;
      signal?: AbortSignal;
      requestId?: string;
    }
    ,
    stage?: { name: string; startAt: number }
  ): Promise<AgentResponse> {
    // 重置 token 计数
    this.lastRequestTokens = 0;
    const q = question.toLowerCase();

    try {
      // 1. 检测是否需要生成报告（调用 Skill，支持 AI 深度分析）
      const reportIntent = this.detectReportIntent(q);
      if (reportIntent) {
        console.log('=== Detected report intent:', reportIntent);
        return this.handleReportRequest(question, dataSource, dbType, reportIntent, context);
      }

      // 2. 检测是否为闲聊/非数据查询
      if (this.isChitChatQuestion(q)) {
        console.log('=== Detected chitchat question (no AI call)');
        const chitChatAnswer = this.handleChitChat(question);
        return { answer: chitChatAnswer, tokensUsed: 0, modelName: 'none' };
      }

      const allSchemas = await dataSource.getSchema();

      // 检测是否需要数据质量检测
      const needQualityCheck = q.includes('质量') && (q.includes('检测') || q.includes('检查') || q.includes('分析') || q.includes('评估'));

      if (needQualityCheck) {
        console.log('=== Using quality inspection mode');
        const { reports, markdown } = await this.inspectQuality(dataSource, dbType);
        return {
          answer: markdown,
          sql: '',
          data: reports,
          tokensUsed: this.lastRequestTokens,
          modelName: this.model
        };
      }

      // 检测是否需要综合分析
      const hasAnalysisKeyword = q.includes('分析');
      const hasComprehensiveKeyword =
        q.includes('整体') || q.includes('全面') || q.includes('综合') ||
        q.includes('深入') || q.includes('详细') || q.includes('完整') ||
        q.includes('所有') || q.includes('全部');
      const needComprehensiveAnalysis = hasAnalysisKeyword && hasComprehensiveKeyword;

      if (needComprehensiveAnalysis) {
        // 综合分析使用原有逻辑
        return this.answer(question, dataSource, dbType, history, context?.noChart);
      }

      // 智能裁剪：只发送与问题相关的表的 schema，减少 prompt token
      const schemas = this.filterRelevantSchemas(allSchemas, question);
      if (schemas.length < allSchemas.length) {
        console.log(`=== Schema裁剪: ${allSchemas.length}表 -> ${schemas.length}表`);
      }

      let result: any;
      let sql: string | undefined;
      let skillUsed: string | undefined;
      let toolUsed: string | undefined;
      let chart: ChartData | undefined;

      // 响应时间统计
      const timings: { [key: string]: number } = {};
      const startTime = Date.now();

      // 步骤1: 意图识别
      if (stage) stage.name = '步骤1:意图识别';
      console.log(`=== 步骤1: 意图识别${context?.requestId ? ` [${context.requestId}]` : ''}`);
      const understandStart = Date.now();

      // 使用优化的 schema 上下文（如果提供）
      const schemaForAI = context?.schemaContext || this.formatSchemaForAI(schemas);

      // 构建增强的系统提示（包含 RAG 上下文）
      let systemPromptAddition = '';
      if (context?.ragContext) {
        systemPromptAddition = `\n\n相关知识背景:\n${context.ragContext.slice(0, 500)}`;
        console.log('=== Using RAG context, length:', context.ragContext.length);
      }

      // 意图识别：判断是否为明确的数据查询，否则调用 AI 意图路由
      const isClearDataQuery = this.isClearDataQuery(q);
      let preChartInfo: { chartType?: string; chartTitle?: string; chartConfig?: any } | undefined;
      if (!isClearDataQuery && dbType !== 'file') {
        console.log('=== 非明确数据查询，调用 AI 意图识别');
        try {
          const plan = await this.planAction(question, schemas, dbType, history);
          timings['意图识别'] = Date.now() - understandStart;
          console.log('=== 意图识别结果:', plan.type, plan.name);

          // 非 SQL 意图：直接路由到对应处理器
          if (plan.type === 'chitchat') {
            return { answer: this.handleChitChat(question), tokensUsed: this.lastRequestTokens, modelName: 'none' };
          }
          if (plan.type === 'skill') {
            timings['理解'] = Date.now() - understandStart;
            const executionStart = Date.now();
            const resolvedSkillName = this.normalizeSkillName(plan.name);
            const skill = skillsRegistry.get(resolvedSkillName);

            if (!skill) {
              return {
                answer: `技能未启用: ${resolvedSkillName}`,
                skillUsed: resolvedSkillName,
                tokensUsed: this.lastRequestTokens,
                modelName: this.model,
              };
            }

            const skillParams = {
              ...this.buildDefaultSkillParams(resolvedSkillName, question, schemas),
              ...(plan.params || {}),
            };
            const skillContext = this.buildSkillContext(dataSource, schemas, dbType, 'public/downloads');
            const skillResult = await skill.execute(skillParams, skillContext);
            timings['执行'] = Date.now() - executionStart;

            if (!skillResult.success) {
              return {
                answer: skillResult.message || '技能执行失败',
                skillUsed: resolvedSkillName,
                tokensUsed: this.lastRequestTokens,
                modelName: this.model,
              };
            }

            let chart: ChartData | undefined;
            if (skillResult.visualization && !context?.noChart) {
              const visualization = skillResult.visualization;
              if (visualization.type === 'bar' || visualization.type === 'line' || visualization.type === 'pie' || visualization.type === 'scatter') {
                chart = {
                  type: visualization.type as any,
                  title: visualization.title || question.slice(0, 30),
                  data: visualization.data,
                  config: {
                    xField: visualization.xField,
                    yField: visualization.yField,
                    labelField: visualization.xField,
                    valueField: visualization.yField,
                  }
                };
              }
            }

            const answerStart = Date.now();
            const explanation = this.buildSkillAnswer(resolvedSkillName, skillResult) || '技能执行成功';
            timings['生成回答'] = Date.now() - answerStart;

            const totalTime = Date.now() - startTime;
            const timeStr = `\n\n> ⏱️ 响应耗时: ${totalTime}ms (理解:${timings['理解']}ms, 执行:${timings['执行']}ms, 生成回答:${timings['生成回答']}ms)`;

            return {
              answer: explanation + timeStr,
              data: typeof skillResult.data === 'string' ? undefined : skillResult.data,
              skillUsed: resolvedSkillName,
              visualization: skillResult.visualization,
              chart,
              tokensUsed: this.lastRequestTokens,
              modelName: this.model,
            };
          }
          if (plan.type === 'mcp') {
            return this.answer(question, dataSource, dbType, history, context?.noChart);
          }
          // sql 意图：复用 planAction 的图表配置，避免 generateSQLWithContext 重复计算
          if (plan.type === 'sql') {
            preChartInfo = {
              chartType: plan.chartType,
              chartTitle: plan.chartTitle,
              chartConfig: plan.chartConfig
            };
          }
        } catch (e: any) {
          console.error('意图识别失败，默认走 SQL 流程:', e.message);
        }
      }
      timings['理解'] = Date.now() - understandStart;

      // 对于文件类型，使用 AI 来规划查询
      if (dbType === 'file') {
        // 步骤2: 生成SQL
        const planningStart = Date.now();
        console.log('=== 步骤2: 生成查询语句 (file)');
        const queryPlan = await this.planFileQueryWithContext(question, schemas, history, schemaForAI, systemPromptAddition, context?.noChart);
        timings['生成SQL'] = Date.now() - planningStart;
        const internalSql = queryPlan.sql;
        console.log('AI generated query:', internalSql);

        // 步骤3: 执行查询
        const executionStart = Date.now();
        console.log('=== 步骤3: 执行查询');
        const queryResult = await dataSource.executeQuery(internalSql, context?.signal);
        timings['执行'] = Date.now() - executionStart;
        console.log('Query result:', queryResult.success, 'rows:', queryResult.rowCount);

        if (!queryResult.success) {
          return { answer: `查询失败: ${queryResult.error}`, tokensUsed: this.lastRequestTokens, modelName: this.model };
        }

        result = queryResult.data;

        if (queryPlan.chartType && queryPlan.chartType !== 'none' && result && result.length > 1 && !context?.noChart) {
          chart = this.generateChartData(result, queryPlan.chartType as any, queryPlan.chartTitle || question, schemas, queryPlan.chartConfig);
        }

        // 步骤4: AI 生成回答
        const answerStart = Date.now();
        console.log('=== 步骤4: AI 生成回答');
        const explanation = await this.generateChineseAnswer(question, result, history, context?.ragContext, context?.noChart, internalSql, schemaForAI);
        timings['生成回答'] = Date.now() - answerStart;

        const totalTime = Date.now() - startTime;
        const timeStr = `\n\n> ⏱️ 响应耗时: ${totalTime}ms (理解:${timings['理解']}ms, 生成SQL:${timings['生成SQL']}ms, 执行:${timings['执行']}ms, 生成回答:${timings['生成回答']}ms)`;

        return {
          answer: explanation + timeStr,
          data: result,
          chart,
          tokensUsed: this.lastRequestTokens,
          modelName: this.model
        };
      }

      // 步骤2: 生成SQL
      if (stage) stage.name = '步骤2:生成SQL';
      const planningStart = Date.now();
      console.log('=== 步骤2: 生成SQL语句');
      // 如果意图识别已经提供了图表配置，传入以简化 SQL 生成 prompt
      const sqlPlan = await this.generateSQLWithContext(question, schemas, dbType, history, schemaForAI, systemPromptAddition, context?.noChart, preChartInfo);
      timings['生成SQL'] = Date.now() - planningStart;
      sql = sqlPlan.sql;
      sql = await this.ensureSqlIdentifiersAreValid(question, sql || '', schemas, dbType, history, context?.noChart);
      sql = this.rewriteSqlForRecentYears(question, sql || '');

      // 大表性能保护：对 patent_data 的 IPC 分布类查询默认限制最近 N 年，避免 1000万级全表 GROUP BY 触发 300s 超时
      const perfGuard = this.applyPatentIpcPerfGuard(sql || '', question);
      if (perfGuard.changed) {
        sql = perfGuard.sql;
        systemPromptAddition += `\n\n提示：由于数据量较大，本次统计默认限定最近 ${perfGuard.yearRange} 年，以保证查询速度。`;
        console.log(`[AIAgent] PerfGuard applied: yearRange=${perfGuard.yearRange}`);
      }

      console.log('AI generated SQL:', sql);

      // 转义 MySQL 保留字
      let escapedSql = escapeReservedWords(sql || '', dbType);
      if (escapedSql !== sql) {
        console.log('Escaped SQL:', escapedSql);
      }

      // 强制添加 LIMIT 限制，防止返回过多数据
      const hasLimit = /\bLIMIT\s+\d+/i.test(escapedSql);
      if (!hasLimit && /^\s*SELECT/i.test(escapedSql)) {
        // 检查是否是聚合查询（有 GROUP BY 或聚合函数但没有 GROUP BY）
        const hasGroupBy = /\bGROUP\s+BY\b/i.test(escapedSql);
        const hasAggregateOnly = /\b(COUNT|SUM|AVG|MAX|MIN)\s*\(/i.test(escapedSql) && !hasGroupBy;
        if (!hasAggregateOnly) {
          // 非纯聚合查询，添加 LIMIT
          escapedSql = escapedSql.replace(/;?\s*$/, '') + ' LIMIT 100';
          console.log('Added LIMIT 100 to SQL:', escapedSql);
        }
      }

      // 步骤3: 执行查询
      if (stage) stage.name = '步骤3:执行查询';
      const executionStart = Date.now();
      console.log('=== 步骤3: 执行查询');
      const queryResult = await dataSource.executeQuery(escapedSql, context?.signal);
      timings['执行'] = Date.now() - executionStart;
      if (!queryResult.success) {
        return { answer: `查询失败: ${queryResult.error}`, sql, tokensUsed: this.lastRequestTokens, modelName: this.model };
      }
      result = queryResult.data;

      // SQL 结果验证：检查结果是否合理，不合理则重新生成 SQL
      const validation = await this.validateResult(question, sql || '', result, schemas);
      if (!validation.isValid && validation.reason) {
        console.log('=== 结果验证失败:', validation.reason);
        console.log('=== 重新生成SQL...');
        const correctedSql = await this.regenerateSQL(question, schemas, dbType, history, sql || '', validation.reason, context?.noChart);
        console.log('=== 修正后的SQL:', correctedSql);
        const correctedEscapedSql = escapeReservedWords(correctedSql, dbType);
        const retryResult = await dataSource.executeQuery(correctedEscapedSql);
        if (retryResult.success) {
          result = retryResult.data;
          sql = correctedSql;
        }
      }

      // 地域自适应下钻：检查是否需要下钻到更细粒度
      const geoDrillDown = await this.executeGeoDrillDown(
        question, dataSource, schemas, dbType, history, result, context?.noChart
      );
      if (geoDrillDown.wasDrillDown) {
        console.log('=== 触发地域下钻，使用下钻结果');
        result = geoDrillDown.result;
        sql = geoDrillDown.sql;
      }

      // 根据结果生成图表（优先使用 sqlPlan 的图表配置，已包含 preChartInfo 复用结果）
      if (result && result.length > 1 && !context?.noChart) {
        chart = this.generateChartData(result, (sqlPlan.chartType || 'bar') as any, sqlPlan.chartTitle || question, schemas, sqlPlan.chartConfig);
      }

      // 步骤4: AI 生成回答
      if (stage) stage.name = '步骤4:生成回答';
      const answerStart = Date.now();
      console.log('=== 步骤4: AI 生成回答');
      const safeFallbackAnswer = () => {
        try {
          const dataArr = Array.isArray(result) ? result : (result ? [result] : []);
          // 优先确定性总结（避免再次触发 AI）
          return this.buildDeterministicSummary(question, dataArr);
        } catch {
          return Array.isArray(result) ? this.generateQuickAnswer(question, result, schemas) : '查询已完成，但生成回答超时。';
        }
      };

      let explanation: string;
      try {
        explanation = await this.generateChineseAnswer(question, result, history, context?.ragContext, context?.noChart, sql, schemaForAI);
      } catch (e: any) {
        console.error('generateChineseAnswer unexpected error, fallback:', e?.message);
        explanation = safeFallbackAnswer();
      }
      timings['生成回答'] = Date.now() - answerStart;

      const totalTime = Date.now() - startTime;
      const timeStr = `\n\n> ⏱️ 响应耗时: ${totalTime}ms (理解:${timings['理解']}ms, 生成SQL:${timings['生成SQL']}ms, 执行:${timings['执行']}ms, 生成回答:${timings['生成回答']}ms)`;

      return {
        answer: explanation + timeStr,
        sql,
        data: Array.isArray(result) ? result : undefined,
        skillUsed,
        chart,
        tokensUsed: this.lastRequestTokens,
        modelName: this.model
      };
    } catch (error: any) {
      return { answer: `处理失败: ${error.message}`, tokensUsed: this.lastRequestTokens, modelName: this.model };
    }
  }

  // 模板匹配快速生成 SQL（跳过 LLM，毫秒级响应）
  private tryGenerateSQLFromTemplate(
    question: string,
    schemas: TableSchema[],
    dbType: string,
    history: ChatMessage[],
    noChart?: boolean
  ): { sql: string; chartTitle?: string; chartType?: string; chartConfig?: { xField?: string; yField?: string } } | null {
    const q = question.trim();

    // 检查上一个问题是否和当前完全相同（重复提问）
    const lastUserMessage = history.length > 0
      ? history.slice().reverse().find(m => m.role === 'user')
      : null;
    const isRepeatQuestion = lastUserMessage && lastUserMessage.content.trim() === q;

    // 有上下文对话时，如果不是完全重复的问题，不走模板
    // 例外：如果当前问题本身是完整的查询模式（不含指代词），仍然走模板
    const hasPronoun = /(?:那|它|这个|那个|这些|那些|他们?|她们?|它们?)/.test(q);
    if (history.length > 0 && !isRepeatQuestion && hasPronoun) return null;

    const table = schemas[0]?.tableName;
    if (!table || schemas.length > 3) return null; // 多表场景不走模板

    const allColumns = schemas.flatMap(s => s.columns);

    // 辅助：在问题中查找匹配的字段名（支持字段名和 comment）
    // 优先返回非时间维度字段（避免时间字段干扰分组统计）
    const findFieldInQuestion = (q: string): { col: string; table: string } | null => {
      // 第一轮：优先匹配非时间维度字段
      for (const schema of schemas) {
        for (const c of schema.columns) {
          // 跳过时间维度字段
          if (/年|year|date|时间|time/i.test(c.name)) continue;
          if (q.includes(c.name)) return { col: c.name, table: schema.tableName };
          if (c.comment && c.comment.length >= 2 && q.includes(c.comment)) return { col: c.name, table: schema.tableName };
        }
      }
      // 第二轮：匹配所有字段
      for (const schema of schemas) {
        for (const c of schema.columns) {
          if (q.includes(c.name)) return { col: c.name, table: schema.tableName };
          if (c.comment && c.comment.length >= 2 && q.includes(c.comment)) return { col: c.name, table: schema.tableName };
        }
      }
      return null;
    };

    // 辅助：查找数值字段（用于 SUM/AVG）
    const findNumericField = (q: string): { col: string; table: string } | null => {
      for (const schema of schemas) {
        for (const c of schema.columns) {
          const t = c.type.toLowerCase();
          const isNumeric = t.includes('int') || t.includes('decimal') || t.includes('float') || t.includes('double') || t.includes('number') || t.includes('real');
          if (!isNumeric) continue;
          if (q.includes(c.name) || (c.comment && c.comment.length >= 2 && q.includes(c.comment))) {
            return { col: c.name, table: schema.tableName };
          }
        }
      }
      return null;
    };

    // 辅助：查找年份字段（用于时间窗口过滤）
    const findYearField = (): string | null => {
      for (const c of allColumns) {
        if (/年|year/i.test(c.name)) return c.name;
      }
      for (const c of allColumns) {
        if (/日|date/i.test(c.name)) return c.name;
      }
      return null;
    };

    // 辅助：检测时间窗口（追问或默认近5年）
    const detectTimeWindow = (): { field: string; condition: string; label: string } | null => {
      const yearField = findYearField();
      if (!yearField) return null;

      // 检测追问中的时间关键词
      const fullContext = history.map(h => h.content).join(' ') + ' ' + q;

      // 明确年份范围：2020年以来、2020-2023年
      const yearRangeMatch = fullContext.match(/(\d{4})\s*[\-~到至]\s*(\d{4})/);
      if (yearRangeMatch) {
        return {
          field: yearField,
          condition: `${yearField} >= ${yearRangeMatch[1]} AND ${yearField} <= ${yearRangeMatch[2]}`,
          label: `${yearRangeMatch[1]}-${yearRangeMatch[2]}年`
        };
      }

      // 近N年/最近N年
      const recentYearMatch = fullContext.match(/(?:近|最近)\s*(\d+)\s*年/);
      if (recentYearMatch && recentYearMatch.length > 1) {
        const n = parseInt(recentYearMatch[1]);
        return {
          field: yearField,
          condition: `${yearField} >= YEAR(CURDATE()) - ${n}`,
          label: `近${n}年`
        };
      }

      // 默认近N年（避免全表扫描）
      const defaultN = (() => {
        const n = Number(process.env.DATAMIND_TEMPLATE_DEFAULT_YEAR_RANGE ?? '10');
        return Number.isFinite(n) && n > 0 ? Math.min(Math.max(Math.floor(n), 1), 30) : 10;
      })();
      return {
        field: yearField,
        condition: `${yearField} >= YEAR(CURDATE()) - ${defaultN}`,
        label: `近${defaultN}年`
      };
    };

    const chartType = noChart ? 'none' : undefined;

    // 模式1: "各XX的数量" / "XX分布" / "按XX统计" / "XX有哪些类型" → GROUP BY
    const groupByPatterns = [
      /(?:各|每个|不同|按)(.+?)(?:的|的数量|数量|统计|分布|占比|有多少)/,
      /(.+?)(?:分布|的分布|的数量分布|的占比)/,
      /(?:统计|查询|查看|列出)(?:各|每个|不同|按)?(.+?)(?:的数量|数量|的统计|分布)/,
      /(.+?)(?:有哪些|有几种|有多少种|有多少类)/,
    ];

    for (const pattern of groupByPatterns) {
      const match = q.match(pattern);
      if (match) {
        const keyword = match[1].trim();
        const field = findFieldInQuestion(keyword);
        if (field) {
          const sql = `SELECT ${field.col}, COUNT(1) as cnt FROM ${field.table} GROUP BY ${field.col} ORDER BY cnt DESC LIMIT 20`;
          console.log(`=== 模板匹配成功 [GROUP BY]: "${q}" → ${sql}`);
          return {
            sql,
            chartTitle: `${keyword}分布`,
            chartType: chartType || 'bar',
            chartConfig: { xField: field.col, yField: 'cnt' }
          };
        }
      }
    }

    // 模式2: "XX最多/最高/最大的前N个" → TOP-N
    // 1) 若是"某实体(发明人/申请人/公司...)产出最高"，本质是按实体 GROUP BY COUNT
    // 2) 否则需要找到明确的数值字段，才能做 ORDER BY 数值字段
    // 扩展：支持"近N年...产出"等带时间窗口的问法
    const topNMatch = q.match(/(?:哪些|哪个)?(.+?)(?:的)?(?:最多|最高|最大|最好|最少|最小|最低)的?(?:前)?(\d+)?(?:个|条|名|者|是|专利)?/);
    if (topNMatch || /(?:哪些|哪个).+(?:最高|最大|最多|最好)/.test(q) || /(?:近|最近)\d+年.+产出/.test(q)) {
      const keyword = topNMatch ? topNMatch[1].trim() : '';
      const n = topNMatch && topNMatch[2] ? parseInt(topNMatch[2]) : 10;

      // 产出/发文/数量等：按“某个维度”统计数量并取 TopN
      // 例：哪些发明人的专利产出最高？ => 按发明人 group by count
      const isOutputQuery = /(?:产出|产量|发文|发表|数量|件数|篇数|专利数|申请量|授权量)/.test(q);
      if (isOutputQuery) {
        const dim = findFieldInQuestion(q) || (keyword ? findFieldInQuestion(keyword) : null);
        if (dim) {
          // 添加时间窗口过滤（默认近5年，支持追问指定范围）
          const timeWindow = detectTimeWindow();
          const whereClause = timeWindow ? ` WHERE ${timeWindow.condition}` : '';
          const sql = `SELECT ${dim.col}, COUNT(1) as cnt FROM ${dim.table}${whereClause} GROUP BY ${dim.col} ORDER BY cnt DESC LIMIT ${n}`;
          console.log(`=== 模板匹配成功 [TOP-N-GROUP${timeWindow ? '-' + timeWindow.label : ''}]: "${q}" → ${sql}`);
          return {
            sql,
            chartTitle: `${dim.col}${timeWindow ? timeWindow.label : ''}Top${n}`,
            chartType: chartType || 'bar',
            chartConfig: { xField: dim.col, yField: 'cnt' }
          };
        }
      }

      // 非产出类：必须找到明确数值字段
      let numField = (keyword ? (findNumericField(keyword) || findFieldInQuestion(keyword)) : null);
      if (!numField && keyword) {
        const cleanedKeyword = keyword.replace(/的|数量|次数|值|数量/g, '').trim();
        if (cleanedKeyword) {
          numField = findNumericField(cleanedKeyword) || findFieldInQuestion(cleanedKeyword);
        }
      }

      // 若问题明显是“实体TopN”（哪些/哪个...最高），但又找不到数值字段，则不要瞎选第一个数值字段
      // 直接放弃模板，让 LLM 处理（避免语义漂移）
      if (!numField) {
        return null;
      }

      // 找一个标签字段（名称或标题类字段，或除数值字段外的第一个字段）
      const labelCol = allColumns.find(c =>
        c.name !== numField!.col &&
        (/名|称|标题|title|name|专利|申请号/i.test(c.name) || !c.isPrimaryKey)
      ) || allColumns.find(c => c.name !== numField!.col);

      const labelField = labelCol ? labelCol.name : numField.col;
      const sql = `SELECT ${labelField}, ${numField.col} FROM ${numField.table} ORDER BY ${numField.col} DESC LIMIT ${n}`;
      console.log(`=== 模板匹配成功 [TOP-N]: "${q}" → ${sql}`);
      return {
        sql,
        chartTitle: `${keyword || '数据'}Top${n}`,
        chartType: chartType || 'bar',
        chartConfig: { xField: labelField, yField: numField.col }
      };
    }

    // 模式3: "最长/最大/最高/最短/最小/最低" → MAX/MIN (仅单值聚合，不含排名/前N语义)
    // 严格排除含有"哪些/前/排名/第几/列表"等排名语义的查询
    // 扩展：支持"XX最高/最大/最小值是多少"明确极值问法
    const isRankingQuery = /(?:哪些|前\d*|排名|第几|列表|明细|详情)/.test(q);
    // 匹配：1) 以疑问词结尾的极值问法 2) "XX最高/最大/最小值是多少"格式
    const extremeMatch1 = !isRankingQuery ? q.match(/(?:最)?(长|大|高|短|小|低|多|少)(?:的?是|多少|多|少|值|时间)?\s*$/) : null;
    const extremeMatch2 = !isRankingQuery ? q.match(/(.+?)(?:最高|最大|最低|最小|最多|最少)值?(?:是|为)?多少/) : null;
    const extremeMatch = extremeMatch1 || extremeMatch2;
    // 特别处理：如果问题包含"最高/最大/最小"+"是多少"格式，优先匹配 EXTREME
    const isExtremeValueQuery = q.match(/(?:最高|最大|最小|最多|最少).*(?:是多少|多少|是什么)/);
    if ((extremeMatch || isExtremeValueQuery) && /(?:最短|最长|最大|最小|最高|最低|最多|最少)/.test(q)) {
      // 先尝试从问题中提取具体的数值字段关键词（去掉"最X"前缀）
      const keywordPart = q.replace(/最(?:长|大|高|短|小|低|多|少)/g, '').replace(/的?是|多少|多|少|值|时间/g, '').trim();
      const targetField = keywordPart ? (findNumericField(keywordPart) || findFieldInQuestion(keywordPart)) : null;

      // 如果找到了具体字段，生成针对该字段的MAX/MIN
      if (targetField) {
        const extremeKey = extremeMatch && extremeMatch.length > 1 ? String(extremeMatch[1] || '') : '';
        const isMax = /长|大|高|多/.test(extremeKey);
        const func = isMax ? 'MAX' : 'MIN';
        const sql = `SELECT ${func}(${targetField.col}) AS ${isMax ? '最大' : '最小'}值 FROM ${targetField.table}`;
        console.log(`=== 模板匹配成功 [EXTREME]: "${q}" → ${sql}`);
        return { sql, chartType: 'none' };
      }

      // 只有找不到具体字段时，才尝试日期字段（日期差场景）
      const extremeKey2 = extremeMatch && extremeMatch.length > 1 ? String(extremeMatch[1] || '') : '';
      const isMax = /长|大|高|多/.test(extremeKey2);
      const func = isMax ? 'MAX' : 'MIN';
      const dateFields = allColumns.filter(c => {
        const t = c.type.toLowerCase();
        return t.includes('date') || t.includes('time') || c.name.includes('日') || c.name.includes('时间');
      });

      if (dateFields.length >= 2) {
        const startDate = dateFields[0];
        const endDate = dateFields[1];
        const sql = `SELECT ${func}(DATEDIFF(${endDate.name}, ${startDate.name})) AS ${isMax ? '最大' : '最小'}天数 FROM ${table} WHERE ${endDate.name} IS NOT NULL AND ${startDate.name} IS NOT NULL`;
        console.log(`=== 模板匹配成功 [EXTREME_DURATION]: "${q}" → ${sql}`);
        return { sql, chartType: 'none' };
      }
    }

    // 模式3: "总共多少条" / "一共有多少" / "XX表有多少数据" → COUNT
    // 排除包含极端值关键词的查询，也排除包含"平均"的查询（避免和 AVG 冲突）
    if (!/(?:最短|最长|最大|最小|最高|最低|最多|最少|平均)/.test(q) &&
      /(?:总共|一共|共有|共计|总计)?(?:多少|几)(?:条|个|项|行|笔|条数据|数据)?/.test(q) &&
      !/(?:各|每个|不同|按|分布|类型|类别)/.test(q)) {
      const sql = `SELECT COUNT(1) as 总数 FROM ${table}`;
      console.log(`=== 模板匹配成功 [COUNT]: "${q}" → ${sql}`);
      return { sql, chartType: 'none' };
    }

    // 模式4: "平均耗时/平均时长/平均时间/平均XX" → AVG + DATEDIFF
    // 严格匹配"耗时/时长/周期"等时间差关键词
    const avgDurationMatch = !/(?:最短|最长|最大|最小|最多|最少)/.test(q) && q.match(/(?:平均)(.+?)(?:耗时|时长|周期|审查周期|授权周期)/);
    if (avgDurationMatch) {
      // 查找两个日期字段用于计算差值
      const dateFields = allColumns.filter(c => {
        const t = c.type.toLowerCase();
        return t.includes('date') || t.includes('time') || c.name.includes('日') || c.name.includes('时间');
      });

      if (dateFields.length >= 2) {
        // 通常第一个日期是开始，第二个是结束
        const startDate = dateFields[0];
        const endDate = dateFields[1];
        const sql = `SELECT AVG(DATEDIFF(${endDate.name}, ${startDate.name})) AS 平均${avgDurationMatch[1]}天数 FROM ${table} WHERE ${endDate.name} IS NOT NULL AND ${startDate.name} IS NOT NULL`;
        console.log(`=== 模板匹配成功 [AVG_DURATION]: "${q}" → ${sql}`);
        return { sql, chartType: 'none' };
      }
    }

    // 模式5: "总计/合计/总和/一共多少" + 数值字段 → SUM
    const sumMatch = q.match(/(?:总计|合计|总和|一共|总共)(.+?)(?:是|为|多少|多|钱|元)?/);
    if (sumMatch && !/(?:条|个|项|行)/.test(q)) {
      const keyword = sumMatch[1].trim();
      const numField = findNumericField(keyword);
      if (numField) {
        const sql = `SELECT SUM(${numField.col}) AS ${keyword}总和 FROM ${numField.table}`;
        console.log(`=== 模板匹配成功 [SUM]: "${q}" → ${sql}`);
        return { sql, chartType: 'none' };
      }
    }

    // 模式7: "平均/均值/平均值"（不含日期差）→ AVG
    const avgMatch = q.match(/(?:平均|均值|平均值)(.+?)(?:是|为|多少)?/);
    if (avgMatch && !/(?:耗时|时长|时间|周期)/.test(q)) {
      const keyword = avgMatch[1].trim();
      const numField = findNumericField(keyword);
      if (numField) {
        const sql = `SELECT AVG(${numField.col}) AS ${keyword}平均值 FROM ${numField.table}`;
        console.log(`=== 模板匹配成功 [AVG]: "${q}" → ${sql}`);
        return { sql, chartType: 'none' };
      }
    }

    // 模式8: "展示/显示/列出/查看 几条/前几条" → LIMIT
    const limitMatch = q.match(/(?:展示|显示|列出|查看|查询)(?:前)?(\d+)?(?:条|行|个|笔)?/);
    if (limitMatch && !/(?:按|各|每个|不同)/.test(q)) {
      const n = limitMatch[1] ? parseInt(limitMatch[1]) : 10;
      const sql = `SELECT * FROM ${table} LIMIT ${n}`;
      console.log(`=== 模板匹配成功 [LIMIT]: "${q}" → ${sql}`);
      return { sql, chartType: 'none' };
    }

    // 模式9: "近N年/最近N年/近N个月的趋势/走势" → 时间序列
    // 严格排除：1) 纯追问片段 2) 分析类问题（含"分析/发展/情况"等）
    const trendMatch = q.match(/(?:近|最近)?(\d+)?(?:年|个月|月|日|天)?的?(?:趋势|走势|变化)/);
    // 确保不是追问格式（追问通常是"近3年的""2020年以来的"，缺少主语）
    const isFollowUpOnly = /^(?:近|最近)\d+(?:年|个月|月)/.test(q) && q.length < 10;
    // 排除分析类问题
    const isAnalysisQuery = /(?:分析|发展|情况|领域|技术)/.test(q);
    if (trendMatch && !isFollowUpOnly && !isAnalysisQuery) {
      const timeField = allColumns.find(c => {
        const n = c.name.toLowerCase();
        return n.includes('时间') || n.includes('日期') || n.includes('年份') || n.includes('月份') ||
          n.includes('date') || n.includes('time') || n.includes('year') || n.includes('month');
      });
      if (timeField) {
        const sql = `SELECT ${timeField.name}, COUNT(1) as cnt FROM ${table} GROUP BY ${timeField.name} ORDER BY ${timeField.name} DESC LIMIT 20`;
        console.log(`=== 模板匹配成功 [TREND]: "${q}" → ${sql}`);
        return {
          sql,
          chartTitle: '时间趋势',
          chartType: chartType || 'line',
          chartConfig: { xField: timeField.name, yField: 'cnt' }
        };
      }
    }

    // 模式10: "最近一条/最新一条/最后一条" → ORDER BY ID/时间 DESC LIMIT 1
    if (/(?:最近|最新|最后)(?:的|一条|一条数据|数据|记录)?/.test(q)) {
      const timeOrIdField = allColumns.find(c => {
        const n = c.name.toLowerCase();
        return n.includes('时间') || n.includes('日期') || n.includes('创建') ||
          n.includes('id') || n.includes('序号') || n.includes('no') ||
          n.includes('date') || n.includes('time') || c.isPrimaryKey;
      });
      const orderField = timeOrIdField ? timeOrIdField.name : allColumns[0]?.name;
      const sql = `SELECT * FROM ${table} ORDER BY ${orderField} DESC LIMIT 1`;
      console.log(`=== 模板匹配成功 [LATEST]: "${q}" → ${sql}`);
      return { sql, chartType: 'none' };
    }

    // 模式11: "唯一/不重复/不同的值" → DISTINCT
    const distinctMatch = q.match(/(?:唯一|不重复|不同| distinct )(.+?)(?:有|是|多少|的值|的值有)?/);
    if (distinctMatch) {
      const keyword = distinctMatch[1].trim();
      const field = findFieldInQuestion(keyword);
      if (field) {
        const sql = `SELECT DISTINCT ${field.col} FROM ${field.table} LIMIT 100`;
        console.log(`=== 模板匹配成功 [DISTINCT]: "${q}" → ${sql}`);
        return { sql, chartType: 'none' };
      }
    }

    // 模式12: "是否存在/有没有/是否有" → EXISTS / COUNT with WHERE
    const existMatch = q.match(/(?:是否|有没有|是否有|存在)(.+)/);
    if (existMatch) {
      const sql = `SELECT COUNT(1) as 存在数量 FROM ${table} WHERE ${allColumns[0]?.name || '1'} IS NOT NULL LIMIT 1`;
      console.log(`=== 模板匹配成功 [EXISTS]: "${q}" → ${sql}`);
      return { sql, chartType: 'none' };
    }

    return null;
  }

  // 带上下文的 SQL 生成
  private async generateSQLWithContext(
    question: string,
    schemas: TableSchema[],
    dbType: string,
    history: ChatMessage[],
    schemaContext: string,
    additionalContext: string,
    noChart?: boolean,
    preChartInfo?: { chartType?: string; chartTitle?: string; chartConfig?: any }
  ): Promise<{ sql: string, chartTitle?: string, chartType?: string, chartConfig?: { xField?: string, yField?: string } }> {
    await this.ensureInitialized();

    // 快速路径1: 模板匹配（0ms，完全跳过LLM）
    const templateResult = this.tryGenerateSQLFromTemplate(question, schemas, dbType, history, noChart);
    if (templateResult) {
      console.log('=== 模板生成SQL，跳过LLM调用');
      // 模板生成的SQL也需要经过中文标识符校验（虽然模板本身用真实字段名，但为了安全）
      if (this.shouldForbidChineseIdentifiers(schemas) && this.hasNonAsciiIdentifier(templateResult.sql)) {
        console.warn('[AIAgent] 模板SQL检测到非ASCII标识符，触发重写');
        const reason = '模板SQL包含非ASCII标识符，必须使用真实英文表名/字段名重写';
        const corrected = await this.regenerateSQL(question, schemas, dbType, history, templateResult.sql, reason, noChart);
        if (corrected && !this.hasNonAsciiIdentifier(corrected)) {
          return { ...templateResult, sql: corrected };
        }
      }
      return templateResult;
    }
    console.log('=== 模板未匹配，继续使用LLM生成SQL');

    // 快速路径2: SQL缓存（无上下文对话时，相同问题直接返回缓存）
    const hasHistory = history.length > 0;
    if (!hasHistory) {
      const cacheKey = this.getSQLCacheKey(question, dbType, schemaContext);
      const cached = this.getSQLFromCache(cacheKey);
      if (cached) {
        console.log('=== SQL缓存命中，跳过LLM调用');
        return cached;
      }
      console.log(`=== SQL缓存未命中，key=${cacheKey.slice(0, 50)}...`);
    } else {
      console.log('=== 有对话历史，跳过SQL缓存');
    }

    const recentContext = history.slice(-2).map(m => m.content.slice(0, 100)).join(';');

    // 识别维度字段（用于GROUP BY）
    const dimensionFields: string[] = [];
    const geo = this.pickBestGeoGroupByColumns(schemas);
    for (const schema of schemas) {
      for (const col of schema.columns) {
        const name = col.name.toLowerCase();
        // 地域维度
        if (name.includes('地区') || name.includes('区域') || name.includes('省份') ||
          name.includes('城市') || name.includes('国家') || name.includes('地址') ||
          name.includes('region') || name.includes('area') || name.includes('province')) {
          dimensionFields.push(`- ${col.name}: 地域维度`);
        }
        // 时间维度
        else if (name.includes('时间') || name.includes('日期') || name.includes('年份') ||
          name.includes('月份') || name.includes('date') || name.includes('time')) {
          dimensionFields.push(`- ${col.name}: 时间维度`);
        }
        // 分类维度
        else if (name.includes('类型') || name.includes('类别') || name.includes('分类') ||
          name.includes('组别') || name.includes('级别') || name.includes('status')) {
          dimensionFields.push(`- ${col.name}: 分类维度`);
        }
      }
    }

    const dimensionHint = dimensionFields.length > 0
      ? `\n维度字段:${dimensionFields.map(d => d.replace('- ', '')).join('; ')}`
      : '';

    const geoHint = (() => {
      if (!this.shouldPreferProvinceCity(question)) return '';
      if (!(geo.province || geo.city)) return '';

      const level = this.getGeoPreferredLevel(question);
      const available = [
        geo.province ? `省=${geo.province}` : null,
        geo.city ? `市=${geo.city}` : null,
        geo.country ? `国家=${geo.country}` : null,
      ].filter(Boolean).join(', ');

      const preferred = level === 'province_city'
        ? '优先按“省+市”组合分组统计（避免同名城市混淆）'
        : level === 'city'
          ? '优先按“市”分组统计（必要时可加省作为辅助维度）'
          : '默认按“省”分组统计（数据量大时更稳更快）';

      return `\n地域统计自适应：${preferred}。如果出现“国家”维度值几乎都相同（例如都为中国），请改为省/市/省市统计。可用字段: ${available}`;
    })();

    const timeHint = (() => {
      const windowN = this.getRecentYearsWindow(question);
      if (!windowN) return '';
      return `\n时间语义规则：用户提到“近年来/近几年/最近/近${windowN}年”时，必须聚焦最近${windowN}年数据。优先按年份降序取最近${windowN}年（ORDER BY 年份 DESC LIMIT ${windowN}），如需展示趋势再在外层按年份升序输出。不要用年份升序后 LIMIT 导致只取到最早年份。`;
    })();

    // 精简 schema 上下文：对于超长 schema，只保留与问题相关的字段
    let effectiveSchema = schemaContext;
    if (schemaContext.length > 2000) {
      const qLower = question.toLowerCase();
      const relevantLines = schemaContext.split('\n').filter(line => {
        if (line.includes(':') && !line.includes(',')) return true; // 表名行
        // 保留问题中提到的字段
        const lineLower = line.toLowerCase();
        return qLower.split('').some(ch => /[\u4e00-\u9fa5a-z]/.test(ch)) &&
          lineLower.split(',').some(part => {
            const fieldName = part.replace(/\(.*?\)/g, '').trim().toLowerCase();
            return fieldName && (qLower.includes(fieldName) || fieldName.length <= 3);
          });
      });
      if (relevantLines.length > 0) {
        // 兜底：至少保留表名行 + 匹配字段，不足时回退原 schema
        effectiveSchema = relevantLines.length >= 2 ? relevantLines.join('\n') : schemaContext.slice(0, 2000);
        console.log(`=== Schema裁剪(SQL生成): ${schemaContext.length}字 -> ${effectiveSchema.length}字`);
      }
    }

    // 如果图表配置已由意图识别确定，使用更简洁的 SQL-only prompt（减少思考 token）
    const hasPreChart = preChartInfo && preChartInfo.chartType;
    const identifierRules = this.buildSqlIdentifierRules(schemas, dbType);

    const systemPrompt = hasPreChart
      ? `SQL生成器(${dbType})。只返回一条SQL语句，不要解释。不要输出思考过程，直接输出结果。
规则:SELECT only;统计条数用COUNT(1)不用COUNT(*);分布/趋势/对比用GROUP BY;默认LIMIT 20;聚合按值DESC${dimensionHint}${geoHint}${timeHint}
${identifierRules}
表结构:
${effectiveSchema}${additionalContext}`
      : `SQL生成器(${dbType})。返回JSON:{"sql":"SELECT...","chartType":"bar|line|pie|none","chartTitle":"标题","chartConfig":{"xField":"维度字段","yField":"数值字段"}}
不要输出思考过程，直接输出JSON。
规则:SELECT only;统计条数用COUNT(1)不用COUNT(*);分布/趋势/对比用GROUP BY;默认LIMIT 20;聚合按值DESC;观察样例数据确定字段值格式${dimensionHint}${geoHint}${timeHint}${noChart ? ';图表类型chartType设为none' : ''}
${identifierRules}
表结构:
${effectiveSchema}${additionalContext}`;

    console.log(`=== LLM调用开始，schema长度=${effectiveSchema.length}，hasPreChart=${hasPreChart}`);
    const llmStartTime = Date.now();

    const response = await this.callWithRetry(() => this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: recentContext ? `上文:${recentContext}\n问:${question}` : question }
      ],
      temperature: 0,
      max_tokens: 1024,
    })) as any;

    const llmDuration = Date.now() - llmStartTime;
    console.log(`=== LLM调用完成，耗时=${llmDuration}ms`);

    const content = response.choices[0].message.content?.trim() || '{}';
    let result: { sql: string; chartTitle?: string; chartType?: string; chartConfig?: { xField?: string; yField?: string } };

    if (hasPreChart) {
      // 图表配置已由 planAction 确定，只解析 SQL
      result = {
        sql: cleanSQL(content),
        chartTitle: preChartInfo!.chartTitle,
        chartType: preChartInfo!.chartType,
        chartConfig: preChartInfo!.chartConfig
      };
    } else {
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const json = JSON.parse(jsonMatch[0]);
          result = {
            sql: cleanSQL(json.sql),
            chartTitle: json.chartTitle,
            chartType: json.chartType,
            chartConfig: json.chartConfig
          };
        } else {
          result = { sql: cleanSQL(content) };
        }
      } catch (e) {
        console.error('Failed to parse AI SQL plan:', e);
        result = { sql: cleanSQL(content) };
      }
    }

    // 写入缓存（仅无上下文对话时）
    if (!hasHistory && result.sql) {
      const cacheKey = this.getSQLCacheKey(question, dbType, schemaContext);
      this.setSQLCache(cacheKey, result);
    }

    return result;
  }

  // 检测是否需要生成报告（返回报告类型或 null）
  private detectReportIntent(question: string): 'summary' | 'ppt' | 'dashboard' | 'excel' | 'insight' | 'compare' | 'analysis' | null {
    const q = question.toLowerCase();

    // PPT/演示文稿
    if (/(生成|(制|)|(导出|))(ppt|演示|幻灯片|报告文档)/i.test(q)) {
      return 'ppt';
    }

    // 数据大屏
    if (/(生成|(制|)|(展示|))(大屏|(可视化|)看板|dashboard)/i.test(q)) {
      return 'dashboard';
    }

    // Excel 报表
    if (/(生成|导出|制作).*(excel|报表|工作簿)/i.test(q) || /(excel|报表).*(导出|下载|生成)/i.test(q)) {
      return 'excel';
    }

    // 智能洞察
    if (/(洞察|insight|关键发现|核心发现|自动发现)/i.test(q)) {
      return 'insight';
    }

    // 对比分析
    if (/(对比|比较|compare).*(报告|分析)/i.test(q) || /(报告|分析).*(对比|比较|compare)/i.test(q)) {
      return 'compare';
    }

    // 深度分析报告
    if (/(生成|(写|)).*(报告|分析报告|总结报告)/i.test(q)) {
      return 'summary';
    }

    // 详细分析/深度分析
    if (/(详细|深度|全面|综合).*分析/i.test(q) || /分析.*(报告|结果)/i.test(q)) {
      return 'analysis';
    }

    return null;
  }

  // 处理报告生成请求（调用 Skill，支持 AI）
  private async handleReportRequest(
    question: string,
    dataSource: BaseDataSource,
    dbType: string,
    reportType: 'summary' | 'ppt' | 'dashboard' | 'excel' | 'insight' | 'compare' | 'analysis',
    context?: any
  ): Promise<AgentResponse> {
    await this.ensureInitialized();
    const startTime = Date.now();
    const schemas = await dataSource.getSchema();

    try {
      if (reportType === 'analysis') {
        // 深度分析：调用 AI 生成分析报告
        return await this.generateAnalysisReport(question, dataSource, dbType, schemas, context);
      }

      // 其他报告类型：调用对应的 Skill
      const skillName = `report.${reportType}`;
      const skill = skillsRegistry.get(skillName);

      if (!skill) {
        return {
          answer: `抱歉，${reportType} 报告生成功能暂未启用。`,
          tokensUsed: 0,
          modelName: 'none'
        };
      }

      const skillContext = this.buildSkillContext(dataSource, schemas, dbType, 'public/downloads');
      const result = await skill.execute(
        this.buildDefaultSkillParams(skillName, question, schemas),
        skillContext
      );

      const totalTime = Date.now() - startTime;

      if (result.success) {
        const answer = this.buildSkillAnswer(skillName, result) || result.message || '报告生成成功';
        return {
          answer: `${answer}\n\n> ⏱️ 生成耗时: ${totalTime}ms`,
          data: typeof result.data === 'string' ? undefined : result.data,
          skillUsed: skillName,
          visualization: result.visualization,
          tokensUsed: this.lastRequestTokens,
          modelName: this.model
        };
      } else {
        return {
          answer: `报告生成失败: ${result.message}`,
          tokensUsed: 0,
          modelName: 'none'
        };
      }
    } catch (error: any) {
      return {
        answer: `报告生成失败: ${error.message}`,
        tokensUsed: 0,
        modelName: 'none'
      };
    }
  }

  // 生成深度分析报告（调用 AI）
  private async generateAnalysisReport(
    question: string,
    dataSource: BaseDataSource,
    dbType: string,
    schemas: TableSchema[],
    context?: any
  ): Promise<AgentResponse> {
    const startTime = Date.now();

    // 收集基础数据
    const dataOverview: any[] = [];
    for (const schema of schemas.slice(0, 5)) {
      try {
        const countResult = await dataSource.executeQuery(
          `SELECT COUNT(1) as total FROM ${schema.tableName} LIMIT 1`
        );
        dataOverview.push({
          table: schema.tableName,
          count: countResult.data?.[0]?.total || 0,
          columns: schema.columns.length
        });
      } catch (e) {
        // 忽略失败的表
      }
    }

    // 调用 AI 生成分析报告
    const schemaStr = schemas.slice(0, 5).map(s =>
      `${s.tableName}: ${s.columns.slice(0, 10).map(c => c.name).join(', ')}`
    ).join('\n');

    const response = await this.callWithRetry(() => this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `你是数据分析专家。根据数据概览生成简洁的分析报告。

**输出格式**：
# 数据分析报告

## 1. 数据概览
(列出各表的记录数和字段数)

## 2. 数据特征
(分析字段类型和可能的业务含义)

## 3. 建议分析方向
(提出3-5个可以深入分析的问题)

保持简洁，每个部分不超过5行。`
        },
        {
          role: 'user',
          content: `用户问题: ${question}\n\n数据概览:\n${JSON.stringify(dataOverview, null, 2)}\n\n表结构:\n${schemaStr}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    })) as any;

    const answer = response.choices[0].message.content || '无法生成分析报告';
    const totalTime = Date.now() - startTime;

    return {
      answer: answer + `\n\n> ⏱️ 报告生成耗时: ${totalTime}ms`,
      data: dataOverview,
      skillUsed: 'report.analysis',
      tokensUsed: this.lastRequestTokens,
      modelName: this.model
    };
  }

  // 快速生成答案（不调用AI，毫秒级返回）
  private generateQuickAnswer(question: string, result: any[], schemas?: TableSchema[]): string {
    if (!result || (Array.isArray(result) && result.length === 0)) {
      return '查询结果为空，没有找到相关数据。';
    }

    const data = Array.isArray(result) ? result : [result];
    const count = data.length;
    const keys = Object.keys(data[0]);

    // 检测字段类型，用于智能单位
    const detectFieldType = (key: string): 'area' | 'population' | 'gdp' | 'count' | 'generic' => {
      const k = key.toLowerCase();
      if (k.includes('area') || k.includes('surface') || k.includes('面积')) return 'area';
      if (k.includes('population') || k.includes('人口')) return 'population';
      if (k.includes('gnp') || k.includes('gdp') || k.includes('生产总值')) return 'gdp';
      if (k.includes('count') || k.includes('total') || k.includes('数量')) return 'count';
      return 'generic';
    };

    // 单值查询（如 COUNT(1), SUM() 等）
    if (count === 1 && keys.length === 1) {
      const value = data[0][keys[0]];
      const fieldType = detectFieldType(keys[0]);
      return `查询结果：**${this.formatValueWithUnit(value, fieldType)}**`;
    }

    // 单行多列查询
    if (count === 1) {
      const row = data[0];
      const details = keys.map(k => {
        const fieldType = detectFieldType(k);
        return `- **${this.translateFieldName(k)}**: ${this.formatValueWithUnit(row[k], fieldType)}`;
      }).join('\n');
      return `查询结果：\n\n${details}`;
    }

    // 多行查询（排名/统计类）
    // 智能识别字段角色
    const numericKeys = keys.filter(k => {
      const sample = data[0][k];
      return typeof sample === 'number';
    });
    const textKeys = keys.filter(k => {
      const sample = data[0][k];
      return typeof sample === 'string';
    });

    // 数值字段（用于显示数据）
    const valueKey = numericKeys[numericKeys.length - 1] || keys[keys.length - 1];
    const valueFieldType = detectFieldType(valueKey);
    console.log('[generateQuickAnswer] keys:', keys, 'valueKey:', valueKey, 'fieldType:', valueFieldType);

    // 生成排名列表（显示所有文本字段）
    const items = data.slice(0, 15).map((row, i) => {
      const value = row[valueKey];

      // 收集所有文本字段的值
      const textParts = textKeys.map(k => this.translateName(row[k])).filter(v => v);
      const displayName = textParts.join(' - ') || this.translateName(row[keys[0]]);

      if (numericKeys.length === 0) {
        return `${i + 1}. ${displayName}`;
      }
      return `${i + 1}. **${displayName}**: ${this.formatValueWithUnit(value, valueFieldType)}`;
    });

    let answer = `查询到 **${count}** 条结果：\n\n${items.join('\n')}`;
    if (count > 15) {
      answer += `\n\n...及其他 ${count - 15} 条数据`;
    }

    return answer;
  }

  // 翻译常见名称（国家、大洲等）
  private translateName(name: any): string {
    if (typeof name !== 'string') return String(name);
    const translations: Record<string, string> = {
      // 国家
      'Russian Federation': '俄罗斯', 'China': '中国', 'United States': '美国',
      'Canada': '加拿大', 'Brazil': '巴西', 'Australia': '澳大利亚',
      'India': '印度', 'Argentina': '阿根廷', 'Kazakhstan': '哈萨克斯坦',
      'Algeria': '阿尔及利亚', 'Antarctica': '南极洲', 'Japan': '日本',
      'Germany': '德国', 'France': '法国', 'United Kingdom': '英国',
      'Italy': '意大利', 'South Korea': '韩国', 'Spain': '西班牙',
      'Mexico': '墨西哥', 'Indonesia': '印度尼西亚', 'Turkey': '土耳其',
      'Saudi Arabia': '沙特阿拉伯', 'Iran': '伊朗', 'Egypt': '埃及',
      'Nigeria': '尼日利亚', 'Pakistan': '巴基斯坦', 'Bangladesh': '孟加拉国',
      'Vietnam': '越南', 'Philippines': '菲律宾', 'Thailand': '泰国',
      'Poland': '波兰', 'Ukraine': '乌克兰', 'Netherlands': '荷兰',
      'Belgium': '比利时', 'Sweden': '瑞典', 'Switzerland': '瑞士',
      'Austria': '奥地利', 'Norway': '挪威', 'Denmark': '丹麦',
      'Finland': '芬兰', 'Portugal': '葡萄牙', 'Greece': '希腊',
      'Czech Republic': '捷克', 'Romania': '罗马尼亚', 'Hungary': '匈牙利',
      'Israel': '以色列', 'Singapore': '新加坡', 'Malaysia': '马来西亚',
      'South Africa': '南非', 'New Zealand': '新西兰', 'Ireland': '爱尔兰',
      'Colombia': '哥伦比亚', 'Chile': '智利', 'Peru': '秘鲁',
      'Venezuela': '委内瑞拉', 'Cuba': '古巴', 'North Korea': '朝鲜',
      'Myanmar': '缅甸', 'Nepal': '尼泊尔', 'Sri Lanka': '斯里兰卡',
      'Cambodia': '柬埔寨', 'Laos': '老挝', 'Mongolia': '蒙古',
      // 大洲
      'Asia': '亚洲', 'Europe': '欧洲', 'Africa': '非洲',
      'North America': '北美洲', 'South America': '南美洲', 'Oceania': '大洋洲',

      // 城市
      'Shanghai': '上海', 'Beijing': '北京', 'Mumbai': '孟买',
      'Delhi': '德里', 'Tokyo': '东京', 'Seoul': '首尔',
      'New York': '纽约', 'Los Angeles': '洛杉矶', 'London': '伦敦',
      'Paris': '巴黎', 'Moscow': '莫斯科', 'São Paulo': '圣保罗',
    };
    return translations[name] || name;
  }

  // 翻译字段名
  private translateFieldName(field: string): string {
    const translations: Record<string, string> = {
      'Name': '名称', 'Population': '人口', 'SurfaceArea': '面积',
      'Continent': '大洲', 'Region': '地区', 'GNP': '国民生产总值',
      'LifeExpectancy': '平均寿命', 'GovernmentForm': '政府形式',
      'HeadOfState': '国家元首', 'Capital': '首都', 'Code': '代码',
      'IndepYear': '独立年份', 'District': '地区', 'CountryCode': '国家代码',
      'Language': '语言', 'IsOfficial': '是否官方', 'Percentage': '使用比例',
    };
    return translations[field] || field;
  }

  // 格式化数值（带单位）
  private formatValueWithUnit(value: any, fieldType: 'area' | 'population' | 'gdp' | 'count' | 'generic'): string {
    if (value === null || value === undefined) return '-';
    if (typeof value !== 'number') return this.translateName(value);

    const num = value;
    let formatted: string;
    let unit = '';

    if (num >= 100000000) {
      formatted = (num / 100000000).toFixed(2);
      unit = '亿';
    } else if (num >= 10000) {
      formatted = (num / 10000).toFixed(2);
      unit = '万';
    } else if (Number.isInteger(num)) {
      formatted = num.toLocaleString();
    } else {
      formatted = num.toFixed(2);
    }

    // 根据字段类型添加单位
    switch (fieldType) {
      case 'area':
        return formatted + unit + '平方公里';
      case 'population':
        return formatted + unit + '人';
      case 'gdp':
        return formatted + unit + '美元';
      case 'count':
        return formatted + unit + '个';
      default:
        return formatted + unit;
    }
  }

  // 格式化数值（通用）
  private formatValue(value: any): string {
    return this.formatValueWithUnit(value, 'generic');
  }

  // 快速生成简单结果的描述（不调用AI，立即返回）- 已废弃，使用generateQuickAnswer
  private generateSimpleExplanation(question: string, result: any[]): string {
    return this.generateQuickAnswer(question, result);
  }

  // 保留旧方法以兼容
  private _deprecatedGenerateSimpleExplanation(question: string, result: any[]): string {
    const count = result.length;
    if (count === 0) return '没有查询到数据';

    const keys = Object.keys(result[0]);
    const firstKey = keys[0];
    const secondKey = keys[1];

    // 检测查询类型
    const isCountQuery = keys.some(k => /count|total|数量|总数/i.test(k));
    const isRankQuery = /排名|前\d+|最大|最小|最高|最低|top/i.test(question);
    const isSingleValue = count === 1 && keys.length <= 2;

    let explanation = '';

    if (isSingleValue) {
      // 单值查询：如 COUNT(*)
      const value = result[0][keys[keys.length - 1]];
      explanation = `查询结果：**${this.formatNumber(value)}**`;
    } else if (isRankQuery || isCountQuery) {
      // 排名/统计查询
      const items = result.slice(0, 10).map((row, i) => {
        const name = row[firstKey];
        const value = row[secondKey] || row[keys[keys.length - 1]];
        return `${i + 1}. **${name}**: ${this.formatNumber(value)}`;
      });
      explanation = `查询到 ${count} 条结果：\n\n${items.join('\n')}`;
      if (count > 10) explanation += `\n\n...及其他 ${count - 10} 条`;
    } else {
      // 普通查询
      const preview = result.slice(0, 5).map(row => {
        const mainValue = row[firstKey];
        const detail = keys.slice(1, 3).map(k => `${k}: ${row[k]}`).join(', ');
        return `- **${mainValue}** (${detail})`;
      });
      explanation = `查询到 ${count} 条结果：\n\n${preview.join('\n')}`;
      if (count > 5) explanation += `\n\n...及其他 ${count - 5} 条`;
    }

    return explanation;
  }

  // 格式化数字
  private formatNumber(value: any): string {
    if (typeof value !== 'number') return String(value);
    if (value >= 100000000) return (value / 100000000).toFixed(2) + '亿';
    if (value >= 10000) return (value / 10000).toFixed(2) + '万';
    return value.toLocaleString();
  }

  private getAnswerLLMTimeoutMs(): number {
    const sec = Number(process.env.DATAMIND_ANSWER_LLM_TIMEOUT_SECONDS ?? '45');
    const ms = Number.isFinite(sec) && sec > 0 ? sec * 1000 : 45_000;
    return Math.min(Math.max(ms, 5_000), 180_000);
  }

  private applyPatentIpcPerfGuard(sql: string, question: string): { changed: boolean; sql: string; yearRange: number } {
    try {
      const yearRange = (() => {
        const n = Number(process.env.DATAMIND_DEFAULT_YEAR_RANGE ?? '3');
        return Number.isFinite(n) && n > 0 ? Math.min(Math.max(Math.floor(n), 1), 20) : 3;
      })();

      const q = (question || '').toLowerCase();
      const looksLikeDist = /分布|占比|比例|top|排名|主要|最多|最少/.test(question) || /distribution|share|ratio/.test(q);
      if (!looksLikeDist) return { changed: false, sql, yearRange };

      const normSql = (sql || '').replace(/\s+/g, ' ').trim();
      if (!/\bfrom\s+`?patent_data`?\b/i.test(normSql)) return { changed: false, sql, yearRange };

      // 仅对 IPC 分组类统计生效
      const hasGroupByIpc = /\bgroup\s+by\b[^;]*\bipc/i.test(normSql);
      if (!hasGroupByIpc) return { changed: false, sql, yearRange };

      // 如果已经有年份过滤，则不重复注入
      if (/\b(申请年份|公开公告年份|授权公告年份)\b/i.test(normSql)) return { changed: false, sql, yearRange };
      if (/\b(申请日|公开公告日|授权公告日)\b/i.test(normSql)) return { changed: false, sql, yearRange };

      // 优先选择「公开公告年份」其次「申请年份」再次「授权公告年份」
      const yearFieldCandidates = ['公开公告年份', '申请年份', '授权公告年份'];
      const wrapIdent = (name: string) => {
        const n = String(name || '').trim();
        if (!n) return '';
        if (n.startsWith('`') && n.endsWith('`')) return n;
        return `\`${n.replace(/`/g, '')}\``;
      };

      const yearField = yearFieldCandidates[0];
      const condition = `${wrapIdent(yearField)} >= (YEAR(CURDATE()) - ${yearRange})`;

      // 注入 WHERE / AND（简单 SQL 重写，适配常见模板）
      if (/\bwhere\b/i.test(normSql)) {
        return {
          changed: true,
          sql: normSql.replace(/\bwhere\b/i, (m) => `${m} (${condition}) AND`),
          yearRange,
        };
      }

      // 在 FROM patent_data 后插入 WHERE
      const rewritten = normSql.replace(/\bfrom\s+(`?patent_data`?)\b/i, (m) => `${m} WHERE ${condition}`);
      return { changed: rewritten !== normSql, sql: rewritten, yearRange };
    } catch {
      return { changed: false, sql, yearRange: 3 };
    }
  }

  private buildDeterministicSummary(question: string, data: any[]): string {
    if (!data || data.length === 0) return '抱歉，没有查询到相关数据。';

    const keys = Object.keys(data[0] || {});
    const primaryKey = keys[0];
    const numericKey = keys.find(k => typeof data[0]?.[k] === 'number');

    const preview = data.slice(0, 10).map((row, idx) => {
      if (primaryKey && numericKey && primaryKey !== numericKey) {
        return `${idx + 1}. ${row[primaryKey]}: ${this.formatNumber(row[numericKey])}`;
      }
      if (primaryKey) {
        return `${idx + 1}. ${row[primaryKey]}`;
      }
      return `${idx + 1}. ${JSON.stringify(row)}`;
    }).join('\n');

    const total = data.length;
    return `基于查询结果（共 ${total} 条）整理如下：\n\n${preview}`;
  }

  private pickBestGeoGroupByColumns(schemas: TableSchema[]): { province?: string; city?: string; country?: string } {
    const candidates: { province?: string; city?: string; country?: string } = {};
    for (const schema of schemas) {
      for (const col of schema.columns) {
        const n = col.name.toLowerCase();
        const c = (col.comment || '').toLowerCase();
        const text = `${n} ${c}`;

        if (!candidates.province && /(省|省份|province)/.test(text)) candidates.province = col.name;
        if (!candidates.city && /(市|城市|city)/.test(text)) candidates.city = col.name;
        if (!candidates.country && /(国家|国别|country)/.test(text)) candidates.country = col.name;
      }
    }
    return candidates;
  }

  private shouldTriggerGeoDrillDown(result: any[], geoCol: string): { shouldDrill: boolean; reason?: string } {
    if (!result || result.length === 0) return { shouldDrill: false };
    const data = Array.isArray(result) ? result : [result];
    if (data.length < 2) return { shouldDrill: false };

    // 统计地理维度的唯一值
    const uniqueValues = new Set(data.map(r => r[geoCol]).filter(v => v !== null && v !== undefined));
    const totalRows = data.length;
    const uniqueCount = uniqueValues.size;

    // 如果唯一值太少（如只有1个国家），建议下钻
    if (uniqueCount === 1) {
      const singleValue = Array.from(uniqueValues)[0];
      return {
        shouldDrill: true,
        reason: `查询结果中所有${uniqueCount}条数据的${geoCol}都是"${singleValue}"，过于单一，建议下钻到更细粒度（省/市）查看分布`
      };
    }

    // 如果数据集中在某一个值（占比超过80%），也建议下钻
    const valueCounts = new Map<string, number>();
    for (const row of data) {
      const v = row[geoCol];
      if (v !== null && v !== undefined) {
        valueCounts.set(v, (valueCounts.get(v) || 0) + 1);
      }
    }

    for (const [value, count] of valueCounts) {
      const ratio = count / totalRows;
      if (ratio > 0.8 && uniqueCount <= 3) {
        return {
          shouldDrill: true,
          reason: `查询结果中${count}/${totalRows}条数据（${(ratio * 100).toFixed(1)}%）的${geoCol}为"${value}"，分布过于集中，建议下钻查看其他维度`
        };
      }
    }

    return { shouldDrill: false };
  }

  private async executeGeoDrillDown(
    question: string,
    dataSource: BaseDataSource,
    schemas: TableSchema[],
    dbType: string,
    history: ChatMessage[],
    originalResult: any[],
    noChart?: boolean
  ): Promise<{ result: any[]; sql: string; wasDrillDown: boolean }> {
    const geo = this.pickBestGeoGroupByColumns(schemas);

    // 策略1: 有国家字段且值单一 → 下钻到省
    if (geo.country && geo.province) {
      const drillCheck = this.shouldTriggerGeoDrillDown(originalResult, geo.country);
      if (drillCheck.shouldDrill) {
        console.log(`[GeoDrillDown] ${drillCheck.reason}`);
        console.log(`[GeoDrillDown] 触发下钻: ${geo.country} -> ${geo.province}`);

        const drillSql = `SELECT ${geo.province}, COUNT(1) as cnt FROM ${schemas[0]?.tableName || 'data'} GROUP BY ${geo.province} ORDER BY cnt DESC LIMIT 20`;
        const drillResult = await dataSource.executeQuery(drillSql);

        if (drillResult.success && drillResult.data && drillResult.data.length > 0) {
          return { result: drillResult.data, sql: drillSql, wasDrillDown: true };
        }
      }
    }

    // 策略2: 有省字段但值单一 → 下钻到市
    if (geo.province && geo.city) {
      const drillCheck = this.shouldTriggerGeoDrillDown(originalResult, geo.province);
      if (drillCheck.shouldDrill) {
        console.log(`[GeoDrillDown] ${drillCheck.reason}`);
        console.log(`[GeoDrillDown] 触发下钻: ${geo.province} -> ${geo.city}`);

        const drillSql = `SELECT ${geo.city}, COUNT(1) as cnt FROM ${schemas[0]?.tableName || 'data'} GROUP BY ${geo.city} ORDER BY cnt DESC LIMIT 20`;
        const drillResult = await dataSource.executeQuery(drillSql);

        if (drillResult.success && drillResult.data && drillResult.data.length > 0) {
          return { result: drillResult.data, sql: drillSql, wasDrillDown: true };
        }
      }
    }

    // 策略3: 省市组合下钻（当省市都有且用户问的是分布）
    if (geo.province && geo.city && this.shouldPreferProvinceCity(question)) {
      const drillSql = `SELECT ${geo.province}, ${geo.city}, COUNT(1) as cnt FROM ${schemas[0]?.tableName || 'data'} GROUP BY ${geo.province}, ${geo.city} ORDER BY cnt DESC LIMIT 20`;
      const drillResult = await dataSource.executeQuery(drillSql);

      if (drillResult.success && drillResult.data && drillResult.data.length > 0) {
        console.log(`[GeoDrillDown] 触发省市组合下钻`);
        return { result: drillResult.data, sql: drillSql, wasDrillDown: true };
      }
    }

    return { result: originalResult, sql: '', wasDrillDown: false };
  }

  private shouldPreferProvinceCity(question: string): boolean {
    return /(地区|区域|哪里|分布|集中在|主要在|地域|省|市)/.test(question);
  }

  private getGeoPreferredLevel(question: string): 'province' | 'city' | 'province_city' {
    const q = question || '';
    // 明确提到“市/城市”或“省市”时，按更细粒度统计
    if (/(省市|省\/市|省和市|省\s*市)/.test(q)) return 'province_city';
    if (/(城市|市级|按市|到市|市)/.test(q) && !/(上市|市值)/.test(q)) return 'city';
    // 默认：地域分布类问题，优先省级（量大更稳、更快）
    return 'province';
  }

  // AI 生成符合中国人回答习惯的自然语言回答
  private async generateChineseAnswer(
    question: string,
    result: any,
    history: ChatMessage[],
    ragContext?: string,
    noChart?: boolean,
    executedSql?: string,
    schemaContext?: string
  ): Promise<string> {
    if (!result || (Array.isArray(result) && result.length === 0)) {
      return '抱歉，没有查询到相关数据。您可以换个方式描述问题，或检查数据源中是否有对应的数据。';
    }

    const data = Array.isArray(result) ? result : [result];
    const totalCount = data.length;
    const keys = Object.keys(data[0] || {});

    // 快速路径：简单结果 + 非分析性问题 → 模板
    // 分析性问题（趋势/对比/原因/建议/统计类问题）即使数据简单也必须走 AI
    const needsAnalysis = /趋势|增长|下降|变化|对比|比较|原因|为什么|是否|怎么样|如何|分析|洞察|建议|预测|评价|总结|耗时|平均|统计|最大|最小|最高|最低|最多|最少|分布|占比|比例|最长|最短/.test(question);
    const isSimpleResult = !needsAnalysis && (
      (totalCount === 1 && keys.length <= 3) ||
      (totalCount <= 10 && keys.length <= 2)
    );
    if (isSimpleResult) {
      return this.generateQuickAnswer(question, data);
    }

    await this.ensureInitialized();

    // 限制发送给AI的数据量
    let limitedResult: any[];
    if (totalCount <= 50) {
      limitedResult = data;
    } else {
      limitedResult = [...data.slice(0, 30), ...data.slice(-20)];
    }
    const resultStr = JSON.stringify(limitedResult);
    const dataSummary = totalCount > 50 ? `(总共${totalCount}条，已省略中间数据)` : '';

    // 检查结果是否包含维度字段
    const hasDimensionField = data.length > 0 &&
      Object.keys(data[0]).some(key =>
        /(\u5730\u533a|\u533a\u57df|\u7701\u4efd|\u57ce\u5e02|\u7c7b\u578b|\u7c7b\u522b|\u65f6\u95f4|\u65e5\u671f|region|area|province|city|type|category|date|time)/i.test(key)
      );

    let systemPrompt = `你是一位专业的数据分析师，请根据查询结果生成一段符合中国人语言习惯的回答。不要输出思考过程，直接给出回答。回答简洁有力，不超过300字。

**回答风格要求**:
1. 像一位专业分析师在回答提问，语气客观、专业。不要使用任何称呼（如“亲”、“老王”等）或问候语
2. 先直接回答用户的问题（一句话给出核心结论），然后再展开具体数据
3. 数值要用中文习惯的表达：用“万”“亿”等单位，不要显示长串数字
4. 有排名数据时突出前几名和特点，适当做对比和洞察
5. 如果有明显的趋势或规律，用一句话概括
6. 禁止说“无法分析”“数据不足”，有数据就给结论
7. 用 Markdown 格式使内容更清晰易读${hasDimensionField ? '\n8. 结果包含分类/地域维度，请详细列出每个维度的具体数值' : ''}

**举例**:
- 用户问“哪个地区人口最多” → “从数据来看，**广东省**的人口最多，达到了1.26亿，其次是山东省(1.02亿)和河南省(9,937万)...”
- 用户问“月销售额趋势” → “总体来看，销售额呈现**稳步上升**趋势。其中3月份增长最快，环比增长23%...”`;

    if (executedSql) {
      systemPrompt += `\n\n执行的SQL:\n${executedSql}`;
    }
    if (schemaContext) {
      systemPrompt += `\n\n数据表结构摘要:\n${schemaContext.slice(0, 500)}`;
    }
    if (ragContext) {
      systemPrompt += `\n\n参考知识:\n${ragContext.slice(0, 300)}`;
    }
    if (noChart) {
      systemPrompt += `\n注意:当前为无图模式，请不要在回复中提及任何图表、图形或可视化内容。`;
    }

    try {
      const timeoutMs = this.getAnswerLLMTimeoutMs();
      const response = await Promise.race([
        this.callWithRetry(() => this.openai.chat.completions.create({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `问题:${question}\n查询结果${dataSummary}:${resultStr}` }
          ],
          temperature: 0.3,
          max_tokens: 2048,
        })),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`answer llm timeout ${timeoutMs}ms`)), timeoutMs)),
      ]) as any;

      // 处理带 <think> 标签的模型响应（如 Qwen3、DeepSeek）：移除思考内容，取实际回答
      let answer = response.choices[0].message.content || '';
      answer = answer.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      // 如果模型只输出了未闭合的 <think> 标签（token 截断），则回退到模板
      if (!answer || answer.startsWith('<think>')) {
        console.warn('generateChineseAnswer: AI 回答为空或被 think 截断，回退模板');
        return this.buildDeterministicSummary(question, data);
      }
      return answer;
    } catch (error: any) {
      console.error('generateChineseAnswer: AI call failed:', error.message);
      // 准确性第一：多行复杂数据尝试一次简化 AI 调用（短超时），而非直接退回模板
      if (totalCount > 10 || keys.length > 2) {
        try {
          const briefData = JSON.stringify(data.slice(0, 10));
          // 用独立的短超时 OpenAI 实例，避免 AI 服务挂掉时双倍等待
          const timeoutMs = Math.min(15_000, this.getAnswerLLMTimeoutMs());
          const retryResponse = await Promise.race([
            this.callWithRetry(() => this.openai.chat.completions.create({
              model: this.model,
              messages: [
                { role: 'system', content: '用中文简洁回答用户的数据问题，基于查询结果给出结论。' },
                { role: 'user', content: `问题:${question}\n数据:${briefData}` }
              ],
              temperature: 0.3,
              max_tokens: 500,
            }), 1),  // maxRetries=1，不多次重试
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('retry timeout')), timeoutMs))
          ]) as any;
          const retryAnswer = retryResponse.choices[0].message.content;
          if (retryAnswer) return retryAnswer;
        } catch (retryError: any) {
          console.error('generateChineseAnswer: retry also failed:', retryError.message);
        }
      }
      // 最终兜底：确定性总结，保证接口永远有可用输出
      return this.buildDeterministicSummary(question, data);
    }
  }

  // 带上下文的结果解读
  private async explainResultWithContext(
    question: string,
    result: any,
    history: ChatMessage[],
    ragContext?: string,
    noChart?: boolean
  ): Promise<string> {
    if (!result || (Array.isArray(result) && result.length === 0)) {
      return '数据库中没有相关数据';
    }

    const totalCount = Array.isArray(result) ? result.length : 1;
    const data = Array.isArray(result) ? result : [result];
    const keys = Object.keys(data[0] || {});

    // 快速路径：简单结果 + 非分析性问题 → 模板（与 generateChineseAnswer 保持一致）
    const needsAnalysis = /趋势|增长|下降|变化|对比|比较|原因|为什么|是否|怎么样|如何|分析|洞察|建议|预测|评价|总结|耗时|平均|统计|最大|最小|最高|最低|最多|最少|分布|占比|比例|最长|最短/.test(question);
    const isSimpleResult = !needsAnalysis && (
      (totalCount === 1 && keys.length <= 3) ||
      (totalCount <= 10 && keys.length <= 2)
    );
    if (isSimpleResult) {
      return this.generateQuickAnswer(question, data);
    }

    await this.ensureInitialized();

    // 限制发送给AI的数据量，最多50条，超过则只取前30+后20
    let limitedResult: any[];
    if (totalCount <= 50) {
      limitedResult = data;
    } else {
      limitedResult = [...data.slice(0, 30), ...data.slice(-20)];
    }
    const resultStr = JSON.stringify(limitedResult);
    const dataSummary = totalCount > 50 ? `(总共${totalCount}条，已省略中间数据)` : '';

    // 检查结果是否包含维度字段（用于增强分析）
    const hasDimensionField = Array.isArray(result) && result.length > 0 &&
      Object.keys(result[0]).some(key =>
        key.toLowerCase().includes('地区') || key.toLowerCase().includes('区域') ||
        key.toLowerCase().includes('省份') || key.toLowerCase().includes('城市') ||
        key.toLowerCase().includes('类型') || key.toLowerCase().includes('类别') ||
        key.toLowerCase().includes('时间') || key.toLowerCase().includes('日期')
      );

    let systemPrompt = `你是专业的数据分析助手。基于查询结果给出简洁准确的业务洞察。

**核心规则**:
1. 【强制】必须基于查询结果进行分析，结果有数据就给出具体结论，禁止说"无法分析""数据不足"等
2. 【强制】地域分布：必须列出每个地区的具体数量，如"南昌: XXX件, 武汉: XXX件, ..."，禁止只说"中国: XXX件"
3. 【强制】分类统计：必须列出每个类别的具体数值，如"类型A: XXX, 类型B: XXX, ..."
4. 严格按真实数据解读，禁止幻觉：1000万=1千万≠1亿，用"万""亿"等单位
5. 时间趋势：指出上升/下降/稳定的趋势，给出关键时间点
6. 突出Top项目：指出最多/最少的类别或地区，突出异常值
7. 用自然语言描述数据含义，直接回答用户问题${hasDimensionField ? '\n\n【注意】检测结果包含维度字段，请详细列出每个维度的具体数值' : ''}`;

    if (ragContext) {
      systemPrompt += `\n\n参考知识:\n${ragContext.slice(0, 300)}`;
    }
    if (noChart) {
      systemPrompt += `\n注意:当前为无图模式，请不要在回复中提及任何图表、图形或可视化内容。`;
    }

    try {
      const response = await this.callWithRetry(() => this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `问题:${question}\n结果${dataSummary}:${resultStr}` }
        ],
        temperature: 0.3,
        max_tokens: 4096,
      })) as any;

      return response.choices[0].message.content || '无法解读结果';
    } catch (error: any) {
      console.error('explainResultWithContext: AI call failed:', error.message);
      if (Array.isArray(result) && result.length > 0) {
        return `查询成功，共返回 ${result.length} 条数据。`;
      }
      return '查询成功，但无法生成详细说明。';
    }
  }

  // 带上下文的文件查询规划
  private async planFileQueryWithContext(
    question: string,
    schemas: TableSchema[],
    history: ChatMessage[],
    schemaContext: string,
    additionalContext: string,
    noChart?: boolean
  ): Promise<{ sql: string; chartType?: string; chartTitle?: string; chartConfig?: { xField?: string; yField?: string } }> {
    // 快速路径: 模板匹配（跳过 LLM）
    const templateResult = this.tryGenerateSQLFromTemplate(question, schemas, 'file', history, noChart);
    if (templateResult) {
      console.log('=== [文件] 模板生成SQL，跳过LLM调用');
      return templateResult;
    }

    await this.ensureInitialized();

    // 识别维度字段
    const dimensionFields: string[] = [];
    for (const schema of schemas) {
      for (const col of schema.columns) {
        const name = col.name.toLowerCase();
        if (name.includes('地区') || name.includes('区域') || name.includes('省份') ||
          name.includes('城市') || name.includes('国家') ||
          name.includes('类型') || name.includes('类别') || name.includes('分类') ||
          name.includes('时间') || name.includes('日期') || name.includes('年份')) {
          dimensionFields.push(`- ${col.name}: 可用于GROUP BY的维度字段`);
        }
      }
    }

    // 构建维度字段示例
    const dimensionExamples = dimensionFields.length > 0
      ? `\n**示例**:
- 问"参赛地区分布" → SELECT 参赛地区, COUNT(1) as count FROM table GROUP BY 参赛地区 ORDER BY count DESC LIMIT 20
- 问"类型分布" → SELECT 类型, COUNT(1) as count FROM table GROUP BY 类型 ORDER BY count DESC LIMIT 20
- 问"时间趋势" → SELECT 时间, COUNT(1) as count FROM table GROUP BY 时间 ORDER BY 时间 ASC LIMIT 100`
      : '';

    const dimensionHint = dimensionFields.length > 0
      ? `\n\n**可用维度字段（用于GROUP BY分组分析）**:\n${dimensionFields.join('\n')}${dimensionExamples}`
      : '';

    const response = await this.callWithRetry(() => this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `SQL生成器（文件数据源）。返回JSON:{"sql":"SELECT...","chartType":"bar|line|pie|none","chartTitle":"简短标题","chartConfig":{"xField":"维度字段","yField":"数值字段"}}

**核心规则**:
1. 【强制】用户问"分布""趋势""对比""最多""最少"等分析时，必须使用维度字段GROUP BY，禁止说"无法分析"
2. 【强制】地域/类型/时间分析时，必须 SELECT 维度字段, COUNT(1) GROUP BY 维度字段
3. 聚合查询优先，按值DESC排序，LIMIT 20（时间序列可增加到100）
4. 必须检查sampleData确定字段真实值，严禁猜测
5. 图表配置: xField=维度字段, yField=数值字段, 颜色区分不同维度${dimensionHint}

${noChart ? '注意:用户开启了无图模式，请将"chartType"设置为"none"且不要生成图表标题。' : ''}

表结构:
${schemaContext}${additionalContext}`
        },
        { role: 'user', content: question }
      ],
      temperature: 0.1,
      max_tokens: 4096,
    })) as any;

    const content = response.choices[0].message.content || '{}';
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse AI query plan:', e);
    }

    return { sql: `SELECT COUNT(1) as total FROM ${schemas[0]?.tableName || 'data'}`, chartType: 'none' };
  }

  // 不带上下文的文件查询规划 (调用带上下文的版本)
  private async planFileQuery(
    question: string,
    schemas: TableSchema[],
    history: ChatMessage[],
    noChart?: boolean
  ): Promise<{ sql: string; chartType?: string; chartTitle?: string, chartConfig?: { xField?: string, yField?: string } }> {
    const schemaContext = this.formatSchemaForAI(schemas);
    return this.planFileQueryWithContext(question, schemas, history, schemaContext, '', noChart);
  }

  // 不带上下文的 SQL 生成 (调用带上下文的版本)
  private async generateSQL(
    question: string,
    schemas: TableSchema[],
    dbType: string,
    history: ChatMessage[],
    noChart?: boolean
  ): Promise<string> {
    const schemaContext = this.formatSchemaForAI(schemas);
    const result = await this.generateSQLWithContext(question, schemas, dbType, history, schemaContext, '', noChart);
    return result.sql;
  }

  // 不带上下文的结果解读 (调用带上下文的版本)
  private async explainResult(
    question: string,
    result: any,
    history: ChatMessage[],
    noChart?: boolean
  ): Promise<string> {
    return this.explainResultWithContext(question, result, history, undefined, noChart);
  }

  // 生成图表数据
  // 获取中文字段名（从 schema 或映射）
  private getChineseFieldName(fieldName: string, schemas?: TableSchema[]): string {
    const lowerName = fieldName.toLowerCase();
    // 处理带表名前缀的情况 (例如 country.Name -> Name)
    const pureName = lowerName.includes('.') ? lowerName.split('.').pop()! : lowerName;

    // 1. 尝试从 schema 中查找注释
    if (schemas) {
      for (const table of schemas) {
        // 先尝试完整匹配，再尝试纯名称匹配
        let col = table.columns.find(c => c.name.toLowerCase() === lowerName);
        if (!col) col = table.columns.find(c => c.name.toLowerCase() === pureName);

        if (col && col.comment) {
          // 清理注释，移除 "(中文名)" 这种括号或特殊符号
          return col.comment.replace(/\(.*\)/, '').replace(/（.*）/, '').trim();
        }
      }
    }

    // 2. 尝试从通用映射中查找
    if (FIELD_NAME_MAP[pureName]) {
      return FIELD_NAME_MAP[pureName];
    }
    if (FIELD_NAME_MAP[lowerName]) {
      return FIELD_NAME_MAP[lowerName];
    }

    // 3. 返回原名（如果是英文且包含下划线，尝试美化一下）
    return fieldName;
  }

  private generateChartData(data: any[], chartType: 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'none', title: string, schemas?: TableSchema[], preferredConfig?: { xField?: string, yField?: string }): ChartData | undefined {
    if (!data || data.length === 0 || chartType === 'none') return undefined;

    const keys = Object.keys(data[0]);
    if (keys.length < 2) return undefined;

    let xField = keys[0];
    let yField = keys[1];

    // 辅助函数：不区分大小写的字段查找
    const findKeyCaseInsensitive = (target: string): string | undefined => {
      if (!target) return undefined;
      const lower = target.toLowerCase().trim();
      return keys.find(k => k.toLowerCase().trim() === lower);
    };

    // 优先使用 AI 指定的配置
    if (preferredConfig) {
      if (preferredConfig.xField) {
        const match = findKeyCaseInsensitive(preferredConfig.xField);
        if (match) xField = match;
      }
      if (preferredConfig.yField) {
        const match = findKeyCaseInsensitive(preferredConfig.yField);
        if (match) yField = match;
      }
    }

    // 如果 AI 没有指定，或者指定的字段没找到，则进行自动推断
    const dimensionKeywords = ['year', 'month', 'date', 'day', 'time', '年份', '月份', '日期', '时间', 'indepyear', 'continent', 'region', 'name', 'type', 'category', '级别', '状态', '类型', '分类', '国家', '地区', '城市'];

    // 扫描前5行以确定字段类型
    const sampleRows = data.slice(0, 5);

    // 1. 尝试寻找明确的维度字段作为 X 轴 (即使它是数值型的，如年份)
    // 如果 preferredConfig 已经指定了有效的 xField，则跳过
    let foundX = !!(preferredConfig?.xField && findKeyCaseInsensitive(preferredConfig.xField));

    if (!foundX) {
      for (const key of keys) {
        if (dimensionKeywords.some(k => key.toLowerCase().includes(k))) {
          xField = key;
          foundX = true;
          break;
        }
      }
    }

    // 2. 找真正的数值字段作为 Y 轴
    // 如果 preferredConfig 已经指定了有效的 yField，则跳过
    let foundY = !!(preferredConfig?.yField && findKeyCaseInsensitive(preferredConfig.yField));

    if (!foundY) {
      for (const key of keys) {
        if (foundX && key === xField) continue;

        // 检查该字段在样本中是否大部分为数字
        const isNumeric = sampleRows.every(row => {
          const val = row[key];
          return val === null || typeof val === 'number' || (!isNaN(Number(val)) && typeof val !== 'boolean' && String(val).trim() !== '');
        });

        if (isNumeric) {
          const hasValue = sampleRows.some(row => row[key] !== null && row[key] !== undefined && String(row[key]).trim() !== '');
          if (hasValue) {
            yField = key;
            foundY = true;
            // 如果这不是时间类字段，且没找到 X 轴，或者已经找到了 X 轴且它不是这个字段，那这就是好的 Y 轴
            if (!dimensionKeywords.some(k => key.toLowerCase().includes(k))) {
              break;
            }
          }
        }
      }
    }

    // 如果还没有合适的 X 轴（排除掉 Y 轴后找第一个非数值或者是第一个字段）
    if (!foundX) {
      for (const key of keys) {
        if (key === yField) continue;
        xField = key;
        break;
      }
    }



    // 自动优化标题：如果标题包含疑问词、太长，或者看起来是原始问题，尝试使用字段名生成标题
    let finalTitle = title;
    const isQuestion = /[?？吗什么怎么如何]/.test(title);
    const isTooLong = title.length > 12;

    if (isQuestion || isTooLong) {
      if (xField && yField) {
        const cleanX = this.getChineseFieldName(xField, schemas);
        // 尝试移除字段名中的聚合函数包装
        const rawY = yField.replace(/^(sum|count|avg|max|min)\((.*)\)$/i, '$2').trim() || yField;
        const cleanY = this.getChineseFieldName(rawY, schemas);

        if (yField.toLowerCase().includes('count') || yField === 'total' || yField === 'count') {
          finalTitle = `${cleanX}分布`;
        } else {
          finalTitle = `${cleanX}${cleanY}统计`; // 去掉中间的横杠，更像中文标题
        }
      }
    }

    // 按数值字段降序排序（除了折线图保持原顺序用于时间趋势）
    // 按数值字段降序排序（除了折线图保持原顺序用于时间趋势，或者 X 轴本身就是维度/时间）
    let sortedData = [...data];
    // 判断 X 轴是否是时间/维度字段（已在前面 dimensionKeywords 定义）
    const isDimensionX = dimensionKeywords.some(k => xField.toLowerCase().includes(k));

    // 如果不是折线图，且 X 轴看起来不是时间维度，才按 Y 轴数值排序
    // (因为如果是时间/年份字段，我们通常希望保持时间顺序，而不是按数值大小乱序)
    if (chartType !== 'line' && !isDimensionX) {
      sortedData = sortedData.sort((a, b) => {
        const aVal = Number(a[yField]) || 0;
        const bVal = Number(b[yField]) || 0;
        return bVal - aVal; // 降序
      });
    }

    // 如果数据超过显示限制，合并剩余数据为"其他"
    // 修复：柱状图直接显示前10，不需要"其他"；饼图才需要合并剩余为"其他"
    const maxItems = chartType === 'pie' ? 8 : 10; // 饼图8项+其他，柱状图直接显示前10
    let chartData = sortedData;

    if (sortedData.length > maxItems) {
      // 柱状图：直接取前10，不合并"其他"
      if (chartType !== 'pie') {
        chartData = sortedData.slice(0, maxItems);
        console.log(`[generateChartData] 柱状图截取前${maxItems}项，不合并其他`);
      } else {
        // 饼图：合并剩余项为"其他"，但只合并非尾部的小占比项
        const topItems = sortedData.slice(0, maxItems - 1);
        const otherItems = sortedData.slice(maxItems - 1);

        // 判断是否是平均值或比例类的数据（通过字段名或标题判断），这类数据聚合时应使用平均值而非求和
        const yFieldLower = yField.toLowerCase();
        const isAverage = yFieldLower.includes('avg') ||
          yFieldLower.includes('rate') ||
          yFieldLower.includes('percentage') ||
          yFieldLower.includes('ratio') ||
          yFieldLower.includes('percapita') ||       // 人均类
          yFieldLower.includes('per_capita') ||
          yFieldLower.includes('expectancy') ||       // 平均寿命
          yFieldLower.includes('density') ||           // 密度
          yFieldLower.includes('average') ||
          title.includes('平均') ||
          title.includes('均值') ||
          title.includes('人均') ||
          title.includes('比例') ||
          title.includes('占比') ||
          title.includes('密度') ||
          title.includes('率');

        let otherValue: number;
        if (isAverage) {
          // 平均值类：计算其他项的平均值
          otherValue = otherItems.reduce((sum, item) => sum + (Number(item[yField]) || 0), 0) / otherItems.length;
        } else {
          // 计数/求和类：计算其他项的总和
          otherValue = otherItems.reduce((sum, item) => sum + (Number(item[yField]) || 0), 0);
        }

        // 创建"其他"项，标签注明聚合方式
        const otherItem: any = {};
        otherItem[xField] = isAverage
          ? `其他(${otherItems.length}项均值)`
          : `其他(${otherItems.length}项)`;
        otherItem[yField] = isAverage ? Number(otherValue.toFixed(2)) : otherValue;

        chartData = [...topItems, otherItem];
      }
    }

    // 智能生成单位元信息
    const unitInfo = this.detectChartUnitInfo(yField, xField, chartData, schemas);

    return {
      type: chartType as 'bar' | 'line' | 'pie' | 'area' | 'scatter',
      title: finalTitle.slice(0, 30),
      data: chartData,
      config: { xField, yField, labelField: xField, valueField: yField },
      unitInfo
    };
  }

  // 智能检测图表的单位、缩放和中文字段名
  private detectChartUnitInfo(yField: string, xField: string, data: any[], schemas?: TableSchema[]): ChartData['unitInfo'] {
    const yFieldCn = this.getChineseFieldName(yField, schemas);
    const xFieldCn = this.getChineseFieldName(xField, schemas);

    // 获取 Y 轴数据范围
    const yValues = data.map(d => Number(d[yField]) || 0).filter(v => v !== 0);
    const maxVal = yValues.length > 0 ? Math.max(...yValues) : 0;
    const minVal = yValues.length > 0 ? Math.min(...yValues.map(Math.abs)) : 0;

    const yLower = yField.toLowerCase();
    const isPerCapita = yLower.includes('percapita') || yLower.includes('per_capita') || yFieldCn.includes('人均');
    const isRatio = /(ratio|比率|占比|比值)/i.test(yField) || /(ratio|比率|占比|比值)/i.test(yFieldCn);
    const isPercentage = /(percentage|rate|百分比|率)/i.test(yField);
    const isGDP = /(gdp|gnp|生产总值|产值)/i.test(yField);
    const isPopulation = !isRatio && !isPerCapita && /(population|人口|人数)/i.test(yField);
    const isArea = /(area|surface|面积|国土)/i.test(yField);
    const isCount = /(count|total|number|数量|个数)/i.test(yField);
    const isCurrency = !isPerCapita && /(金额|收入|支出|revenue|cost|price|amount|薪资|工资|利润)/i.test(yField);

    let unitName = '';
    let scale = 1;

    // 比率/占比类：不做缩放
    if (isRatio) {
      return { unitName: '', scale: 1, yFieldCn, xFieldCn };
    }

    // 百分比类
    if (isPercentage) {
      return { unitName: '%', scale: 1, yFieldCn, xFieldCn };
    }

    // 人均 GDP/GNP：数据库 GNP 以百万为单位
    if (isPerCapita && isGDP && maxVal < 1) {
      return { unitName: '万美元', scale: 0.01, yFieldCn, xFieldCn };
    }

    // 人均其他字段：保持原值
    if (isPerCapita) {
      return { unitName: '', scale: 1, yFieldCn, xFieldCn };
    }

    // 大数值自动缩放
    if (maxVal >= 100000000) { scale = 100000000; unitName = '亿'; }
    else if (maxVal >= 10000) { scale = 10000; unitName = '万'; }

    // GDP/GNP 总量（百万美元单位）
    if (isGDP && !isPerCapita) {
      if (maxVal >= 1000000) { unitName = '万亿美元'; scale = 1000000; }
      else if (maxVal >= 1000) { unitName = '亿美元'; scale = 1000; }
      else { unitName = '百万美元'; scale = 1; }
    } else if (isCurrency) {
      unitName = unitName ? unitName + '元' : '元';
    } else if (isPopulation) {
      unitName = unitName ? unitName + '人' : '人';
    } else if (isArea) {
      if (scale >= 1000000) { unitName = '万平方公里'; scale = 1000000; }
      else { unitName = '平方公里'; scale = 1; }
    } else if (isCount) {
      const isLangOrType = /(语言|种类|类型|language|type)/i.test(yField);
      unitName = unitName ? unitName + (isLangOrType ? '种' : '个') : (isLangOrType ? '种' : '个');
    }

    return { unitName, scale, yFieldCn, xFieldCn };
  }

  // 分块处理数组
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Schema分析 - 优化版：小中型 schema 尽量合并为一次 AI 调用，超时则快速回退到规则识别
  async analyzeSchema(schemas: TableSchema[]): Promise<{
    tables: { tableName: string; tableNameCn: string; columns: { name: string; type: string; nameCn: string; description: string }[] }[];
    suggestedQuestions: string[];
  }> {
    await this.ensureInitialized();

    if (schemas.length === 0) {
      return { tables: [], suggestedQuestions: [] };
    }

    const finalizedTables: any[] = [];
    const totalColumnCount = schemas.reduce((sum, t) => sum + t.columns.length, 0);
    const canUseSingleAiBatch = totalColumnCount <= 80 && schemas.length <= 10;
    const shouldUseHeuristicAnalysis = schemas.length > 12 || totalColumnCount > 160;

    if (shouldUseHeuristicAnalysis) {
      return this.buildHeuristicAnalysisResult(schemas);
    }

    if (canUseSingleAiBatch) {
      // === 快速路径：小中型 schema 合并为1次 AI 调用（字段分析+问题生成一起） ===
      console.log(`📊 快速分析模式: ${schemas.length}表, ${totalColumnCount}字段, 合并为1次AI调用`);

      const schemaForAI = schemas.slice(0, 10).map(t => ({
        tableName: t.tableName,
        columns: t.columns.map(c => ({ name: c.name, type: c.type })),
        sampleData: t.sampleData?.slice(0, 1) || []
      }));

      try {
        const response = await this.callSchemaAnalysisRequest({
          messages: [
            {
              role: 'system',
              content: `分析数据表结构，返回JSON:
{"tables":[{"tableName":"原表名","tableNameCn":"中文名","columns":[{"name":"原字段名","nameCn":"中文名","description":"业务描述"}]}],"questions":["8-10个自然语言业务分析问题"]}
规则:
1. name 必须原样返回
2. nameCn 使用简洁中文，不超过6个字
3. description 仅给业务含义短语，不超过12个字
4. questions 只生成 8-10 个，口语化且不超过18个字
5. 不要解释字段类型，不要输出额外文字`
            },
            { role: 'user', content: JSON.stringify(schemaForAI) }
          ],
          maxTokens: 1800,
        }) as any;

        const content = response.choices[0].message.content || '{}';
        const parsed = JSON.parse(content);
        const aiTables = parsed.tables || [];

        // 回填到 finalizedTables
        for (const tableSchema of schemas) {
          const aiTable = aiTables.find((t: any) => t.tableName === tableSchema.tableName) || {};
          const aiColumns = aiTable.columns || [];

          finalizedTables.push({
            tableName: tableSchema.tableName,
            tableNameCn: aiTable.tableNameCn || this.guessTableNameCn(tableSchema.tableName),
            columns: tableSchema.columns.map(origCol => {
              const aiCol = aiColumns.find((c: any) =>
                c.name?.toLowerCase().trim() === origCol.name.toLowerCase().trim()
              );
              const isChineseName = /[\u4e00-\u9fa5]/.test(origCol.name) &&
                (origCol.name.match(/[\u4e00-\u9fa5]/g) || []).length / origCol.name.length > 0.5;
              return {
                name: origCol.name,
                type: origCol.type,
                nameCn: isChineseName ? origCol.name : (aiCol?.nameCn || origCol.name),
                description: aiCol?.description || (origCol.comment || '-')
              };
            })
          });
        }

        const smartQuestions = parsed.questions || [];
        return {
          tables: finalizedTables,
          suggestedQuestions: smartQuestions.length >= 5
            ? smartQuestions.slice(0, 15)
            : this.generateChineseQuestions(schemas, finalizedTables)
        };
      } catch (e: any) {
        console.error(`快速分析失败，回退到规则模式: ${e?.message || e}`);
        return this.buildHeuristicAnalysisResult(schemas);
      }
    }

    // === 标准路径：大表/多表分段分析 ===
    if (finalizedTables.length === 0) {
      for (const tableSchema of schemas.slice(0, 100)) {
        const allColumns = tableSchema.columns;
        const totalColumns = allColumns.length;

        if (totalColumns > 2000) {
          console.warn(`⚠️ 表 ${tableSchema.tableName} 包含 ${totalColumns} 个字段，超过2000个字段的分析上限`);
        }

        const columnChunks = this.chunkArray(allColumns.slice(0, 2000), 30);
        console.log(`📊 分段分析 ${tableSchema.tableName}: ${totalColumns}字段, ${columnChunks.length}组`);

        const tableResults = await Promise.all(columnChunks.map(async (chunk, index) => {
          const sampleCount = Math.min(tableSchema.sampleData?.length || 0, 1);
          const schemaForAI = {
            tableName: tableSchema.tableName,
            columns: chunk.map(c => ({ name: c.name, type: c.type })),
            sampleData: tableSchema.sampleData?.slice(0, sampleCount) || []
          };

          try {
            const response = await this.callSchemaAnalysisRequest({
              messages: [
                {
                  role: 'system',
                  content: `分析数据表结构(第${index + 1}部分)，只返回精简JSON:
{"tableNameCn":"中文表名","columns":[{"name":"原字段名","nameCn":"中文名","description":"简短说明"}]}
规则:
1. name 必须原样返回
2. nameCn 使用简洁中文，不超过6个字
3. description 仅给业务含义短语，不超过12个字
4. 不要解释字段类型，不要输出额外文字`
                },
                { role: 'user', content: JSON.stringify(schemaForAI) }
              ],
              maxTokens: 900,
            }) as any;

            const content = response.choices[0].message.content || '{}';
            return JSON.parse(content);
          } catch (error: any) {
            console.warn(`⚠️ 表 ${tableSchema.tableName} 第 ${index + 1} 段 AI 分析失败，回退规则识别: ${error?.message || error}`);
            return {
              tableNameCn: this.guessTableNameCn(tableSchema.tableName),
              columns: chunk.map((column) => this.buildHeuristicColumnAnalysis(column, tableSchema)),
            };
          }
        }));

        const mergedAiColumns = tableResults.flatMap(r => r.columns || []);
        const tableNameCn = tableResults[0]?.tableNameCn || this.guessTableNameCn(tableSchema.tableName);

        finalizedTables.push({
          tableName: tableSchema.tableName,
          tableNameCn,
          columns: tableSchema.columns.map(origCol => {
            const aiCol = mergedAiColumns.find((c: any) =>
              c.name?.toLowerCase().trim() === origCol.name.toLowerCase().trim()
            );
            const isChineseName = /[\u4e00-\u9fa5]/.test(origCol.name) &&
              (origCol.name.match(/[\u4e00-\u9fa5]/g) || []).length / origCol.name.length > 0.5;
            return {
              name: origCol.name,
              type: origCol.type,
              nameCn: isChineseName ? origCol.name : (aiCol?.nameCn || origCol.name),
              description: aiCol?.description || (origCol.comment || '-')
            };
          })
        });
      }
    }

    // 独立的全局问题生成（仅标准路径需要）
    let smartQuestions: string[] = [];
    const shouldGenerateAiQuestions = schemas.length <= 5 && totalColumnCount <= 60;
    if (shouldGenerateAiQuestions) {
      try {
        smartQuestions = await this.generateSmartQuestions(schemas, finalizedTables);
      } catch (e) {
        console.error('AI 问题生成失败，使用回退逻辑:', e);
      }
    }

    return {
      tables: finalizedTables,
      suggestedQuestions: smartQuestions.length >= 5
        ? smartQuestions
        : this.generateChineseQuestions(schemas, finalizedTables)
    };
  }

  private buildHeuristicAnalysisResult(schemas: TableSchema[]) {
    const heuristicTables = schemas.slice(0, 100).map((tableSchema) => this.buildHeuristicTableAnalysis(tableSchema));
    return {
      tables: heuristicTables,
      suggestedQuestions: this.generateChineseQuestions(schemas, heuristicTables),
    };
  }

  private getSchemaAnalysisTimeoutMs(): number {
    const sec = Number(process.env.DATAMIND_SCHEMA_ANALYSIS_TIMEOUT_SECONDS ?? '20');
    const ms = Number.isFinite(sec) && sec > 0 ? sec * 1000 : 20_000;
    return Math.min(Math.max(ms, 5_000), 60_000);
  }

  private async callSchemaAnalysisRequest(payload: {
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
    maxTokens: number;
    temperature?: number;
  }) {
    const timeoutMs = this.getSchemaAnalysisTimeoutMs();
    const controller = new AbortController();
    let timeoutTriggered = false;
    const timeoutId = setTimeout(() => {
      timeoutTriggered = true;
      controller.abort();
    }, timeoutMs);

    try {
      return await this.callWithRetryWithSignal(
        (signal) => (this.openai.chat.completions as any).create({
          model: this.model,
          messages: payload.messages,
          temperature: payload.temperature ?? 0.1,
          max_tokens: payload.maxTokens,
          response_format: { type: 'json_object' }
        }, { signal }),
        1,
        controller.signal
      );
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      if (timeoutTriggered || controller.signal.aborted || errorMsg.includes('aborted') || errorMsg.includes('cancelled')) {
        throw new Error(`schema analysis timeout ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private buildHeuristicColumnAnalysis(column: ColumnInfo, tableSchema: TableSchema) {
    return {
      name: column.name,
      type: column.type,
      nameCn: this.guessFieldNameCn(column, [tableSchema]),
      description: this.guessFieldDescription(column, [tableSchema]),
    };
  }

  private buildHeuristicTableAnalysis(tableSchema: TableSchema) {
    return {
      tableName: tableSchema.tableName,
      tableNameCn: this.guessTableNameCn(tableSchema.tableName),
      columns: tableSchema.columns.map((column) => this.buildHeuristicColumnAnalysis(column, tableSchema)),
    };
  }

  private guessFieldNameCn(column: ColumnInfo, schemas?: TableSchema[]): string {
    if (!column?.name) return '字段';

    const fieldName = column.name;
    if (/[\u4e00-\u9fa5]/.test(fieldName)) {
      return fieldName;
    }

    const mapped = this.getChineseFieldName(fieldName, schemas);
    if (mapped && mapped !== fieldName) {
      return mapped;
    }

    const pureName = fieldName.toLowerCase().includes('.') ? fieldName.toLowerCase().split('.').pop()! : fieldName.toLowerCase();
    const parts = pureName.split(/[_\s]+/).filter(Boolean);
    const translated = parts.map((part) => FIELD_NAME_MAP[part] || part.toUpperCase());
    return translated.join('') || fieldName;
  }

  private guessFieldDescription(column: ColumnInfo, schemas?: TableSchema[]): string {
    const comment = (column.comment || '').replace(/\(.*?\)|（.*?）/g, '').trim();
    if (comment) {
      return comment.slice(0, 24);
    }

    const nameCn = this.guessFieldNameCn(column, schemas);
    const lowerName = column.name.toLowerCase();
    const lowerType = column.type.toLowerCase();

    if (column.isPrimaryKey || (lowerName.endsWith('id') && !lowerName.includes('身份'))) {
      return `${nameCn}唯一标识`;
    }
    if (/(date|time|year|month|day|日期|时间)/i.test(lowerName) || /(date|time)/i.test(lowerType)) {
      return `${nameCn}时间信息`;
    }
    if (/(status|type|category|region|province|city|状态|类型|分类|地区)/i.test(lowerName)) {
      return `${nameCn}分类信息`;
    }
    if (/(int|decimal|float|double|number|bigint)/i.test(lowerType)) {
      return `${nameCn}数值指标`;
    }
    if (/(char|text|json|blob)/i.test(lowerType)) {
      return `${nameCn}文本信息`;
    }
    return `${nameCn}字段`;
  }

  // 提取关键字段信息
  private extractFieldInfo(schemas: TableSchema[]): string {
    const info: string[] = [];

    for (const table of schemas) {
      const dateFields = table.columns.filter(c =>
        c.type.toLowerCase().includes('date') || c.name.includes('日期') || c.name.includes('时间')
      ).map(c => c.name);

      const numericFields = table.columns.filter(c =>
        c.type.toLowerCase().includes('int') || c.type.toLowerCase().includes('decimal') ||
        c.type.toLowerCase().includes('float') || c.type.toLowerCase().includes('number')
      ).map(c => c.name);

      const categoryFields = table.columns.filter(c =>
        c.name.includes('代码') || c.name.includes('类型') || c.name.includes('性别') ||
        c.name.includes('状态') || c.name.includes('分类') || c.type.toLowerCase().includes('char')
      ).map(c => c.name).slice(0, 5);

      info.push(`表 ${table.tableName}: `);
      if (dateFields.length > 0) info.push(`  - 日期字段: ${dateFields.join(', ')}`);
      if (numericFields.length > 0) info.push(`  - 数值字段: ${numericFields.slice(0, 5).join(', ')}`);
      if (categoryFields.length > 0) info.push(`  - 分类字段: ${categoryFields.join(', ')}`);
    }

    return info.join('\n');
  }

  /**
   * 全局视角的智能问题生成（独立 AI 调用）
   * 将所有表的上下文一次性传给 AI，生成有业务价值的问题
   */
  private async generateSmartQuestions(schemas: TableSchema[], analyzedTables: any[]): Promise<string[]> {
    await this.ensureInitialized();

    // 构建精简的全局表结构摘要
    const tableSummaries = analyzedTables.map((t, i) => {
      const schema = schemas[i];
      if (!schema) return '';

      // 按字段类型分类
      const numericFields: string[] = [];
      const categoryFields: string[] = [];
      const dateFields: string[] = [];
      const textFields: string[] = [];

      for (const col of (t.columns || [])) {
        const origCol = schema.columns.find((c: any) => c.name === col.name);
        const typeLower = (origCol?.type || '').toLowerCase();
        const nameLower = col.name.toLowerCase();
        const label = col.nameCn || col.name;

        // 跳过 ID 字段
        if (nameLower.includes('id') && !nameLower.includes('\u8eab\u4efd')) continue;

        if (typeLower.includes('date') || typeLower.includes('time') ||
          nameLower.includes('\u65e5\u671f') || nameLower.includes('\u65f6\u95f4') || nameLower.includes('\u5e74') || nameLower.includes('\u6708')) {
          dateFields.push(label);
        } else if (typeLower.includes('int') || typeLower.includes('decimal') || typeLower.includes('float') || typeLower.includes('double') || typeLower.includes('number')) {
          numericFields.push(label);
        } else if (nameLower.includes('type') || nameLower.includes('status') || nameLower.includes('category') ||
          nameLower.includes('\u7c7b\u578b') || nameLower.includes('\u72b6\u6001') || nameLower.includes('\u5206\u7c7b') ||
          nameLower.includes('\u5730\u533a') || nameLower.includes('\u533a\u57df') || nameLower.includes('\u7701') ||
          nameLower.includes('\u57ce\u5e02') || nameLower.includes('continent') || nameLower.includes('region')) {
          categoryFields.push(label);
        } else if (typeLower.includes('char') || typeLower.includes('text')) {
          textFields.push(label);
        }
      }

      const parts = [`\u8868: ${t.tableNameCn || schema.tableName} (${schema.tableName})`];
      if (numericFields.length > 0) parts.push(`  \u6570\u503c: ${numericFields.slice(0, 8).join('\u3001')}`);
      if (categoryFields.length > 0) parts.push(`  \u5206\u7c7b: ${categoryFields.slice(0, 5).join('\u3001')}`);
      if (dateFields.length > 0) parts.push(`  \u65f6\u95f4: ${dateFields.slice(0, 3).join('\u3001')}`);
      if (textFields.length > 0) parts.push(`  \u6587\u672c: ${textFields.slice(0, 5).join('\u3001')}`);

      // 附加样例数据摘要
      if (schema.sampleData && schema.sampleData.length > 0) {
        parts.push(`  \u6837\u4f8b: ${JSON.stringify(schema.sampleData[0]).slice(0, 200)}`);
      }

      return parts.join('\n');
    }).filter(Boolean).join('\n\n');

    const hasMultipleTables = schemas.length > 1;

    const response = await this.callSchemaAnalysisRequest({
      messages: [
        {
          role: 'system',
          content: `\u4f60\u662f\u4e00\u4f4d\u8d44\u6df1\u6570\u636e\u5206\u6790\u5e08\u3002\u7528\u6237\u521a\u8fde\u63a5\u4e86\u4e00\u4e2a\u6570\u636e\u6e90\uff0c\u4f60\u9700\u8981\u5e2e\u4ed6\u60f3\u51fa 8~10 \u4e2a\u4ed6\u53ef\u80fd\u611f\u5174\u8da3\u7684\u5206\u6790\u95ee\u9898\u3002

**\u8981\u6c42\uff1a**
1. \u95ee\u9898\u8981\u50cf\u6b63\u5e38\u4eba\u804a\u5929\u4e00\u6837\u81ea\u7136\u53e3\u8bed\u5316\uff0c\u4e0d\u8981\u50cf SQL \u7ec3\u4e60\u9898
2. \u95ee\u9898\u8981\u6709\u4e1a\u52a1\u4ef7\u503c\uff0c\u8ba9\u7528\u6237\u4e00\u770b\u5c31\u60f3\u70b9\u51fb
3. \u95ee\u9898\u5fc5\u987b\u57fa\u4e8e\u5b9e\u9645\u7684\u8868\u7ed3\u6784\u548c\u5b57\u6bb5\uff0c\u4e0d\u8981\u51ed\u7a7a\u7f16\u9020\u5b57\u6bb5
4. \u6bcf\u4e2a\u95ee\u9898\u7b80\u77ed\u7cbe\u70bc\uff0c\u4e0d\u8d85\u8fc725\u4e2a\u5b57

**\u95ee\u9898\u5e94\u8986\u76d6\u4ee5\u4e0b\u7ef4\u5ea6\uff08\u6bcf\u7c7b\u81f3\u5c11 1~2 \u4e2a\uff09\uff1a**
- \ud83c\udfc6 \u6392\u540d\u6d1e\u5bdf\uff1a\u8c01\u6700\u9ad8/\u6700\u4f4e/\u6700\u591a\uff1fTop 10 \u662f\u4ec0\u4e48\uff1f
- \ud83d\udd0d \u5206\u5e03\u6982\u51b5\uff1a\u6309\u67d0\u7ef4\u5ea6\u7684\u5206\u5e03\u3001\u5360\u6bd4\u662f\u600e\u6837\u7684\uff1f
- \ud83d\udcc8 \u8d8b\u52bf\u53d8\u5316\uff1a\u968f\u65f6\u95f4\u6709\u4ec0\u4e48\u53d8\u5316\uff1f\uff08\u4ec5\u5728\u6709\u65f6\u95f4\u5b57\u6bb5\u65f6\u751f\u6210\uff09
- \ud83d\udcca \u7edf\u8ba1\u5bf9\u6bd4\uff1a\u4e0d\u540c\u7c7b\u522b\u4e4b\u95f4\u7684\u5dee\u5f02\u3001\u5e73\u5747\u503c\u5bf9\u6bd4
- \ud83d\udca1 \u4e1a\u52a1\u6d1e\u5bdf\uff1a\u6709\u54ea\u4e9b\u5f02\u5e38\u6216\u6709\u8da3\u7684\u89c4\u5f8b\uff1f
${hasMultipleTables ? '- \ud83d\udd17 \u5173\u8054\u5206\u6790\uff1a\u8de8\u8868\u4e4b\u95f4\u6709\u4ec0\u4e48\u5173\u8054\u5173\u7cfb\uff1f' : ''}

**\u53cd\u4f8b\uff08\u4e0d\u8981\u751f\u6210\u8fd9\u7c7b\u95ee\u9898\uff09\uff1a**
- \u274c "\u67d0\u8868\u5171\u6709\u591a\u5c11\u6761\u8bb0\u5f55\uff1f" \u2192 \u592a\u7b80\u5355
- \u274c "\u67e5\u8be2\u7279\u5b9aXX\uff08\u4f8b\u5982\u2018AFG\u2019\uff09\u7684\u6240\u6709\u4fe1\u606f" \u2192 \u592a\u50cf SQL \u7ec3\u4e60
- \u274c "\u5217\u51fa\u6240\u6709XX\uff0c\u5e76\u6309\u5b57\u6bcd\u6392\u5e8f" \u2192 \u65e0\u5206\u6790\u4ef7\u503c
- \u274c "\u7edf\u8ba1\u6bcf\u4e2aXX\u8bb0\u5f55\u7684XX\u6570\u91cf\uff0c\u5e76\u627e\u51faXX\u6700\u591a\u7684" \u2192 \u592a\u7570\u55e6

**\u6b63\u4f8b\uff08\u751f\u6210\u8fd9\u7c7b\u95ee\u9898\uff09\uff1a**
- \u2705 "\u54ea\u4e2a\u5730\u533a\u7684\u9500\u552e\u989d\u6700\u9ad8\uff1f"
- \u2705 "\u6700\u8fd1\u534a\u5e74\u7684\u8ba2\u5355\u589e\u957f\u8d8b\u52bf\u5982\u4f55\uff1f"
- \u2705 "\u5404\u90e8\u95e8\u7684\u4eba\u5458\u5206\u5e03\u60c5\u51b5"
- \u2705 "\u5e73\u5747\u5ba2\u5355\u4ef7\u6700\u9ad8\u7684\u4ea7\u54c1\u7c7b\u578b"
- \u2705 "\u8d85\u8fc7100\u4e07\u4eba\u53e3\u7684\u57ce\u5e02\u6709\u591a\u5c11\uff1f"

\u8fd4\u56de JSON \u683c\u5f0f\uff1a{ "questions": ["\u95ee\u98981", "\u95ee\u98982", ...] }`
        },
        {
          role: 'user',
          content: `\u6570\u636e\u6e90\u7ed3\u6784\u5982\u4e0b\uff1a\n\n${tableSummaries}`
        }
      ],
      temperature: 0.5,
      maxTokens: 800,
    }) as any;

    const content = response.choices[0].message.content || '{}';
    console.log('AI 问题生成原始返回:', content.slice(0, 300));
    try {
      const parsed = JSON.parse(content);
      const questions = parsed.questions || [];
      return questions.sort(() => Math.random() - 0.5).slice(0, 15);
    } catch (e) {
      console.warn('JSON 解析失败，尝试正则提取:', e instanceof Error ? e.message : String(e));
      // 备用：用正则提取引号内的中文问题
      const matches = content.match(/"([^"]*[\u4e00-\u9fa5][^"]*?)"/g);
      if (matches && matches.length >= 3) {
        const extracted = matches
          .map((m: string) => m.replace(/^"|"$/g, '').trim())
          .filter((q: string) => q.length >= 5 && q.length <= 30 && /[\u4e00-\u9fa5]/.test(q));
        console.log(`正则提取到 ${extracted.length} 个问题:`, extracted.slice(0, 3));
        if (extracted.length >= 3) {
          return extracted.sort(() => Math.random() - 0.5).slice(0, 15);
        }
      }
      return [];
    }
  }

  /**
   * \u57fa\u4e8e\u89c4\u5219\u7684\u63a8\u8350\u95ee\u9898\u56de\u9000\u903b\u8f91\uff08AI \u8c03\u7528\u5931\u8d25\u65f6\u4f7f\u7528\uff09
   * \u6839\u636e\u5b57\u6bb5\u8bed\u4e49\u751f\u6210\u66f4\u81ea\u7136\u7684\u95ee\u9898
   */
  private generateChineseQuestions(schemas: TableSchema[], analyzedTables: any[]): string[] {
    const questions: string[] = [];

    for (let i = 0; i < schemas.length; i++) {
      const table = schemas[i];
      const analyzed = analyzedTables[i];
      const tableCn = analyzed?.tableNameCn || this.guessTableNameCn(table.tableName);

      // \u83b7\u53d6\u5b57\u6bb5\u4e2d\u6587\u540d\u7684\u8f85\u52a9\u51fd\u6570
      const getFieldCn = (fieldName: string) => {
        return analyzed?.columns?.find((c: any) => c.name === fieldName)?.nameCn || fieldName;
      };

      // \u5206\u7c7b\u8bc6\u522b\u5b57\u6bb5
      const numericFields: { name: string; cn: string }[] = [];
      const categoryFields: { name: string; cn: string }[] = [];
      const dateFields: { name: string; cn: string }[] = [];

      for (const col of table.columns) {
        const name = col.name.toLowerCase();
        const type = col.type.toLowerCase();
        // 跳过 ID 和外键字段
        if (name.includes('id') && !name.includes('身份')) continue;

        const cn = getFieldCn(col.name);
        // 跳过中文名包含 'ID' 的字段（如“首都城市ID”）
        if (cn.toUpperCase().includes('ID')) continue;

        if (type.includes('date') || type.includes('time') ||
          name.includes('日期') || name.includes('时间') || name.includes('年') || name.includes('月')) {
          dateFields.push({ name: col.name, cn });
        } else if (type.includes('int') || type.includes('decimal') || type.includes('float') || type.includes('number')) {
          if (!name.includes('code') && !name.includes('代码') && !name.includes('capital')) {
            numericFields.push({ name: col.name, cn });
          }
        } else if (name.includes('type') || name.includes('status') || name.includes('category') ||
          name.includes('类型') || name.includes('状态') || name.includes('分类') ||
          name.includes('地区') || name.includes('区域') || name.includes('province') ||
          name.includes('region') || name.includes('continent')) {
          categoryFields.push({ name: col.name, cn });
        }
      }

      // 去掉表名中的“信息表”后缀，让问题更自然
      const shortName = tableCn.replace(/信息表$|表$/, '') || tableCn;

      // 排名类问题
      if (numericFields.length > 0) {
        questions.push(`${numericFields[0].cn}最高的${shortName}有哪些？`);
        questions.push(`${shortName}的平均${numericFields[0].cn}是多少？`);
      }
      if (numericFields.length > 1) {
        questions.push(`${shortName}中${numericFields[1].cn}的整体分布情况`);
        questions.push(`${numericFields[1].cn}最低的${shortName}是哪些？`);
      }

      // 分布类问题
      if (categoryFields.length > 0) {
        questions.push(`不同${categoryFields[0].cn}的${shortName}各有多少？`);
      }
      if (categoryFields.length > 1 && numericFields.length > 0) {
        questions.push(`各${categoryFields[0].cn}的${numericFields[0].cn}对比`);
      }
      if (categoryFields.length > 0 && numericFields.length > 0) {
        questions.push(`哪个${categoryFields[0].cn}的${numericFields[0].cn}最高？`);
      }

      // 趋势类问题
      if (dateFields.length > 0 && numericFields.length > 0) {
        questions.push(`${numericFields[0].cn}随时间的变化趋势`);
      }
      if (dateFields.length > 0) {
        questions.push(`${shortName}在不同时间段的数量变化`);
      }

      // 综合洞察
      if (numericFields.length >= 2) {
        questions.push(`${numericFields[0].cn}和${numericFields[1].cn}之间有什么关系？`);
      }
      // 筛选类问题
      if (numericFields.length > 0) {
        questions.push(`${numericFields[0].cn}超过平均值的${shortName}有多少？`);
      }
    }

    // 多表关联
    if (schemas.length > 1) {
      const t1 = (analyzedTables[0]?.tableNameCn || schemas[0].tableName).replace(/信息表$|表$/, '');
      const t2 = (analyzedTables[1]?.tableNameCn || schemas[1].tableName).replace(/信息表$|表$/, '');
      questions.push(`${t1}和${t2}之间的关联分析`);
      if (schemas.length > 2) {
        const t3 = (analyzedTables[2]?.tableNameCn || schemas[2].tableName).replace(/信息表$|表$/, '');
        questions.push(`${t1}、${t2}和${t3}的数据概览`);
      }
    }

    return Array.from(new Set(questions)).sort(() => Math.random() - 0.5).slice(0, 15);
  }

  // 猜测表的中文名
  private guessTableNameCn(tableName: string): string {
    const map: Record<string, string> = {
      'death_cert_data': '死亡证明数据',
      'cremation_data': '火化数据',
      'country': '国家',
      'city': '城市',
      'user': '用户',
      'order': '订单',
      'countrylanguage': '国家语言',
    };
    return map[tableName.toLowerCase()] || tableName;
  }
}


// 导出
export { skillsRegistry, mcpRegistry };
export * from './skills';
export * from './mcp';
export * from './analyst';
export * from './dashboard';
