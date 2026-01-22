import OpenAI from 'openai';
import { TableSchema, AIResponse, QueryResult } from '../types';
import { BaseDataSource } from '../datasource';
import { ChatMessage } from '../store/configStore';

export class AIEngine {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey: string, baseURL?: string, model: string = 'gpt-4o') {
    this.openai = new OpenAI({ apiKey, baseURL });
    this.model = model;
  }

  // 生成schema描述供AI理解
  private formatSchemaForAI(schemas: TableSchema[]): string {
    return schemas.map(table => {
      const cols = table.columns.map(c => 
        `  - ${c.name} (${c.type}${c.isPrimaryKey ? ', PK' : ''}${c.comment ? `, ${c.comment}` : ''})`
      ).join('\n');
      const sample = table.sampleData?.length 
        ? `\n  样例数据: ${JSON.stringify(table.sampleData[0])}`
        : '';
      return `表名: ${table.tableName}\n字段:\n${cols}${sample}`;
    }).join('\n\n');
  }

  // AI分析表结构，生成中文名称和推荐问题
  async analyzeSchema(schemas: TableSchema[]): Promise<{
    tables: {
      tableName: string;
      tableNameCn: string;
      columns: { name: string; type: string; nameCn: string; description: string }[];
    }[];
    suggestedQuestions: string[];
  }> {
    const schemaDesc = this.formatSchemaForAI(schemas);
    
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `你是一个数据分析专家。分析数据库结构，返回JSON格式：
{
  "tables": [
    {
      "tableName": "原表名",
      "tableNameCn": "推测的中文表名",
      "columns": [
        { "name": "字段名", "type": "类型", "nameCn": "推测的中文名", "description": "字段用途说明" }
      ]
    }
  ],
  "suggestedQuestions": ["根据数据结构推荐的12-15个常见业务问题"]
}

要求：
1. 根据字段名、类型、样例数据推测中文含义
2. 推荐的问题要贴合实际业务场景，具体且有价值
3. 问题要多样化：统计类、排名类、趋势类、对比类等
4. 问题中使用中文名称，不要用英文表名或字段名
5. 只返回JSON，不要其他内容`
        },
        { role: 'user', content: schemaDesc }
      ],
      temperature: 0.3,
    });

    const content = response.choices[0].message.content || '{}';
    try {
      // 清理可能的markdown代码块
      const jsonStr = content.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      return JSON.parse(jsonStr);
    } catch {
      return { tables: [], suggestedQuestions: [] };
    }
  }

  // 构建上下文消息
  private buildContextMessages(history: ChatMessage[]): { role: 'user' | 'assistant'; content: string }[] {
    // 只取最近5轮对话作为上下文
    const recentHistory = history.slice(-10);
    return recentHistory.map(msg => ({
      role: msg.role,
      content: msg.content + (msg.sql ? `\n[执行的SQL: ${msg.sql}]` : '')
    }));
  }

  // 自然语言转SQL（带上下文）
  async generateSQL(
    question: string, 
    schemas: TableSchema[], 
    dbType: string,
    history: ChatMessage[] = []
  ): Promise<string> {
    const schemaDesc = this.formatSchemaForAI(schemas);
    const contextMessages = this.buildContextMessages(history);
    
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `你是一个SQL专家。根据用户问题和数据库结构生成${dbType}的SQL查询语句。
只返回SQL语句，不要解释。确保SQL语法正确且安全（只允许SELECT查询）。
注意：用户可能会基于之前的对话继续提问，比如"那个产品的详情"、"换成按月统计"等，请结合上下文理解。

数据库结构:
${schemaDesc}`
        },
        ...contextMessages,
        { role: 'user', content: question }
      ],
      temperature: 0,
    });

    const sql = response.choices[0].message.content?.trim() || '';
    
    // 移除 <think> 标签和其内部内容（Qwen3-32B 模型可能返回）
    let cleanedSql = sql.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    
    // 移除 Markdown 代码块
    cleanedSql = cleanedSql.replace(/```sql\n?/gi, '').replace(/```\n?/g, '').trim();
    
    // 如果有多个 SQL 语句，只取第一个
    const firstStatement = cleanedSql.split(';')[0].trim();
    
    return firstStatement;
  }

  // 智能问答（带上下文）
  async answer(
    question: string, 
    dataSource: BaseDataSource, 
    dbType: string,
    history: ChatMessage[] = []
  ): Promise<AIResponse> {
    try {
      const schemas = await dataSource.getSchema();
      const sql = await this.generateSQL(question, schemas, dbType, history);
      
      if (!sql.toLowerCase().trim().startsWith('select')) {
        return { answer: '抱歉，只支持查询操作', sql };
      }

      const result = await dataSource.executeQuery(sql);
      
      if (!result.success) {
        return { answer: `查询执行失败: ${result.error}`, sql };
      }

      const explanation = await this.explainResult(question, sql, result, history);
      
      return {
        answer: explanation,
        sql,
        data: result.data,
      };
    } catch (error: any) {
      return { answer: `处理失败: ${error.message}` };
    }
  }

  // 解读查询结果（带上下文）
  private async explainResult(
    question: string, 
    sql: string, 
    result: QueryResult,
    history: ChatMessage[] = []
  ): Promise<string> {
    const dataPreview = result.data?.slice(0, 10);
    const contextMessages = this.buildContextMessages(history);
    
    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `你是一个友好的数据分析助手。请用自然、口语化的中文回答用户问题。

要求：
1. 像朋友聊天一样回答，不要太正式
2. 数字要加上合适的单位（件、个、元、次等）
3. 如果是金额，用"元"或"万元"
4. 如果是数量，用"件"、"个"、"条"等
5. 给出简短的分析或建议
6. 不要提及SQL或数据库相关的技术细节
7. 如果用户问的是追问（如"那个"、"它"），要结合上下文理解指代`
        },
        ...contextMessages,
        {
          role: 'user',
          content: `问题: ${question}\n\n查询结果(共${result.rowCount}条):\n${JSON.stringify(dataPreview, null, 2)}`
        }
      ],
      temperature: 0.7,
    });

    return response.choices[0].message.content || '无法解读结果';
  }
}
