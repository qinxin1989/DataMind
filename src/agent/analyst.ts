import OpenAI from 'openai';
import { TableSchema } from '../types';
import { BaseDataSource } from '../datasource';

// 分析步骤
export interface AnalysisStep {
  step: number;
  description: string;
  type: 'sql' | 'calculation' | 'insight';
  code?: string;        // SQL或计算代码
  result?: any;         // 执行结果（内部使用，不输出具体值）
  summary?: string;     // 结果摘要（如"共5个部门，最大部门50人"）
}

// 分析报告
export interface AnalysisReport {
  title: string;
  objective: string;
  steps: AnalysisStep[];
  conclusion: string;
  insights: string[];
  recommendations?: string[];
}

export class AutoAnalyst {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey: string, baseURL?: string, model: string = 'gpt-4o') {
    this.openai = new OpenAI({ apiKey, baseURL });
    this.model = model;
  }

  // 格式化schema
  private formatSchema(schemas: TableSchema[]): string {
    return schemas.map(table => {
      const cols = table.columns.map(c => 
        `  - ${c.name} (${c.type}${c.comment ? `, ${c.comment}` : ''})`
      ).join('\n');
      return `表: ${table.tableName}\n${cols}`;
    }).join('\n\n');
  }

  // 第一步：规划分析方案
  private async planAnalysis(
    topic: string,
    schemas: TableSchema[],
    dbType: string
  ): Promise<{ title: string; objective: string; steps: Array<{ description: string; sql: string }> }> {
    const schemaDesc = this.formatSchema(schemas);

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `你是一个资深数据分析师。根据用户的分析需求和数据库结构，制定详细的分析计划。

数据库类型: ${dbType}
数据库结构:
${schemaDesc}

要求：
1. 分析计划要全面、有逻辑性
2. 每个步骤都要有明确的SQL查询
3. SQL必须是有效的${dbType}语法，只能是SELECT查询
4. 步骤数量控制在3-6步
5. 从整体到细节，从描述性统计到深入分析

返回JSON格式：
{
  "title": "分析报告标题",
  "objective": "分析目标说明",
  "steps": [
    { "description": "步骤说明", "sql": "SELECT ..." }
  ]
}`
        },
        { role: 'user', content: `请帮我分析：${topic}` }
      ],
      temperature: 0.3,
    });

    const content = response.choices[0].message.content || '{}';
    try {
      const jsonStr = content.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      return JSON.parse(jsonStr);
    } catch {
      return { title: '数据分析', objective: topic, steps: [] };
    }
  }

  // 第二步：执行查询并生成摘要
  private async executeAndSummarize(
    sql: string,
    description: string,
    dataSource: BaseDataSource
  ): Promise<{ result: any; summary: string }> {
    const queryResult = await dataSource.executeQuery(sql);
    
    if (!queryResult.success) {
      return { result: null, summary: `执行失败: ${queryResult.error}` };
    }

    // 生成结果摘要（不暴露具体数据）
    const data = queryResult.data || [];
    const rowCount = data.length;
    
    // 让AI生成摘要
    const summaryResponse = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `你是数据分析师。根据查询结果生成简短摘要。
要求：
1. 只描述关键发现，不列出具体数值
2. 用概括性语言，如"共X个类别"、"最高值是最低值的N倍"、"分布较为集中/分散"
3. 一句话概括，不超过50字`
        },
        {
          role: 'user',
          content: `分析目的: ${description}\n查询返回${rowCount}条数据:\n${JSON.stringify(data.slice(0, 20), null, 2)}`
        }
      ],
      temperature: 0.3,
    });

    return {
      result: data,
      summary: summaryResponse.choices[0].message.content || `返回${rowCount}条数据`
    };
  }

  // 第三步：生成最终结论
  private async generateConclusion(
    topic: string,
    steps: AnalysisStep[]
  ): Promise<{ conclusion: string; insights: string[]; recommendations: string[] }> {
    const stepsContext = steps.map(s => 
      `步骤${s.step}: ${s.description}\n结果摘要: ${s.summary}`
    ).join('\n\n');

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `你是资深数据分析师。根据分析过程生成最终结论。

要求：
1. 结论要有洞察力，不是简单复述
2. 提炼3-5个关键发现
3. 给出2-3条可行建议
4. 语言专业但易懂

返回JSON：
{
  "conclusion": "总体结论（2-3句话）",
  "insights": ["发现1", "发现2", ...],
  "recommendations": ["建议1", "建议2", ...]
}`
        },
        {
          role: 'user',
          content: `分析主题: ${topic}\n\n分析过程:\n${stepsContext}`
        }
      ],
      temperature: 0.5,
    });

    const content = response.choices[0].message.content || '{}';
    try {
      const jsonStr = content.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      return JSON.parse(jsonStr);
    } catch {
      return { conclusion: '分析完成', insights: [], recommendations: [] };
    }
  }

  // 主入口：自动分析
  async analyze(
    topic: string,
    dataSource: BaseDataSource,
    dbType: string,
    onProgress?: (step: AnalysisStep) => void
  ): Promise<AnalysisReport> {
    const schemas = await dataSource.getSchema();

    // 1. 规划分析方案
    const plan = await this.planAnalysis(topic, schemas, dbType);
    
    const steps: AnalysisStep[] = [];

    // 2. 逐步执行
    for (let i = 0; i < plan.steps.length; i++) {
      const planStep = plan.steps[i];
      
      const step: AnalysisStep = {
        step: i + 1,
        description: planStep.description,
        type: 'sql',
        code: planStep.sql
      };

      // 执行并生成摘要
      try {
        const { result, summary } = await this.executeAndSummarize(
          planStep.sql,
          planStep.description,
          dataSource
        );
        step.result = result;
        step.summary = summary;
      } catch (error: any) {
        step.summary = `执行出错: ${error.message}`;
      }

      steps.push(step);
      
      // 回调进度
      if (onProgress) {
        onProgress(step);
      }
    }

    // 3. 生成结论
    const { conclusion, insights, recommendations } = await this.generateConclusion(topic, steps);

    return {
      title: plan.title,
      objective: plan.objective,
      steps: steps.map(s => ({
        ...s,
        result: undefined  // 不输出具体结果数据
      })),
      conclusion,
      insights,
      recommendations
    };
  }
}
