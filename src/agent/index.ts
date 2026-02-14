import OpenAI from 'openai';
import { TableSchema, AIResponse } from '../types';
import { BaseDataSource } from '../datasource';
import { ChatMessage } from '../store/configStore';
import { skillsRegistry, SkillContext } from './skills';
import { mcpRegistry } from './mcp';
import { AutoAnalyst, AnalysisReport } from './analyst';
import axios from 'axios';
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
  private configGetter?: AIConfigGetter;
  private allConfigs: AIConfigItem[] = [];
  private currentConfigIndex = 0;
  private initialized = false;
  private lastRequestTokens = 0;  // 上次请求的 token 使用量

  // 静态版本控制，用于全局刷新
  public static globalConfigVersion = 0;
  private localConfigVersion = -1;

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
      timeout: 60000, // 60秒超时
      maxRetries: 2,  // 最多重试2次
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
    // 检查全局版本是否已更新
    if (this.localConfigVersion < AIAgent.globalConfigVersion) {
      console.log(`>>> AIAgent: 检测到全局配置更新 (v${this.localConfigVersion} -> v${AIAgent.globalConfigVersion})，正在刷新...`);
      this.initialized = false;
    }

    if (this.initialized && this.openai) return;

    if (this.configGetter) {
      this.allConfigs = await this.configGetter();
      if (!this.allConfigs || this.allConfigs.length === 0) {
        throw new Error('没有可用的 AI 配置，请在管理后台配置 AI 服务');
      }
      this.currentConfigIndex = 0;
      this.initWithConfig(this.allConfigs[0]);
      this.localConfigVersion = AIAgent.globalConfigVersion;
    } else {
      // 静态初始化的情况下，也更新版本号以避免重复进入
      this.localConfigVersion = AIAgent.globalConfigVersion;
      if (this.initialized && this.openai) return;
      throw new Error('AI Agent 未配置');
    }
  }

  // 手动重置状态
  public reset() {
    this.initialized = false;
    this.localConfigVersion = -1;
  }

  // 带自动重试的 OpenAI 调用
  private async callWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // 关键修复：如果 openai 实例丢失，强制重新初始化
        if (!this.openai) {
          console.warn(`>>> AIAgent: openai 实例未定义，尝试执行 ensureInitialized...`);
          await this.ensureInitialized();
        }

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

  // 获取 analyst 实例
  getAnalyst(): AutoAnalyst {
    if (!this.analyst) {
      throw new Error('AutoAnalyst not initialized');
    }
    return this.analyst;
  }

  // 格式化schema
  private formatSchemaForAI(schemas: TableSchema[]): string {
    return schemas.map(table => {
      const cols = table.columns.map(c =>
        `  - ${c.name} (${c.type}${c.isPrimaryKey ? ', PK' : ''}${c.comment ? `, ${c.comment}` : ''})`
      ).join('\n');

      let sampleText = '';
      if (table.sampleData && table.sampleData.length > 0) {
        sampleText = `\n样例数据:\n${JSON.stringify(table.sampleData.slice(0, 3), null, 2)}`;
      }

      return `表名: ${table.tableName}\n字段:\n${cols}${sampleText}`;
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
      const prompt = `你是 AI 数据助手。请根据用户问题选择最合适的工具、图表类型和图表配置。

可选工具:
- sql: 查询具体数据 (如: "查询用户表", "统计销售额", "画个图", "Top 10")
- data.advanced_query: 高级数据分析 (如: "同比/环比分析", "增长率计算", "复杂聚合", "多表关联分析")
- qa.expert: 专家问答/咨询 (如: "如何优化库存", "给出营销建议", "深度分析原因")
- report.comprehensive: 生成综合报告 (如: "生成销售分析报告", "写一份市场调研文档")
- crawler.extract: 网页抓取/提取 (如: "抓取这个网站的内容", "提取网页上的价格", "从网址获取信息")
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
  "tool": "sql" | "data.advanced_query" | "qa.expert" | "report.comprehensive" | "data.analyze" | "chitchat" | "crawler.extract", 
  "reason": "原因",
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
      }));

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
        const skill = skillsRegistry.get(plan.name);
        console.log('Looking for skill:', plan.name, 'found:', !!skill);

        if (skill) {
          console.log('Executing skill:', plan.name, 'params:', JSON.stringify(plan.params));
          const ctx: SkillContext = {
            dataSource,
            schemas,
            dbType,
            openai: this.openai,
            model: this.model
          };

          try {
            const skillResult = await skill.execute(plan.params, ctx);
            console.log('Skill result success:', skillResult.success);
            result = skillResult.data;
            skillUsed = plan.name;

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
          } catch (skillError: any) {
            console.error('Skill execution error:', skillError);
            return { answer: `技能执行出错: ${skillError.message}`, skillUsed: plan.name, tokensUsed: this.lastRequestTokens, modelName: this.model };
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
    }
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
        return this.answer(question, dataSource, dbType, history, context?.noChart);
      }

      let result: any;
      let sql: string | undefined;
      let skillUsed: string | undefined;
      let chart: ChartData | undefined;

      // 响应时间统计
      const timings: { [key: string]: number } = {};
      const startTime = Date.now();

      // 步骤1: 理解问题
      console.log('=== 步骤1: AI 理解问题');
      const understandStart = Date.now();

      // 使用优化的 schema 上下文（如果提供）
      const schemaForAI = context?.schemaContext || this.formatSchemaForAI(schemas);

      // 构建增强的系统提示（包含 RAG 上下文）
      let systemPromptAddition = '';
      if (context?.ragContext) {
        systemPromptAddition = `\n\n相关知识背景:\n${context.ragContext.slice(0, 500)}`;
        console.log('=== Using RAG context, length:', context.ragContext.length);
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
        const queryResult = await dataSource.executeQuery(internalSql);
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
        const explanation = await this.generateChineseAnswer(question, result, history, context?.ragContext, context?.noChart);
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
      const planningStart = Date.now();
      console.log('=== 步骤2: 生成SQL语句');
      const sqlPlan = await this.generateSQLWithContext(question, schemas, dbType, history, schemaForAI, systemPromptAddition, context?.noChart);
      timings['生成SQL'] = Date.now() - planningStart;
      sql = sqlPlan.sql;
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
      const executionStart = Date.now();
      console.log('=== 步骤3: 执行查询');
      const queryResult = await dataSource.executeQuery(escapedSql);
      timings['执行'] = Date.now() - executionStart;
      if (!queryResult.success) {
        return { answer: `查询失败: ${queryResult.error}`, sql, tokensUsed: this.lastRequestTokens, modelName: this.model };
      }
      result = queryResult.data;

      // 根据结果生成图表
      if (result && result.length > 1 && !context?.noChart) {
        chart = this.generateChartData(result, (sqlPlan.chartType || 'bar') as any, sqlPlan.chartTitle || question, schemas);
      }

      // 步骤4: AI 生成回答
      const answerStart = Date.now();
      console.log('=== 步骤4: AI 生成回答');
      const explanation = await this.generateChineseAnswer(question, result, history, context?.ragContext, context?.noChart);
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

  // 带上下文的 SQL 生成
  private async generateSQLWithContext(
    question: string,
    schemas: TableSchema[],
    dbType: string,
    history: ChatMessage[],
    schemaContext: string,
    additionalContext: string,
    noChart?: boolean
  ): Promise<{ sql: string, chartTitle?: string, chartType?: string, chartConfig?: { xField?: string, yField?: string } }> {
    await this.ensureInitialized();

    const recentContext = history.slice(-2).map(m => m.content.slice(0, 100)).join(';');

    // 识别维度字段（用于GROUP BY）
    const dimensionFields: string[] = [];
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

    // 构建维度字段示例
    const dimensionExamples = dimensionFields.length > 0
      ? `\n**SQL示例**:
- 问"参赛地区分布" → SELECT 参赛地区, COUNT(*) as count FROM table GROUP BY 参赛地区 ORDER BY count DESC LIMIT 20
- 问"类型分布" → SELECT 类型, COUNT(*) as count FROM table GROUP BY 类型 ORDER BY count DESC LIMIT 20
- 问"时间趋势" → SELECT 时间, COUNT(*) as count FROM table GROUP BY 时间 ORDER BY 时间 ASC LIMIT 100`
      : '';

    const dimensionHint = dimensionFields.length > 0
      ? `\n\n**重要：可用的维度字段（用于GROUP BY分组）**:\n${dimensionFields.join('\n')}${dimensionExamples}`
      : '';

    const response = await this.callWithRetry(() => this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `SQL生成器(${dbType})。返回JSON:{"sql":"SELECT...","chartType":"bar|line|pie|none","chartTitle":"业务标题","chartConfig":{"xField":"维度字段","yField":"数值字段"}}

**核心规则**:
1. 【强制】用户问"分布""趋势""对比""最多""最少"等分析时，必须使用维度字段GROUP BY，禁止说"无法分析"
2. 【强制】地域/类型/时间分析时，必须 SELECT 维度字段, COUNT(*) GROUP BY 维度字段
3. SELECT only,默认LIMIT 20(时间序列趋势可增加到100),聚合按值DESC排序
4. X轴(xField)必须是维度/时间字段,Y轴(yField)必须是数值字段,禁止反转!
5. 必须仔细观察sampleData中的真实字段值,不要猜测格式
6. 支持宽表(多达2000列),不要遗漏任何字段${dimensionHint}

${noChart ? '注意:当前处于无图模式，请务必将"chartType"设置为"none"，不要生成图表。' : ''}

表结构:
${schemaContext}${additionalContext}`
        },
        { role: 'user', content: recentContext ? `上文:${recentContext}\n问:${question}` : question }
      ],
      temperature: 0,
    }));

    const content = response.choices[0].message.content?.trim() || '{}';
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const json = JSON.parse(jsonMatch[0]);
        return {
          sql: cleanSQL(json.sql),
          chartTitle: json.chartTitle,
          chartType: json.chartType
        };
      }
    } catch (e) {
      console.error('Failed to parse AI SQL plan:', e);
    }

    return { sql: cleanSQL(content) };
  }

  // 检测是否需要生成报告（返回报告类型或 null）
  private detectReportIntent(question: string): 'summary' | 'ppt' | 'dashboard' | 'analysis' | null {
    const q = question.toLowerCase();

    // PPT/演示文稿
    if (/(生成|(制|)|(导出|))(ppt|演示|幻灯片|报告文档)/i.test(q)) {
      return 'ppt';
    }

    // 数据大屏
    if (/(生成|(制|)|(展示|))(大屏|(可视化|)看板|dashboard)/i.test(q)) {
      return 'dashboard';
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
    reportType: 'summary' | 'ppt' | 'dashboard' | 'analysis',
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
      const skillContext = {
        dataSource,
        dbType,
        schemas,
        workDir: 'public/downloads'
      };

      const skillName = `report.${reportType}`;
      const skill = skillsRegistry.get(skillName);

      if (!skill) {
        return {
          answer: `抱歉，${reportType} 报告生成功能暂未启用。`,
          tokensUsed: 0,
          modelName: 'none'
        };
      }

      const result = await skill.execute(
        { datasourceId: 'current', topic: question },
        skillContext as any
      );

      const totalTime = Date.now() - startTime;

      if (result.success) {
        return {
          answer: `${result.message}\n\n> ⏱️ 生成耗时: ${totalTime}ms`,
          data: result.data,
          skillUsed: skillName,
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
          `SELECT COUNT(*) as total FROM ${schema.tableName} LIMIT 1`
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
    }));

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

    // 单值查询（如 COUNT(*), SUM() 等）
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

  // AI 生成符合中国人回答习惯的自然语言回答
  private async generateChineseAnswer(
    question: string,
    result: any,
    history: ChatMessage[],
    ragContext?: string,
    noChart?: boolean
  ): Promise<string> {
    if (!result || (Array.isArray(result) && result.length === 0)) {
      return '抱歉，没有查询到相关数据。您可以换个方式描述问题，或检查数据源中是否有对应的数据。';
    }

    await this.ensureInitialized();

    const data = Array.isArray(result) ? result : [result];
    const totalCount = data.length;

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

    let systemPrompt = `你是一位专业的数据分析师，请根据查询结果生成一段符合中国人语言习惯的回答。

**回答风格要求**:
1. 像一位专业同事在回答你的提问，语气自然、亲切、口语化
2. 先直接回答用户的问题（一句话给出核心结论），然后再展开具体数据
3. 数值要用中文习惯的表达：用“万”“亿”等单位，不要显示长串数字
4. 有排名数据时突出前几名和特点，适当做对比和洞察
5. 如果有明显的趋势或规律，用一句话概括
6. 禁止说“无法分析”“数据不足”，有数据就给结论
7. 用 Markdown 格式使内容更清晰易读${hasDimensionField ? '\n8. 结果包含分类/地域维度，请详细列出每个维度的具体数值' : ''}

**举例**:
- 用户问“哪个地区人口最多” → “从数据来看，**广东省**的人口最多，达到了1.26亿，其次是山东省(1.02亿)和河南省(9,937万)...”
- 用户问“月销售额趋势” → “总体来看，销售额呈现**稳步上升**趋势。其中3月份增长最快，环比增长23%...”`;

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
          { role: 'user', content: `问题:${question}\n查询结果${dataSummary}:${resultStr}` }
        ],
        temperature: 0.4,
        max_tokens: 2000,
      }));

      return response.choices[0].message.content || '查询完成，但无法生成详细说明。';
    } catch (error: any) {
      console.error('generateChineseAnswer: AI call failed:', error.message);
      // 回退到快速回答
      return this.generateQuickAnswer(question, data);
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

    // 优化：简单查询结果（≤20条）直接生成描述，不调用AI
    if (totalCount <= 20 && Array.isArray(result)) {
      return this.generateSimpleExplanation(question, result);
    }

    await this.ensureInitialized();

    // 优化：限制发送给AI的数据量，最多50条，超过则只取前30+后20
    let limitedResult: any[];
    if (result.length <= 50) {
      limitedResult = result;
    } else {
      limitedResult = [...result.slice(0, 30), ...result.slice(-20)];
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
        max_tokens: 800,  // 限制回复长度，加快响应
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

  // 带上下文的文件查询规划
  private async planFileQueryWithContext(
    question: string,
    schemas: TableSchema[],
    history: ChatMessage[],
    schemaContext: string,
    additionalContext: string,
    noChart?: boolean
  ): Promise<{ sql: string; chartType?: string; chartTitle?: string; chartConfig?: { xField?: string; yField?: string } }> {
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
- 问"参赛地区分布" → SELECT 参赛地区, COUNT(*) as count FROM table GROUP BY 参赛地区 ORDER BY count DESC LIMIT 20
- 问"类型分布" → SELECT 类型, COUNT(*) as count FROM table GROUP BY 类型 ORDER BY count DESC LIMIT 20
- 问"时间趋势" → SELECT 时间, COUNT(*) as count FROM table GROUP BY 时间 ORDER BY 时间 ASC LIMIT 100`
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
2. 【强制】地域/类型/时间分析时，必须 SELECT 维度字段, COUNT(*) GROUP BY 维度字段
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
    const maxItems = chartType === 'pie' ? 8 : 15; // 饼图最多8项，其他图表最多15项
    let chartData = sortedData;

    if (sortedData.length > maxItems) {
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

  // Schema分析 - 重构版：支持分段解析超宽表
  async analyzeSchema(schemas: TableSchema[]): Promise<{
    tables: { tableName: string; tableNameCn: string; columns: { name: string; type: string; nameCn: string; description: string }[] }[];
    suggestedQuestions: string[];
  }> {
    await this.ensureInitialized();

    const finalizedTables: any[] = [];

    // 对每个表进行独立分析，如果是超宽表则进一步分段
    for (const tableSchema of schemas.slice(0, 100)) {
      const allColumns = tableSchema.columns;
      const totalColumns = allColumns.length;

      // 记录字段数量警告
      if (totalColumns > 2000) {
        console.warn(`⚠️ 表 ${tableSchema.tableName} 包含 ${totalColumns} 个字段，超过2000个字段的分析上限，部分字段将被忽略`);
      }

      const columnChunks = this.chunkArray(allColumns.slice(0, 2000), 30); // 提高到2000个字段，每组30个字段以提高质量
      console.log(`📊 Analyzing table ${tableSchema.tableName}: ${totalColumns} columns total, splitting into ${columnChunks.length} chunks (max 2000 analyzed)`);

      const tableResults = await Promise.all(columnChunks.map(async (chunk, index) => {
        // 增加样例数据数量，给AI更多上下文
        const sampleCount = Math.min(tableSchema.sampleData?.length || 0, 10);
        const schemaForAI = {
          tableName: tableSchema.tableName,
          columns: chunk.map(c => ({ name: c.name, type: c.type })),
          sampleData: tableSchema.sampleData?.slice(0, sampleCount) || []
        };

        const response = await this.callWithRetry(() => this.openai.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: `你是一个资深的数据库业务专家。请仔细分析以下数据表结构(第 ${index + 1} 部分)，并返回分析结果。

**重要规则**:
1. 字段命名识别：
   - 包含"地区""区域""省份""城市""地址"等词 → 这是**地域维度**字段，用于GROUP BY分组
   - 包含"时间""日期""年份""月份"等词 → 这是**时间维度**字段
   - 包含"类型""类别""分类""组别""级别"等词 → 这是**分类维度**字段
   - 包含"数量""金额""数值""分数""比例"等词 → 这是**数值度量**字段
   - 包含"编号""ID""id""ID"等词 → 这是**标识字段**

2. 中文名称要：
   - 简洁准确，符合业务习惯
   - 维度字段用"XX地区""XX类型""XX时间"
   - 度量字段用"XX数量""XX金额""XX分数"

3. 描述要包含：
   - 字段的业务含义
   - 数据格式示例（从sampleData中提取）
   - 典型值说明

必须严格遵循以下 JSON 响应格式:
{
  "tableNameCn": "表的中文业务名称",
  "columns": [
    {
      "name": "必须保持与原列名完全一致",
      "nameCn": "简洁的中文业务名称",
      "description": "详细业务描述，包含字段含义、数据格式、典型值说明"
    }
  ]
}

**特别注意**:
- name 必须原样返回，不能修改
- nameCn 必须是简洁的中文，不要带英文括号说明
- description 要基于真实的 sampleData 推断，不要猜测`
            },
            { role: 'user', content: `请分析以下数据结构:\n${JSON.stringify(schemaForAI, null, 2)}` }
          ],
          temperature: 0.1,
          max_tokens: 4000,
          response_format: { type: 'json_object' }
        }));

        const content = response.choices[0].message.content || '{}';
        try {
          return JSON.parse(content);
        } catch (e) {
          console.error(`Failed to parse chunk ${index} for table ${tableSchema.tableName}`);
          return { columns: [] };
        }
      }));

      // 合并该表的所有分段结果
      const mergedAiColumns = tableResults.flatMap(r => r.columns || []);
      const tableNameCn = tableResults[0]?.tableNameCn || this.guessTableNameCn(tableSchema.tableName);

      // 鲁棒性回填
      finalizedTables.push({
        tableName: tableSchema.tableName,
        tableNameCn,
        columns: tableSchema.columns.map(origCol => {
          // 精确匹配 + 归一化匹配
          const aiCol = mergedAiColumns.find((c: any) =>
            c.name.toLowerCase().trim() === origCol.name.toLowerCase().trim()
          );

          // 如果字段名本身是中文（超过50%是中文字符），直接用原字段名作为nameCn
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

    // 独立的全局问题生成（AI 可以看到所有表的上下文）
    let smartQuestions: string[] = [];
    try {
      smartQuestions = await this.generateSmartQuestions(schemas, finalizedTables);
    } catch (e) {
      console.error('AI 问题生成失败，使用回退逻辑:', e);
    }

    const finalizedResult = {
      tables: finalizedTables,
      suggestedQuestions: smartQuestions.length >= 5
        ? smartQuestions
        : this.generateChineseQuestions(schemas, finalizedTables)
    };

    return finalizedResult;
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

    const response = await this.callWithRetry(() => this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `\u4f60\u662f\u4e00\u4f4d\u8d44\u6df1\u6570\u636e\u5206\u6790\u5e08\u3002\u7528\u6237\u521a\u8fde\u63a5\u4e86\u4e00\u4e2a\u6570\u636e\u6e90\uff0c\u4f60\u9700\u8981\u5e2e\u4ed6\u60f3\u51fa 12~15 \u4e2a\u4ed6\u53ef\u80fd\u611f\u5174\u8da3\u7684\u5206\u6790\u95ee\u9898\u3002

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
      temperature: 0.6,
      max_tokens: 2500,
      response_format: { type: 'json_object' }
    }));

    const content = response.choices[0].message.content || '{}';
    console.log('AI 问题生成原始返回:', content.slice(0, 300));
    try {
      const parsed = JSON.parse(content);
      const questions = parsed.questions || [];
      return questions.sort(() => Math.random() - 0.5).slice(0, 15);
    } catch (e) {
      console.error('JSON 解析失败，尝试正则提取:', e);
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
