import OpenAI from 'openai';
import { TableSchema, AIResponse } from '../types';
import { BaseDataSource } from '../datasource';
import { ChatMessage } from '../store/configStore';
import { skillRegistry, SkillContext } from './skills';
import { mcpRegistry } from './mcp';
import { AutoAnalyst, AnalysisReport } from './analyst';
import { DashboardGenerator, DashboardResult } from './dashboard';
import { SlideContent } from './pptGenerator';

// Agent 执行结果
export interface AgentResponse extends AIResponse {
  skillUsed?: string;
  toolUsed?: string;
  visualization?: any;
  chart?: ChartData;
}

// 内嵌图表数据
export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'area';
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
  type: 'skill' | 'mcp' | 'sql';
  name: string;
  params: Record<string, any>;
  postProcess?: 'format' | 'ppt' | 'format_and_ppt' | null;
  needChart?: boolean;
  chartType?: 'bar' | 'line' | 'pie' | 'area';
  methodology?: string;  // 分析方法论
  missingData?: string;  // 缺少的数据说明
}

export class AIAgent {
  private openai: OpenAI;
  private model: string;
  private analyst: AutoAnalyst;
  private dashboardGen: DashboardGenerator;

  constructor(apiKey: string, baseURL?: string, model: string = 'gpt-4o') {
    this.openai = new OpenAI({ apiKey, baseURL });
    this.model = model;
    this.analyst = new AutoAnalyst(apiKey, baseURL, model);
    this.dashboardGen = new DashboardGenerator(apiKey, baseURL, model);
  }

  // 自动分析入口
  async autoAnalyze(
    topic: string,
    dataSource: BaseDataSource,
    dbType: string,
    onProgress?: (step: any) => void
  ): Promise<AnalysisReport> {
    return this.analyst.analyze(topic, dataSource, dbType, onProgress);
  }

  // 生成大屏入口
  async generateDashboard(
    topic: string,
    dataSource: BaseDataSource,
    dbType: string,
    theme: 'light' | 'dark' | 'tech' = 'dark'
  ): Promise<DashboardResult> {
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

  // 构建上下文消息
  private buildContextMessages(history: ChatMessage[]): { role: 'user' | 'assistant'; content: string }[] {
    const recentHistory = history.slice(-10);
    return recentHistory.map(msg => ({
      role: msg.role,
      content: msg.content + (msg.sql ? `\n[SQL: ${msg.sql}]` : '')
    }));
  }

  // 意图识别 - 使用关键词匹配，不依赖 AI 返回 JSON
  private async planAction(
    question: string,
    schemas: TableSchema[],
    dbType: string,
    history: ChatMessage[]
  ): Promise<ToolCall> {
    const tables = schemas.map(s => s.tableName);
    const firstTable = tables[0] || 'country';
    
    // 获取第一个表的字段
    const firstSchema = schemas[0];
    const numericFields = firstSchema?.columns
      .filter(c => c.type.toLowerCase().includes('int') || c.type.toLowerCase().includes('decimal') || c.type.toLowerCase().includes('float'))
      .map(c => c.name) || ['Population'];
    const labelField = firstSchema?.columns.find(c => c.name.toLowerCase().includes('name'))?.name || 'Name';
    
    const q = question.toLowerCase();
    
    // 1. 对比类问题（中国和美国、A vs B）
    if ((q.includes('对比') || q.includes('vs') || q.includes('比较')) && 
        (q.includes('中国') || q.includes('美国') || q.includes('和'))) {
      // 提取要对比的实体
      const entities: string[] = [];
      if (q.includes('中国')) entities.push('China');
      if (q.includes('美国')) entities.push('United States');
      if (entities.length < 2) entities.push('China', 'United States');
      
      // 国家对比使用 country 表
      const countryTable = tables.find(t => t.toLowerCase() === 'country') || firstTable;
      
      return {
        type: 'skill',
        name: 'compare_entities',
        params: {
          table: countryTable,
          labelField: 'Name',
          entities: entities.slice(0, 2),
          metrics: ['Population', 'GNP', 'SurfaceArea', 'LifeExpectancy']
        },
        needChart: true,
        chartType: 'bar'
      };
    }
    
    // 2. 排名类问题
    if (q.includes('最多') || q.includes('最大') || q.includes('最高') || q.includes('top') || q.includes('排名') || q.includes('哪个')) {
      return {
        type: 'skill',
        name: 'top_ranking',
        params: {
          table: firstTable,
          rankField: numericFields[0] || 'Population',
          labelField: labelField,
          limit: 10
        },
        needChart: true,
        chartType: 'bar'
      };
    }
    
    // 3. 分布/占比类问题
    if (q.includes('分布') || q.includes('占比') || q.includes('各') || q.includes('每个')) {
      const groupField = firstSchema?.columns.find(c => 
        c.name.toLowerCase().includes('continent') || 
        c.name.toLowerCase().includes('region') ||
        c.name.toLowerCase().includes('type') ||
        c.name.toLowerCase().includes('category')
      )?.name || labelField;
      
      return {
        type: 'skill',
        name: 'data_comparison',
        params: {
          table: firstTable,
          compareField: groupField,
          valueField: numericFields[0] || 'Population'
        },
        needChart: true,
        chartType: 'pie'
      };
    }
    
    // 4. 统计类问题
    if (q.includes('多少') || q.includes('总数') || q.includes('统计') || q.includes('数量')) {
      return {
        type: 'skill',
        name: 'data_statistics',
        params: {
          table: firstTable,
          field: numericFields[0]
        },
        needChart: true,
        chartType: 'bar'
      };
    }
    
    // 5. 图表类问题 - 默认生成柱状图
    if (q.includes('图') || q.includes('chart') || q.includes('画')) {
      return {
        type: 'skill',
        name: 'top_ranking',
        params: {
          table: firstTable,
          rankField: numericFields[0] || 'Population',
          labelField: labelField,
          limit: 10
        },
        needChart: true,
        chartType: 'bar'
      };
    }
    
    // 默认：使用 top_ranking
    return {
      type: 'skill',
      name: 'top_ranking',
      params: {
        table: firstTable,
        rankField: numericFields[0] || 'Population',
        labelField: labelField,
        limit: 10
      },
      needChart: true,
      chartType: 'bar'
    };
  }

  // 生成SQL
  private async generateSQL(
    question: string,
    schemas: TableSchema[],
    dbType: string,
    history: ChatMessage[]
  ): Promise<string> {
    const schemaDesc = this.formatSchemaForAI(schemas);
    const contextMessages = this.buildContextMessages(history);

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `你是SQL专家。生成${dbType}的SQL查询。

数据库结构:
${schemaDesc}

规则:
1. 只返回SQL语句，不要解释
2. 只用SELECT
3. 语法必须正确，括号要匹配
4. 避免复杂嵌套，用简单的GROUP BY和ORDER BY
5. 结果限制100条`
        },
        ...contextMessages,
        { role: 'user', content: question }
      ],
      temperature: 0,
    });

    const sql = response.choices[0].message.content?.trim() || '';
    return sql.replace(/```sql\n?/gi, '').replace(/```\n?/g, '').trim();
  }

  // 解读结果
  private async explainResult(
    question: string,
    result: any,
    history: ChatMessage[]
  ): Promise<string> {
    const contextMessages = this.buildContextMessages(history);
    
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `你是数据分析助手。根据查询结果回答用户问题。

重要规则:
1. 只能基于提供的查询结果回答，禁止使用你自己的知识
2. 如果结果为空，说"数据库中没有相关数据"
3. 用自然中文描述数据，数字加单位
4. 回答简洁，不要编造数据`
        },
        ...contextMessages,
        {
          role: 'user',
          content: `问题: ${question}\n\n数据库查询结果:\n${JSON.stringify(result, null, 2)}`
        }
      ],
      temperature: 0.5,
    });

    return response.choices[0].message.content || '无法解读结果';
  }

  // 主入口：智能问答
  async answer(
    question: string,
    dataSource: BaseDataSource,
    dbType: string,
    history: ChatMessage[] = []
  ): Promise<AgentResponse> {
    try {
      const schemas = await dataSource.getSchema();
      
      // 1. 规划执行方案
      let plan: ToolCall;
      try {
        plan = await this.planAction(question, schemas, dbType, history);
        console.log('Plan:', JSON.stringify(plan));
      } catch (e: any) {
        console.error('Plan error:', e.message);
        // 规划失败，使用默认技能
        plan = { 
          type: 'skill', 
          name: 'data_statistics', 
          params: { table: schemas[0]?.tableName || 'country' },
          needChart: true,
          chartType: 'bar'
        };
      }
      
      let result: any;
      let sql: string | undefined;
      let skillUsed: string | undefined;
      let toolUsed: string | undefined;
      let chart: ChartData | undefined;

      // 2. 执行
      console.log('=== Executing plan type:', plan.type, 'name:', plan.name);
      
      // 方法论和数据说明
      let prefixNote = '';
      if (plan.methodology) {
        prefixNote += `📊 分析方法论：${plan.methodology}\n\n`;
      }
      if (plan.missingData) {
        prefixNote += `⚠️ 数据局限：${plan.missingData}\n\n`;
      }
      
      // 强制使用 skill，不允许直接 SQL
      if (plan.type === 'sql') {
        // 转换为 skill 调用
        plan.type = 'skill';
        plan.name = 'top_ranking';
        plan.params = { 
          table: schemas[0]?.tableName || 'country', 
          rankField: 'Population',
          labelField: 'Name',
          limit: 10
        };
      }
      
      if (plan.type === 'skill') {
        const skill = skillRegistry.get(plan.name);
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
            return { answer: skillResult.message || '技能执行失败', skillUsed };
          }
          } catch (skillError: any) {
            console.error('Skill execution error:', skillError);
            return { answer: `技能执行出错: ${skillError.message}`, skillUsed: plan.name };
          }
        } else {
          // 技能不存在，回退到简单SQL
          console.log('Skill not found, falling back to SQL');
          sql = await this.generateSQL(question, schemas, dbType, history);
          const queryResult = await dataSource.executeQuery(sql);
          if (!queryResult.success) {
            return { answer: `查询失败: ${queryResult.error}`, sql };
          }
          result = queryResult.data;
        }
      } else if (plan.type === 'mcp') {
        const { server, tool, ...toolParams } = plan.params;
        const mcpResult = await mcpRegistry.callTool(server, tool, toolParams);
        toolUsed = `${server}/${tool}`;
        if (mcpResult.isError) {
          return { answer: mcpResult.content[0]?.text || '工具执行失败', toolUsed };
        }
        result = mcpResult.content.map((c: any) => c.text).join('\n');
      }

      // 3. 生成图表（如果技能没有生成且需要图表）
      if (!chart && plan.needChart && Array.isArray(result) && result.length > 1) {
        chart = this.generateChartData(result, plan.chartType || 'bar', question);
      }

      // 4. 解读结果
      const explanation = await this.explainResult(question, result, history);

      return {
        answer: prefixNote + explanation,
        sql,
        data: Array.isArray(result) ? result : (result?.dimensions ? result : undefined),
        skillUsed,
        toolUsed,
        chart
      };
    } catch (error: any) {
      return { answer: `处理失败: ${error.message}` };
    }
  }

  // 生成图表数据
  private generateChartData(data: any[], chartType: 'bar' | 'line' | 'pie' | 'area', title: string): ChartData | undefined {
    if (!data || data.length === 0) return undefined;

    const keys = Object.keys(data[0]);
    if (keys.length < 2) return undefined;

    let xField = keys[0];
    let yField = keys[1];

    // 找数值字段作为y轴
    for (const key of keys) {
      if (typeof data[0][key] === 'number') {
        yField = key;
        break;
      }
    }

    // 找非数值字段作为x轴
    for (const key of keys) {
      if (typeof data[0][key] !== 'number' && key !== yField) {
        xField = key;
        break;
      }
    }

    return {
      type: chartType,
      title: title.slice(0, 30),
      data: data.slice(0, 20),
      config: { xField, yField, labelField: xField, valueField: yField }
    };
  }

  // Schema分析
  async analyzeSchema(schemas: TableSchema[]): Promise<{
    tables: { tableName: string; tableNameCn: string; columns: { name: string; type: string; nameCn: string; description: string }[] }[];
    suggestedQuestions: string[];
  }> {
    const schemaDesc = this.formatSchemaForAI(schemas);
    
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `分析数据库结构，返回JSON:
{
  "tables": [{"tableName":"原表名","tableNameCn":"中文名","columns":[{"name":"字段名","type":"类型","nameCn":"中文名","description":"说明"}]}],
  "suggestedQuestions": ["推荐问题1","推荐问题2"]
}
只返回JSON`
        },
        { role: 'user', content: schemaDesc }
      ],
      temperature: 0.3,
    });

    const content = response.choices[0].message.content || '{}';
    try {
      const jsonStr = content.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      return JSON.parse(jsonStr);
    } catch {
      return { tables: [], suggestedQuestions: [] };
    }
  }
}

// 导出
export { skillRegistry, mcpRegistry };
export * from './skills';
export * from './mcp';
export * from './analyst';
export * from './dashboard';
