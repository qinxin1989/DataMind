import OpenAI from 'openai';
import { TableSchema, AIResponse } from '../types';
import { BaseDataSource } from '../datasource';
import { ChatMessage } from '../store/configStore';
import { skillsRegistry, SkillContext } from './skills';
import { mcpRegistry } from './mcp';
import { AutoAnalyst, AnalysisReport } from './analyst';
import { DashboardGenerator, DashboardResult } from './dashboard';
import { SlideContent } from './skills/report/pptGenerator';
import { QualityInspector, QualityReport } from './qualityInspector';

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
  private configGetter?: AIConfigGetter;
  private allConfigs: AIConfigItem[] = [];
  private currentConfigIndex = 0;
  private initialized = false;
  private lastRequestTokens = 0;  // 上次请求的 token 使用量

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
  }

  // 使用配置初始化
  private initWithConfig(config: AIConfigItem) {
    // 支持 API Key 为空的情况
    const openaiConfig: any = {
      baseURL: config.baseURL,
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

  // 确保已初始化（从数据库获取配置）
  private async ensureInitialized(): Promise<void> {
    if (this.initialized && this.openai) return;

    if (this.configGetter) {
      this.allConfigs = await this.configGetter();
      if (!this.allConfigs || this.allConfigs.length === 0) {
        throw new Error('没有可用的 AI 配置，请在管理后台配置 AI 服务');
      }
      this.currentConfigIndex = 0;
      this.initWithConfig(this.allConfigs[0]);
    } else {
      throw new Error('AI Agent 未配置');
    }
  }

  // 带自动重试的 OpenAI 调用
  private async callWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await fn();
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

  // 格式化schema
  private formatSchemaForAI(schemas: TableSchema[]): string {
    return schemas.map(table => {
      const cols = table.columns.map(c =>
        `  - ${c.name} (${c.type}${c.isPrimaryKey ? ', PK' : ''}${c.comment ? `, ${c.comment}` : ''})`
      ).join('\n');
      return `表名: ${table.tableName}\n字段:\n${cols}`;
    }).join('\n\n');
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
  private buildContextMessages(history: ChatMessage[]): { role: 'user' | 'assistant'; content: string }[] {
    const recentHistory = history.slice(-4); // 只保留最近4条，节省 token
    return recentHistory.map(msg => ({
      role: msg.role,
      content: msg.content.slice(0, 200) // 限制每条消息长度
    }));
  }

  // 使用 AI 来规划文件数据源的查询 - 支持多表JOIN
  private async planFileQuery(
    question: string,
    schemas: TableSchema[],
    history: ChatMessage[]
  ): Promise<{ sql: string; chartType?: string; explanation?: string }> {
    await this.ensureInitialized();

    // 结构化 schema：精简格式，包含所有表
    const schemaCompact = schemas.map(t => {
      const cols = t.columns.slice(0, 15).map(c => c.name).join(',');
      return `${t.tableName}:${cols}`;
    }).join('\n');

    // 分析可能的关联字段
    const tableNames = schemas.map(s => s.tableName);
    const allColumns = schemas.flatMap(s => s.columns.map(c => ({ table: s.tableName, col: c.name })));

    // 查找可能的关联字段（相同名称的字段）
    const potentialJoinFields: string[] = [];
    const colNameCount = new Map<string, string[]>();
    for (const { table, col } of allColumns) {
      const key = col.toLowerCase();
      if (!colNameCount.has(key)) colNameCount.set(key, []);
      colNameCount.get(key)!.push(table);
    }
    for (const [col, tables] of colNameCount) {
      if (tables.length > 1) {
        potentialJoinFields.push(`${col} 字段在 ${tables.join(', ')} 表中都存在，可用于JOIN`);
      }
    }

    const joinHint = potentialJoinFields.length > 0
      ? `\n可能的关联字段:\n${potentialJoinFields.slice(0, 5).join('\n')}`
      : '';

    const response = await this.callWithRetry(() => this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `SQL生成器（文件数据源）。返回JSON:{"sql":"SELECT...","chartType":"bar|line|pie|none"}

**重要规则**:
1. 数据源包含 ${tableNames.length} 个表: ${tableNames.join(', ')}
2. 如果问题涉及多个表的数据，必须使用 JOIN 关联查询
3. JOIN语法: SELECT ... FROM 表1 JOIN 表2 ON 表1.字段 = 表2.字段
4. 支持 INNER JOIN, LEFT JOIN, RIGHT JOIN
5. 聚合查询按值DESC排序，LIMIT 20
6. 地址字段用SUBSTR提取省份
${joinHint}

表结构:
${schemaCompact}`
        },
        { role: 'user', content: question }
      ],
      temperature: 0.1,
    }));

    const content = response.choices[0].message.content || '{}';
    console.log('AI file query plan:', content);

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse AI query plan:', e);
    }

    // 默认返回统计总数
    return { sql: `SELECT COUNT(*) as total FROM ${schemas[0]?.tableName || 'data'}`, chartType: 'none' };
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
      const schemaDesc = schemas.slice(0, 3).map(t => {
        const cols = t.columns.slice(0, 10).map(c => `${c.name}(${c.type.split('(')[0]})`).join(',');
        return `${t.tableName}: ${cols}`;
      }).join('\n');

      // 1. 构建提示词
      const prompt = `你是 AI 数据助手。请根据用户问题选择最合适的工具、图表类型和图表配置。

可选工具:
- sql: 查询具体数据 (如: "查询用户表", "统计销售额", "画个图", "Top 10")
- data.analyze: 深度分析/总结/洞察 (如: "分析这个数据源", "给出业务总结")
- chitchat: 闲聊/问候 (如: "你好", "谢谢")

可选图表类型:
- bar: 柱状图 (适合分类对比、排名)
- line: 折线图 (适合趋势、时间序列)
- pie: 饼图 (适合占比、构成分析，数据项<10个)
- area: 面积图 (适合趋势+累计)
- scatter: 散点图 (适合相关性分析)
- none: 不需要图表 (简单数值查询)

数据表结构:
${schemaDesc}

用户问题: ${question}

返回JSON格式: 
{
  "tool": "sql" | "data.analyze" | "chitchat", 
  "reason": "原因",
  "chartType": "bar" | "line" | "pie" | "area" | "scatter" | "none",
  "chartTitle": "简短的图表标题，例如'各国GNP排名'",
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
      }));

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
          valueField: numericField || 'COUNT(*)'
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

  // 生成SQL - 精简版，结构化提示词
  private async generateSQL(
    question: string,
    schemas: TableSchema[],
    dbType: string,
    history: ChatMessage[]
  ): Promise<string> {
    await this.ensureInitialized();

    // 结构化 schema：表名→字段列表（精简格式）
    const schemaCompact = schemas.map(t => {
      const cols = t.columns.slice(0, 15).map(c => `${c.name}:${c.type.split('(')[0]}`).join(',');
      return `${t.tableName}(${cols})`;
    }).join('\n');

    // 只传递增量上下文（最近2轮的关键信息）
    const recentContext = history.slice(-2).map(m => m.content.slice(0, 100)).join(';');

    const response = await this.callWithRetry(() => this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `SQL生成器(${dbType})。只返回SQL，无解释。
规则:SELECT only,LIMIT 20,聚合按值DESC排序
表结构:
${schemaCompact}`
        },
        { role: 'user', content: recentContext ? `上文:${recentContext}\n问:${question}` : question }
      ],
      temperature: 0,
    }));

    const sql = response.choices[0].message.content?.trim() || '';
    return cleanSQL(sql);
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
    errorReason: string
  ): Promise<string> {
    await this.ensureInitialized();

    const schemaCompact = schemas.map(t => t.tableName + ':' + t.columns.slice(0, 10).map(c => c.name).join(',')).join('\n');

    const response = await this.callWithRetry(() => this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `SQL修正器(${dbType})。只返回正确SQL。
表:${schemaCompact}
错误SQL:${previousSql}
原因:${errorReason}`
        },
        { role: 'user', content: question }
      ],
      temperature: 0,
    }));

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

  private async explainResult(
    question: string,
    result: any,
    history: ChatMessage[]
  ): Promise<string> {
    await this.ensureInitialized();

    // 如果结果为空或没有数据
    if (!result || (Array.isArray(result) && result.length === 0)) {
      console.log('explainResult: No data in result');
      return '数据库中没有相关数据';
    }

    // 限制结果大小，避免 token 过多
    const limitedResult = Array.isArray(result) ? result.slice(0, 10) : result;
    const resultStr = JSON.stringify(limitedResult);

    console.log('explainResult: Calling AI to explain result...');
    console.log('explainResult: Result data:', resultStr.substring(0, 200));

    try {
      const response = await this.callWithRetry(() => this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `数据分析助手。用中文简洁回答，大数用中国习惯单位（万、亿、万亿），如8510700百万美元应说8.5万亿美元，英文地名翻译成中文。不要输出思考过程，直接给出结论。`
          },
          {
            role: 'user',
            content: `问题:${question}\n结果:${resultStr}`
          }
        ],
        temperature: 0.3,
      }));

      const explanation = response.choices[0].message.content || '无法解读结果';
      console.log('explainResult: AI explanation:', explanation);
      return explanation;
    } catch (error: any) {
      console.error('explainResult: AI call failed:', error.message);
      // 如果AI调用失败，返回原始数据的简单描述
      if (Array.isArray(result) && result.length > 0) {
        return `查询成功，共返回 ${result.length} 条数据。`;
      }
      return '查询成功，但无法生成详细说明。';
    }
  }

  // 主入口：智能问答
  async answer(
    question: string,
    dataSource: BaseDataSource,
    dbType: string,
    history: ChatMessage[] = []
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
        const report = await this.analyst.analyze(question, dataSource, dbType);

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
        const charts = report.charts?.map(c => ({
          type: c.type,
          title: c.title,
          data: c.data,
          config: {
            labelField: c.labelField,
            valueField: c.valueField,
            xField: c.labelField,
            yField: c.valueField
          }
        })) || [];

        return {
          answer,
          skillUsed: 'comprehensive_analysis',
          charts,  // 返回多个图表
          tokensUsed: this.lastRequestTokens,
          modelName: this.model
        };
      }

      let result: any;
      let sql: string | undefined;
      let skillUsed: string | undefined;
      let toolUsed: string | undefined;
      let chart: ChartData | undefined;

      // 对于文件类型，使用 AI 来规划查询
      if (dbType === 'file') {
        console.log('=== Using AI planning for file datasource');
        const queryPlan = await this.planFileQuery(question, schemas, history);
        const internalSql = queryPlan.sql;
        console.log('AI generated query:', internalSql);

        // 执行查询
        const queryResult = await dataSource.executeQuery(internalSql);
        console.log('Query result:', queryResult.success, 'rows:', queryResult.rowCount);

        if (!queryResult.success) {
          return { answer: `查询失败: ${queryResult.error}`, tokensUsed: this.lastRequestTokens, modelName: this.model };
        }

        result = queryResult.data;

        // 生成图表（至少2条数据才有意义）
        if (queryPlan.chartType && queryPlan.chartType !== 'none' && result && result.length > 1) {
          chart = this.generateChartData(result, queryPlan.chartType as any, question);
          console.log('Generated chart:', chart ? 'yes' : 'no', 'data rows:', result.length);
        }

        // 解读结果
        const explanation = await this.explainResult(question, result, history);

        // 文件类型不返回 SQL
        return {
          answer: explanation,
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
        plan = await this.planAction(question, schemas, dbType, history);
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
        sql = await this.generateSQL(question, schemas, dbType, history);
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
          sql = await this.regenerateSQL(question, schemas, dbType, history, sql, validation.reason);
          console.log('Corrected SQL:', sql);

          // 转义保留字
          const escapedCorrectedSql = escapeReservedWords(sql, dbType);
          const retryResult = await dataSource.executeQuery(escapedCorrectedSql);
          if (retryResult.success) {
            result = retryResult.data;
          }
        }

        // 根据结果生成图表
        if (result && result.length > 1) {
          chart = this.generateChartData(result, 'bar', question);
        }
      }

      if (plan.type === 'skill') {
        const skill = skillsRegistry.get(plan.name);
        console.log('Looking for skill:', plan.name, 'found:', !!skill);

        if (skill) {
          console.log('Executing skill:', plan.name, 'params:', JSON.stringify(plan.params));
          const ctx: SkillContext = { dataSource, schemas, dbType };

          try {
            const skillResult = await skill.execute(plan.params, ctx);
            console.log('Skill result success:', skillResult.success);
            result = skillResult.data;
            skillUsed = plan.name;

            // 如果技能返回了可视化配置，生成图表
            if (skillResult.visualization) {
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
          } catch (skillError: any) {
            console.error('Skill execution error:', skillError);
            return { answer: `技能执行出错: ${skillError.message}`, skillUsed: plan.name, tokensUsed: this.lastRequestTokens, modelName: this.model };
          }
        } else {
          // 技能不存在，回退到简单SQL
          console.log('Skill not found, falling back to SQL');
          sql = await this.generateSQL(question, schemas, dbType, history);
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

      // 3. 生成图表（如果技能没有生成且需要图表）
      if (!chart && plan.needChart && Array.isArray(result) && result.length > 1) {
        chart = this.generateChartData(result, plan.chartType || 'bar', plan.chartTitle || question);
      }

      // 4. 解读结果
      const explanation = await this.explainResult(question, result, history);

      return {
        answer: prefixNote + explanation,
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

  // 带上下文的智能问答（优化版，减少 token 使用）
  async answerWithContext(
    question: string,
    dataSource: BaseDataSource,
    dbType: string,
    history: ChatMessage[] = [],
    context?: {
      schemaContext?: string;  // 预处理的 schema 上下文（中文名称）
      ragContext?: string;     // RAG 知识库上下文
    }
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

      // 检测是否需要综合分析
      const hasAnalysisKeyword = q.includes('分析');
      const hasComprehensiveKeyword =
        q.includes('整体') || q.includes('全面') || q.includes('综合') ||
        q.includes('深入') || q.includes('详细') || q.includes('完整') ||
        q.includes('所有') || q.includes('全部');
      const needComprehensiveAnalysis = hasAnalysisKeyword && hasComprehensiveKeyword;

      if (needComprehensiveAnalysis) {
        // 综合分析使用原有逻辑
        return this.answer(question, dataSource, dbType, history);
      }

      let result: any;
      let sql: string | undefined;
      let skillUsed: string | undefined;
      let chart: ChartData | undefined;

      // 使用优化的 schema 上下文（如果提供）
      const schemaForAI = context?.schemaContext || this.formatSchemaForAI(schemas);

      // 构建增强的系统提示（包含 RAG 上下文）
      let systemPromptAddition = '';
      if (context?.ragContext) {
        systemPromptAddition = `\n\n相关知识背景:\n${context.ragContext.slice(0, 500)}`;
        console.log('=== Using RAG context, length:', context.ragContext.length);
      }

      // 对于文件类型，使用 AI 来规划查询
      if (dbType === 'file') {
        console.log('=== Using AI planning for file datasource (with context)');
        const queryPlan = await this.planFileQueryWithContext(question, schemas, history, schemaForAI, systemPromptAddition);
        const internalSql = queryPlan.sql;
        console.log('AI generated query:', internalSql);

        const queryResult = await dataSource.executeQuery(internalSql);
        console.log('Query result:', queryResult.success, 'rows:', queryResult.rowCount);

        if (!queryResult.success) {
          return { answer: `查询失败: ${queryResult.error}`, tokensUsed: this.lastRequestTokens, modelName: this.model };
        }

        result = queryResult.data;

        if (queryPlan.chartType && queryPlan.chartType !== 'none' && result && result.length > 1) {
          chart = this.generateChartData(result, queryPlan.chartType as any, question);
        }

        const explanation = await this.explainResultWithContext(question, result, history, context?.ragContext);

        return {
          answer: explanation,
          data: result,
          chart,
          tokensUsed: this.lastRequestTokens,
          modelName: this.model
        };
      }

      // 数据库类型：使用优化的 SQL 生成
      console.log('=== Using optimized SQL generation with context');
      sql = await this.generateSQLWithContext(question, schemas, dbType, history, schemaForAI, systemPromptAddition);
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

      // 根据结果生成图表
      if (result && result.length > 1) {
        chart = this.generateChartData(result, 'bar', question);
      }

      // 解读结果（带 RAG 上下文）
      const explanation = await this.explainResultWithContext(question, result, history, context?.ragContext);

      return {
        answer: explanation,
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

  // 带上下文的文件查询规划
  private async planFileQueryWithContext(
    question: string,
    schemas: TableSchema[],
    history: ChatMessage[],
    schemaContext: string,
    additionalContext: string
  ): Promise<{ sql: string; chartType?: string }> {
    await this.ensureInitialized();

    const response = await this.callWithRetry(() => this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `SQL生成器（文件数据源）。返回JSON:{"sql":"SELECT...","chartType":"bar|line|pie|none"}
规则:聚合查询按值DESC排序，LIMIT 20
表结构:
${schemaContext}${additionalContext}`
        },
        { role: 'user', content: question }
      ],
      temperature: 0.1,
    }));

    const content = response.choices[0].message.content || '{}';
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse AI query plan:', e);
    }

    return { sql: `SELECT COUNT(*) as total FROM ${schemas[0]?.tableName || 'data'}`, chartType: 'none' };
  }

  // 带上下文的 SQL 生成
  private async generateSQLWithContext(
    question: string,
    schemas: TableSchema[],
    dbType: string,
    history: ChatMessage[],
    schemaContext: string,
    additionalContext: string
  ): Promise<string> {
    await this.ensureInitialized();

    const recentContext = history.slice(-2).map(m => m.content.slice(0, 100)).join(';');

    const response = await this.callWithRetry(() => this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `SQL生成器(${dbType})。只返回SQL，无解释。
规则:SELECT only,LIMIT 20,聚合按值DESC排序
表结构:
${schemaContext}${additionalContext}`
        },
        { role: 'user', content: recentContext ? `上文:${recentContext}\n问:${question}` : question }
      ],
      temperature: 0,
    }));

    const sql = response.choices[0].message.content?.trim() || '';
    return cleanSQL(sql);
  }

  // 带上下文的结果解读
  private async explainResultWithContext(
    question: string,
    result: any,
    history: ChatMessage[],
    ragContext?: string
  ): Promise<string> {
    await this.ensureInitialized();

    if (!result || (Array.isArray(result) && result.length === 0)) {
      return '数据库中没有相关数据';
    }

    const limitedResult = Array.isArray(result) ? result.slice(0, 10) : result;
    const resultStr = JSON.stringify(limitedResult);

    let systemPrompt = `数据分析助手。用中文简洁回答，大数用中国习惯单位（万、亿、万亿），如8510700百万美元应说8.5万亿美元，英文地名翻译成中文。不要输出思考过程，直接给出结论。`;
    if (ragContext) {
      systemPrompt += `\n\n参考知识:\n${ragContext.slice(0, 300)}`;
    }

    try {
      const response = await this.callWithRetry(() => this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `问题:${question}\n结果:${resultStr}` }
        ],
        temperature: 0.3,
      }));

      return response.choices[0].message.content || '无法解读结果';
    } catch (error: any) {
      console.error('explainResultWithContext: AI call failed:', error.message);
      if (Array.isArray(result) && result.length > 0) {
        return `查询成功，共返回 ${result.length} 条数据。`;
      }
      return '查询成功，但无法生成详细说明。';
    }
  }

  // 生成图表数据
  private generateChartData(data: any[], chartType: 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'none', title: string): ChartData | undefined {
    if (!data || data.length === 0 || chartType === 'none') return undefined;

    const keys = Object.keys(data[0]);
    if (keys.length < 2) return undefined;

    let xField = keys[0];
    let yField = keys[1];

    // 扫描前5行以确定字段类型
    const sampleRows = data.slice(0, 5);

    // 找数值字段作为y轴
    for (const key of keys) {
      // 检查该字段在样本中是否大部分为数字
      const isNumeric = sampleRows.every(row => {
        const val = row[key];
        return val === null || typeof val === 'number' || (!isNaN(Number(val)) && typeof val !== 'boolean' && String(val).trim() !== '');
      });

      if (isNumeric) {
        // 还要确认不是所有都是空的
        const hasValue = sampleRows.some(row => row[key] !== null && row[key] !== undefined && String(row[key]).trim() !== '');
        if (hasValue) {
          yField = key;
          break;
        }
      }
    }

    // 如果没找到数值字段，尝试使用最后一列（通常是聚合结果）
    if (!yField && keys.length > 0) {
      yField = keys[keys.length - 1];
    }

    // 找非数值字段作为x轴
    for (const key of keys) {
      if (key !== yField) {
        xField = key;
        break;
      }
    }

    // 自动优化标题：如果标题包含疑问词或太长，尝试使用字段名生成标题
    let finalTitle = title;
    const isQuestion = /[?？吗什么怎么如何]/.test(title);
    if (isQuestion || title.length > 10) {
      if (xField && yField) {
        // 尝试移除字段名中的聚合函数包装
        const cleanY = yField.replace(/^(sum|count|avg|max|min)\((.*)\)$/i, '$2').trim() || yField;

        if (yField.toLowerCase().includes('count') || yField === 'total' || yField === 'count') {
          finalTitle = `${xField} 分布统计`;
        } else {
          finalTitle = `${xField} - ${cleanY} 统计`;
        }
      }
    }

    // 按数值字段降序排序（除了折线图保持原顺序用于时间趋势）
    let sortedData = [...data];
    if (chartType !== 'line') {
      sortedData = sortedData.sort((a, b) => {
        const aVal = Number(a[yField]) || 0;
        const bVal = Number(b[yField]) || 0;
        return bVal - aVal; // 降序
      });
    }

    // 如果数据超过显示限制，合并剩余数据为"其他"
    const maxItems = chartType === 'pie' ? 8 : 15; // 饼图最多8项，其他图表最多15项
    let chartData = sortedData;

    if (sortedData.length > maxItems) {
      const topItems = sortedData.slice(0, maxItems - 1);
      const otherItems = sortedData.slice(maxItems - 1);

      // 判断是否是平均值类的数据（通过字段名或标题判断）
      const isAverage = yField.toLowerCase().includes('avg') ||
        title.includes('平均') ||
        title.includes('均值');

      let otherValue: number;
      if (isAverage) {
        // 平均值类：计算其他项的平均值
        otherValue = otherItems.reduce((sum, item) => sum + (Number(item[yField]) || 0), 0) / otherItems.length;
      } else {
        // 计数/求和类：计算其他项的总和
        otherValue = otherItems.reduce((sum, item) => sum + (Number(item[yField]) || 0), 0);
      }

      // 创建"其他"项
      const otherItem: any = {};
      otherItem[xField] = `其他(${otherItems.length}项)`;
      otherItem[yField] = isAverage ? Number(otherValue.toFixed(1)) : otherValue;

      chartData = [...topItems, otherItem];
    }

    return {
      type: chartType as 'bar' | 'line' | 'pie' | 'area' | 'scatter',
      title: finalTitle.slice(0, 30),
      data: chartData,
      config: { xField, yField, labelField: xField, valueField: yField }
    };
  }

  // Schema分析 - 精简版
  async analyzeSchema(schemas: TableSchema[]): Promise<{
    tables: { tableName: string; tableNameCn: string; columns: { name: string; type: string; nameCn: string; description: string }[] }[];
    suggestedQuestions: string[];
  }> {
    await this.ensureInitialized();

    // 精简 schema：只传表名和关键字段
    const schemaCompact = schemas.map(t => {
      const cols = t.columns.slice(0, 8).map(c => c.name).join(',');
      return `${t.tableName}:${cols}`;
    }).join('\n');

    console.log('Analyzing schema for tables:', schemas.map(s => s.tableName).join(','));

    const response = await this.callWithRetry(() => this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `分析数据表，返回JSON:{"tables":[{"tableName":"原名","tableNameCn":"中文名","columns":[{"name":"字段","nameCn":"中文"}]}],"suggestedQuestions":["问题1",...]}
要求:问题用中文描述(10个),涵盖统计/分布/排名/趋势
表:
${schemaCompact}`
        },
        { role: 'user', content: '分析' }
      ],
      temperature: 0.5,
    }));

    const content = response.choices[0].message.content || '{}';
    console.log('AI analysis response length:', content.length);
    console.log('AI analysis response preview:', content.substring(0, 500));

    try {
      let jsonStr = content.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      console.log('Parsing JSON, length:', jsonStr.length);
      const result = JSON.parse(jsonStr);
      console.log('JSON parsed successfully, tables:', result.tables?.length, 'questions:', result.suggestedQuestions?.length);

      // 如果AI生成的问题不够，用中文名称补充
      if (!result.suggestedQuestions || result.suggestedQuestions.length < 5) {
        const tableNamesCn = result.tables?.map((t: any) => t.tableNameCn || t.tableName) || [];
        result.suggestedQuestions = this.generateChineseQuestions(schemas, result.tables || []);
      }

      // 随机打乱
      if (result.suggestedQuestions?.length > 0) {
        result.suggestedQuestions = result.suggestedQuestions.sort(() => Math.random() - 0.5);
      }

      return result;
    } catch (e: any) {
      console.error('Failed to parse AI analysis response:', e.message);
      console.error('Content that failed to parse:', content.substring(0, 1000));
      return { tables: [], suggestedQuestions: [] };
    }
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

      info.push(`表 ${table.tableName}:`);
      if (dateFields.length > 0) info.push(`  - 日期字段: ${dateFields.join(', ')}`);
      if (numericFields.length > 0) info.push(`  - 数值字段: ${numericFields.slice(0, 5).join(', ')}`);
      if (categoryFields.length > 0) info.push(`  - 分类字段: ${categoryFields.join(', ')}`);
    }

    return info.join('\n');
  }

  // 基于中文名称生成问题
  private generateChineseQuestions(schemas: TableSchema[], analyzedTables: any[]): string[] {
    const questions: string[] = [];

    for (let i = 0; i < schemas.length; i++) {
      const table = schemas[i];
      const analyzed = analyzedTables[i];
      const tableCn = analyzed?.tableNameCn || this.guessTableNameCn(table.tableName);

      // 基础统计
      questions.push(`${tableCn}共有多少条记录？`);

      // 找分类字段并生成中文问题
      const categoryFields = table.columns.filter(c =>
        c.name.includes('代码') || c.name.includes('类型') || c.name.includes('性别') || c.name.includes('状态')
      );

      for (const field of categoryFields.slice(0, 2)) {
        const fieldCn = analyzed?.columns?.find((c: any) => c.name === field.name)?.nameCn || field.name;
        questions.push(`按${fieldCn}统计${tableCn}的分布情况`);
      }

      // 日期字段
      const dateFields = table.columns.filter(c =>
        c.type.toLowerCase().includes('date') || c.name.includes('日期')
      );
      if (dateFields.length > 0) {
        questions.push(`按月份统计${tableCn}的时间趋势`);
      }

      // 数值字段
      const numericFields = table.columns.filter(c => c.name.includes('年龄') || c.name.includes('金额'));
      if (numericFields.length > 0) {
        const fieldCn = analyzed?.columns?.find((c: any) => c.name === numericFields[0].name)?.nameCn || numericFields[0].name;
        questions.push(`${tableCn}中${fieldCn}的统计情况（最大、最小、平均）`);
      }
    }

    // 综合分析
    const allTablesCn = analyzedTables.map(t => t?.tableNameCn).filter(Boolean).join('和') || '数据';
    questions.push(`对${allTablesCn}进行全面分析`);

    return questions.slice(0, 15);
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
