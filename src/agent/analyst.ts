import OpenAI from 'openai';
import { TableSchema } from '../types';
import { BaseDataSource } from '../datasource';

// 图表数据
export interface ChartInfo {
  type: 'bar' | 'pie' | 'line';
  title: string;
  data: any[];
  labelField: string;
  valueField: string;
}

// 分析步骤
export interface AnalysisStep {
  step: number;
  description: string;
  type: 'sql' | 'calculation' | 'insight';
  code?: string;
  result?: any;
  summary?: string;
  chart?: ChartInfo;  // 图表数据
}

// 分析报告
export interface AnalysisReport {
  title: string;
  objective: string;
  steps: AnalysisStep[];
  conclusion: string;
  insights: string[];
  recommendations?: string[];
  charts?: ChartInfo[];  // 所有图表
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

  // 第一步：规划分析方案（简化版）
  private async planAnalysis(
    topic: string,
    schemas: TableSchema[],
    dbType: string
  ): Promise<{ title: string; objective: string; steps: Array<{ description: string; sql: string }> }> {
    const schemaDesc = this.formatSchema(schemas);
    const tableNames = schemas.map(s => s.tableName).join(', ');
    const tableCount = schemas.length;
    
    // 检测是否是质量分析
    const isQualityAnalysis = topic.includes('质量') || topic.includes('完整性') || topic.includes('校验');

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `你是数据分析师。根据用户需求制定简洁的分析计划。

数据库类型: ${dbType}
数据源包含 ${tableCount} 个表: ${tableNames}

数据库结构:
${schemaDesc}

分析要求：
1. 每个表的基本统计（记录数）
2. 主要分类字段的分布（TOP5即可）
3. 数值字段的汇总统计（MIN, MAX, AVG）
4. 如有日期字段，按时间分布
${isQualityAnalysis ? `5. 数据质量检查：
   - 查询样本数据（SELECT * FROM 表名 LIMIT 10）
   - 检查空值数量（SELECT COUNT(*) FROM 表名 WHERE 字段 IS NULL OR 字段 = ''）
   - 检查异常值（如年龄<0或>150）` : ''}

要求：
1. 步骤数量控制在 ${Math.min(6, tableCount * 2 + 2)}-${Math.min(10, tableCount * 4)} 步
2. SQL必须简单有效，只用SELECT
3. 每个SQL限制返回20条以内
${isQualityAnalysis ? '4. 质量分析必须包含样本数据查询和空值检查' : ''}

返回JSON格式：
{
  "title": "分析报告标题",
  "objective": "分析目标",
  "steps": [
    { "description": "步骤说明", "sql": "SELECT ... LIMIT 20" }
  ]
}`
        },
        { role: 'user', content: `分析主题：${topic}` }
      ],
      temperature: 0.2,
    });

    const content = response.choices[0].message.content || '{}';
    console.log('Analysis plan:', content.substring(0, 500));
    
    try {
      const jsonStr = content.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      const plan = JSON.parse(jsonStr);
      // 限制最多10个步骤
      if (plan.steps && plan.steps.length > 10) {
        plan.steps = plan.steps.slice(0, 10);
      }
      return plan;
    } catch {
      return { title: '数据分析', objective: topic, steps: [] };
    }
  }

  // 第二步：执行查询并生成摘要（自然语言版）
  private async executeAndSummarize(
    sql: string,
    description: string,
    dataSource: BaseDataSource
  ): Promise<{ result: any; summary: string; chart?: ChartInfo }> {
    try {
      const queryResult = await dataSource.executeQuery(sql);
      
      if (!queryResult.success) {
        return { result: null, summary: `查询未能完成` };
      }

      const data = queryResult.data || [];
      const rowCount = data.length;
      
      if (rowCount === 0) {
        return { result: [], summary: '未查询到相关数据' };
      }
      
      const firstRow = data[0];
      const keys = Object.keys(firstRow);
      
      // 找到标签字段和数值字段
      const labelKey = keys.find(k => typeof firstRow[k] === 'string' || this.isCodeField(k, firstRow[k]));
      const valueKey = keys.find(k => typeof firstRow[k] === 'number' && k !== labelKey);
      
      // 生成自然语言摘要
      let summary = '';
      let chart: ChartInfo | undefined;
      
      if (rowCount === 1) {
        // 单行结果 - 转换为自然语言
        summary = this.formatSingleRowSummary(firstRow, keys);
      } else if (rowCount >= 2 && rowCount <= 15 && labelKey && valueKey) {
        // 分组统计结果 - 翻译标签并生成图表
        const translatedData = data.map(d => ({
          ...d,
          [labelKey]: this.translateLabel(String(d[labelKey] ?? '未知'))
        }));
        
        const items = translatedData.slice(0, 5).map(d => {
          const label = String(d[labelKey]);
          const value = this.formatNumber(Number(d[valueKey]) || 0);
          return `${label} ${value}`;
        });
        summary = `共 ${rowCount} 组：${items.join('，')}${rowCount > 5 ? ' 等' : ''}`;
        
        // 生成图表 - 分布类用饼图，排名类用柱状图
        const descLower = description.toLowerCase();
        const chartType = (descLower.includes('分布') || descLower.includes('占比') || rowCount <= 6) ? 'pie' : 'bar';
        
        // 处理图表数据，超过限制时合并为"其他"
        const maxItems = chartType === 'pie' ? 8 : 12;
        let chartData = translatedData;
        
        if (translatedData.length > maxItems) {
          const sortedData = [...translatedData].sort((a, b) => (Number(b[valueKey]) || 0) - (Number(a[valueKey]) || 0));
          const topItems = sortedData.slice(0, maxItems - 1);
          const otherItems = sortedData.slice(maxItems - 1);
          
          // 判断是否是平均值类的数据
          const isAverage = String(valueKey).toLowerCase().includes('avg') || description.includes('平均');
          let otherValue: number;
          if (isAverage) {
            otherValue = otherItems.reduce((sum, item) => sum + (Number(item[valueKey]) || 0), 0) / otherItems.length;
          } else {
            otherValue = otherItems.reduce((sum, item) => sum + (Number(item[valueKey]) || 0), 0);
          }
          
          const otherItem: any = { ...topItems[0] };
          otherItem[labelKey] = `其他(${otherItems.length}项)`;
          otherItem[valueKey] = isAverage ? Number(otherValue.toFixed(1)) : otherValue;
          
          chartData = [...topItems, otherItem];
        }
        
        chart = {
          type: chartType,
          title: description.slice(0, 20),
          data: chartData,
          labelField: labelKey,
          valueField: valueKey
        };
      } else if (rowCount > 15) {
        // 大量数据 - 取TOP项并合并其他
        if (valueKey && labelKey) {
          const sortedData = [...data].sort((a, b) => (Number(b[valueKey]) || 0) - (Number(a[valueKey]) || 0));
          
          // 取前9项，剩余合并为"其他"
          const topItems = sortedData.slice(0, 9).map(d => ({
            ...d,
            [labelKey]: this.translateLabel(String(d[labelKey] ?? '未知'))
          }));
          
          const otherItems = sortedData.slice(9);
          
          // 判断是否是平均值类的数据
          const isAverage = String(valueKey).toLowerCase().includes('avg') || description.includes('平均');
          let otherValue: number;
          if (isAverage) {
            otherValue = otherItems.reduce((sum, item) => sum + (Number(item[valueKey]) || 0), 0) / otherItems.length;
          } else {
            otherValue = otherItems.reduce((sum, item) => sum + (Number(item[valueKey]) || 0), 0);
          }
          
          const otherItem: any = {};
          otherItem[labelKey] = `其他(${otherItems.length}项)`;
          otherItem[valueKey] = isAverage ? Number(otherValue.toFixed(1)) : otherValue;
          
          const chartData = [...topItems, otherItem];
          
          const values = data.map(d => Number(d[valueKey]) || 0);
          const total = values.reduce((a, b) => a + b, 0);
          const max = Math.max(...values);
          const min = Math.min(...values);
          summary = `共 ${rowCount} 条，总计 ${this.formatNumber(total)}，最大 ${this.formatNumber(max)}，最小 ${this.formatNumber(min)}`;
          
          chart = {
            type: 'bar',
            title: `${description.slice(0, 15)}`,
            data: chartData,
            labelField: labelKey,
            valueField: valueKey
          };
        } else {
          summary = `共 ${rowCount} 条数据`;
        }
      } else {
        summary = `共 ${rowCount} 条数据`;
      }

      return { result: data, summary, chart };
    } catch (error: any) {
      return { result: null, summary: `分析过程中遇到问题` };
    }
  }

  // 判断是否是代码字段
  private isCodeField(fieldName: string, value: any): boolean {
    const lower = fieldName.toLowerCase();
    return lower.includes('代码') || lower.includes('code') || 
           (typeof value === 'number' && (value === 0 || value === 1));
  }

  // 格式化数值
  private formatNumber(value: number): string {
    if (Number.isInteger(value)) {
      return value.toLocaleString();
    }
    return value.toFixed(2);
  }

  // 翻译标签为中文
  private translateLabel(value: string): string {
    // 大洲翻译
    const continentMap: Record<string, string> = {
      'Africa': '非洲', 'Asia': '亚洲', 'Europe': '欧洲',
      'North America': '北美洲', 'South America': '南美洲', 'Oceania': '大洋洲', 'Antarctica': '南极洲'
    };
    
    // 国家代码翻译
    const countryMap: Record<string, string> = {
      'CHN': '中国', 'USA': '美国', 'IND': '印度', 'BRA': '巴西', 'JPN': '日本',
      'RUS': '俄罗斯', 'DEU': '德国', 'GBR': '英国', 'FRA': '法国', 'ITA': '意大利'
    };
    
    // 语言翻译
    const langMap: Record<string, string> = {
      'English': '英语', 'Chinese': '中文', 'Spanish': '西班牙语', 'Arabic': '阿拉伯语',
      'French': '法语', 'German': '德语', 'Japanese': '日语', 'Portuguese': '葡萄牙语'
    };
    
    // 政府形式翻译
    const govMap: Record<string, string> = {
      'Republic': '共和制', 'Constitutional Monarchy': '君主立宪制', 
      'Federal Republic': '联邦共和制', 'Monarchy': '君主制',
      'Dependent Territory of the UK': '英国属地'
    };
    
    // 性别代码
    if (value === '0') return '女性';
    if (value === '1') return '男性';
    
    // 查找翻译
    if (continentMap[value]) return continentMap[value];
    if (countryMap[value]) return countryMap[value];
    if (langMap[value]) return langMap[value];
    if (govMap[value]) return govMap[value];
    
    return value;
  }

  // 将英文字段名转换为中文标签
  private toChineseLabel(fieldName: string): string {
    const map: Record<string, string> = {
      'count': '数量', 'total': '总数', 'sum': '总计', 'avg': '平均',
      'max': '最大值', 'min': '最小值', 'record_count': '记录数',
      'avg_population': '平均人口', 'avg_area': '平均面积', 
      'avg_gnp': '平均GNP', 'avg_life_expectancy': '平均预期寿命',
      'total_population': '总人口', 'avg_city_population': '平均城市人口',
      'max_city_population': '最大城市人口', 'min_city_population': '最小城市人口',
      'max_age': '最大年龄', 'min_age': '最小年龄', 'avg_age': '平均年龄',
    };
    
    const lower = fieldName.toLowerCase();
    
    // 精确匹配
    if (map[lower]) return map[lower];
    
    // 部分匹配
    for (const [key, label] of Object.entries(map)) {
      if (lower.includes(key)) return label;
    }
    
    // 如果是中文，直接返回
    if (/[\u4e00-\u9fa5]/.test(fieldName)) return fieldName;
    
    // 尝试转换下划线命名
    return fieldName.replace(/_/g, ' ');
  }

  // 格式化单行结果为自然语言摘要
  private formatSingleRowSummary(row: any, keys: string[]): string {
    const parts: string[] = [];
    
    for (const k of keys) {
      const v = row[k];
      if (typeof v !== 'number') continue;
      
      const lower = k.toLowerCase();
      const formattedValue = this.formatNumber(v);
      
      // 根据字段名生成自然语言描述
      if (lower.includes('count') || lower.includes('记录') || lower === 'total' || lower === '数量') {
        parts.push(`共${formattedValue}条`);
      } else if (lower.includes('avg') || lower.includes('平均')) {
        if (lower.includes('age') || lower.includes('年龄')) {
          parts.push(`平均年龄${formattedValue}岁`);
        } else if (lower.includes('population') || lower.includes('人口')) {
          parts.push(`平均人口${formattedValue}`);
        } else {
          parts.push(`平均值${formattedValue}`);
        }
      } else if (lower.includes('max') || lower.includes('最大')) {
        if (lower.includes('age') || lower.includes('年龄')) {
          parts.push(`最大年龄${formattedValue}岁`);
        } else {
          parts.push(`最大值${formattedValue}`);
        }
      } else if (lower.includes('min') || lower.includes('最小')) {
        if (lower.includes('age') || lower.includes('年龄')) {
          parts.push(`最小年龄${formattedValue}岁`);
        } else {
          parts.push(`最小值${formattedValue}`);
        }
      } else if (lower.includes('sum') || lower.includes('总')) {
        parts.push(`总计${formattedValue}`);
      } else {
        // 默认格式
        const label = this.toChineseLabel(k);
        parts.push(`${label}${formattedValue}`);
      }
    }
    
    return parts.length > 0 ? parts.join('，') : '查询完成';
  }

  // 第三步：生成最终结论（简化版）
  private async generateConclusion(
    topic: string,
    steps: AnalysisStep[]
  ): Promise<{ conclusion: string; insights: string[]; recommendations: string[] }> {
    // 如果步骤很少或都失败了，直接返回简单结论
    const successSteps = steps.filter(s => s.summary && !s.summary.includes('失败') && !s.summary.includes('出错'));
    
    if (successSteps.length === 0) {
      return { 
        conclusion: '分析过程中遇到问题，未能获取有效数据', 
        insights: ['数据查询失败，请检查数据源'], 
        recommendations: ['检查数据源连接', '确认表结构正确'] 
      };
    }

    const stepsContext = successSteps.slice(0, 6).map(s => 
      `${s.description}: ${s.summary}`
    ).join('\n');

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `根据分析结果生成简短结论。返回JSON：
{
  "conclusion": "1-2句总结",
  "insights": ["发现1", "发现2", "发现3"],
  "recommendations": ["建议1", "建议2"]
}`
          },
          { role: 'user', content: `主题: ${topic}\n\n分析结果:\n${stepsContext}` }
        ],
        temperature: 0.3,
      });

      const content = response.choices[0].message.content || '{}';
      const jsonStr = content.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      return JSON.parse(jsonStr);
    } catch {
      // 如果AI调用失败，生成简单结论
      return { 
        conclusion: `完成了${successSteps.length}项分析`, 
        insights: successSteps.slice(0, 3).map(s => s.summary || s.description), 
        recommendations: ['可以针对具体维度深入分析'] 
      };
    }
  }

  // 主入口：自动分析
  async analyze(
    topic: string,
    dataSource: BaseDataSource,
    dbType: string,
    onProgress?: (step: AnalysisStep) => void
  ): Promise<AnalysisReport> {
    console.log('Starting analysis for:', topic);
    const schemas = await dataSource.getSchema();
    console.log('Got schemas:', schemas.map(s => s.tableName).join(', '));

    // 1. 规划分析方案
    console.log('Planning analysis...');
    const plan = await this.planAnalysis(topic, schemas, dbType);
    console.log('Plan created with', plan.steps?.length || 0, 'steps');
    
    if (!plan.steps || plan.steps.length === 0) {
      return {
        title: plan.title || '数据分析',
        objective: plan.objective || topic,
        steps: [],
        conclusion: '无法生成分析计划',
        insights: [],
        recommendations: []
      };
    }
    
    const steps: AnalysisStep[] = [];
    const charts: ChartInfo[] = [];

    // 2. 逐步执行（限制最多8步）
    const maxSteps = Math.min(plan.steps.length, 8);
    for (let i = 0; i < maxSteps; i++) {
      const planStep = plan.steps[i];
      console.log(`Executing step ${i + 1}/${maxSteps}: ${planStep.description}`);
      
      const step: AnalysisStep = {
        step: i + 1,
        description: planStep.description,
        type: 'sql',
        code: planStep.sql
      };

      // 执行并生成摘要
      const { result, summary, chart } = await this.executeAndSummarize(
        planStep.sql,
        planStep.description,
        dataSource
      );
      step.result = result;
      step.summary = summary;
      step.chart = chart;
      
      // 收集图表
      if (chart) {
        charts.push(chart);
      }
      
      console.log(`Step ${i + 1} result:`, summary, chart ? '(有图表)' : '');

      steps.push(step);
      
      if (onProgress) {
        onProgress(step);
      }
    }

    // 3. 生成结论
    console.log('Generating conclusion...');
    const { conclusion, insights, recommendations } = await this.generateConclusion(topic, steps);
    console.log('Analysis complete with', charts.length, 'charts');

    // 4. 润色分析步骤的摘要
    console.log('Polishing report...');
    const polishedSteps = await this.polishStepsSummary(steps);

    return {
      title: plan.title,
      objective: plan.objective,
      steps: polishedSteps.map(s => ({
        ...s,
        result: undefined
      })),
      conclusion,
      insights,
      recommendations,
      charts: charts.slice(0, 4)  // 最多返回4个图表
    };
  }

  // 润色分析步骤（描述和摘要），使其更自然流畅
  private async polishStepsSummary(steps: AnalysisStep[]): Promise<AnalysisStep[]> {
    // 收集所有步骤的描述和摘要
    const stepsText = steps.map((s, i) => 
      `${i + 1}. ${s.description} | ${s.summary || '无结果'}`
    ).join('\n');

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `你是文字润色专家。请将以下分析步骤润色为更自然流畅的中文表达。

输入格式：序号. 步骤描述 | 分析结果
输出格式：序号. 润色后的描述 | 润色后的结果

**严格要求**：
1. 只润色语言表达，不要改变任何数字和数据
2. 不要添加任何原文没有的信息或数据
3. 不要删除任何数据
4. 保持原有的条目数量和顺序
5. 步骤描述要简洁自然，不要出现英文表名（如death_cert_data改为"死亡证明数据"）
6. 结果描述要像人说话一样自然

示例：
原文：1. 统计 death_cert_data 表的总记录数 | 记录数 100
润色：1. 统计死亡证明数据的总记录数 | 共有100条记录

原文：2. 分析 death_cert_data 中性别代码的分布 | 共 2 组：女性 52，男性 48
润色：2. 分析性别分布情况 | 女性52人，男性48人

原文：3. 获取 death_cert_data 中年龄字段的汇总统计 | 最大年龄 120，最小年龄 0，平均年龄 62.98
润色：3. 统计年龄分布 | 年龄范围0-120岁，平均约63岁`
          },
          { role: 'user', content: stepsText }
        ],
        temperature: 0.3,
      });

      const polishedText = response.choices[0].message.content || '';
      const polishedLines = polishedText.split('\n').filter(l => l.trim());
      
      // 解析润色后的结果
      return steps.map((step, i) => {
        const line = polishedLines.find(l => l.startsWith(`${i + 1}.`));
        if (line) {
          const pipeIndex = line.indexOf(' | ');
          if (pipeIndex > 0) {
            // 提取描述和摘要
            const descPart = line.substring(line.indexOf('.') + 1, pipeIndex).trim();
            const summaryPart = line.substring(pipeIndex + 3).trim();
            
            return { 
              ...step, 
              description: descPart || step.description,
              summary: summaryPart || step.summary 
            };
          }
        }
        return step;
      });
    } catch (e) {
      console.error('Polishing failed:', e);
      return steps; // 润色失败则返回原始步骤
    }
  }
}
