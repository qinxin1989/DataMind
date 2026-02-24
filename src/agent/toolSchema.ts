/**
 * Tool Schema - 统一工具适配层
 * 将 DataMind 的 SkillsRegistry + MCPRegistry 适配为 OpenAI function-calling tools 格式
 * 核心：桥接数据源上下文（dataSource, schemas, dbType）到每个工具调用
 */

import { skillsRegistry, SkillContext, SkillResult } from './skills';
import { mcpRegistry } from './mcp';
import { BaseDataSource } from '../datasource';
import { TableSchema } from '../types';

// ========== run_skill 统一入口 Schema ==========

/**
 * 生成 run_skill 工具的 OpenAI function schema
 * 与 ai-agent-plus 声明式模式一致：LLM 通过 { skill, action, args } 调用任意技能
 */
export function getRunSkillToolSchema(): any {
  return {
    type: 'function',
    function: {
      name: 'run_skill',
      description: 'Execute a skill action. Use this tool for any real operation (data query, file processing, report generation, etc.)',
      parameters: {
        type: 'object',
        properties: {
          skill: { type: 'string', description: 'Skill name (e.g. data.query, file.read, report.ppt)' },
          action: { type: 'string', description: 'Action name within the skill (for MCP: server__tool format)' },
          args: { type: 'object', description: 'Arguments object for the action' },
        },
        required: ['skill', 'action', 'args'],
      },
    },
  };
}

/**
 * 生成 execute_sql 工具的 schema（Agent 可直接对数据源执行 SQL）
 */
export function getExecuteSqlToolSchema(): any {
  return {
    type: 'function',
    function: {
      name: 'execute_sql',
      description: '直接对当前数据源执行 SQL 查询并返回结果。适用于数据查询、统计、聚合分析等。',
      parameters: {
        type: 'object',
        properties: {
          sql: { type: 'string', description: '要执行的 SQL 语句' },
          explain: { type: 'string', description: '简要说明为什么执行这条 SQL' },
        },
        required: ['sql'],
      },
    },
  };
}

/**
 * 获取 Agent Loop 使用的完整工具列表（run_skill + execute_sql）
 */
export function getAgentTools(): any[] {
  return [
    getRunSkillToolSchema(),
    getExecuteSqlToolSchema(),
  ];
}

// ========== 工具执行分发 ==========

export interface ToolExecutionContext {
  dataSource?: BaseDataSource;
  schemas?: TableSchema[];
  dbType?: string;
  openai?: any;
  model?: string;
  workDir?: string;
  userId?: string;
}

/**
 * 执行 run_skill 调用：分发到 SkillsRegistry 或 MCPRegistry
 */
export async function executeRunSkill(
  payload: { skill: string; action: string; args: Record<string, any> },
  ctx: ToolExecutionContext
): Promise<string> {
  const { skill, action, args } = payload;

  if (!skill || typeof skill !== 'string') {
    return 'Error: run_skill.skill must be a non-empty string';
  }
  if (!action || typeof action !== 'string') {
    return 'Error: run_skill.action must be a non-empty string';
  }

  // 1. 尝试 SkillsRegistry（格式：category.name 如 data.query）
  const skillName = `${skill}.${action}`;
  const registeredSkill = skillsRegistry.get(skillName) || skillsRegistry.get(skill);

  if (registeredSkill) {
    const skillCtx: SkillContext = {
      dataSource: ctx.dataSource,
      schemas: ctx.schemas,
      dbType: ctx.dbType,
      openai: ctx.openai,
      model: ctx.model,
      workDir: ctx.workDir,
      userId: ctx.userId,
    };

    try {
      const result: SkillResult = await skillsRegistry.execute(
        registeredSkill.name,
        { ...args },
        skillCtx
      );

      if (!result.success) {
        return `Error: ${result.message || '技能执行失败'}`;
      }

      // 将结果序列化为字符串供 LLM 阅读
      return formatSkillResult(result);
    } catch (e: any) {
      return `Error: 技能执行异常: ${e.message}`;
    }
  }

  // 2. 尝试 MCPRegistry（格式：server__tool）
  const mcpKey = `${skill}__${action}`;
  const allMcpTools = mcpRegistry.getAllTools();
  const mcpMatch = allMcpTools.find(t => `${t.serverName}__${t.tool.name}` === mcpKey);

  if (mcpMatch) {
    try {
      const mcpResult = await mcpRegistry.callTool(skill, action, args || {});
      if (mcpResult.isError) {
        return `Error: ${mcpResult.content.map(c => c.text).join('\n')}`;
      }
      return mcpResult.content.map(c => c.text).join('\n');
    } catch (e: any) {
      return `Error: MCP 工具执行异常: ${e.message}`;
    }
  }

  // 3. 未找到
  const knownSkills = skillsRegistry.getAll().map(s => s.name).join(', ');
  const knownMcp = allMcpTools.map(t => `${t.serverName}.${t.tool.name}`).join(', ');
  return `Error: unknown skill/action: ${skill}.${action}. Known skills: ${knownSkills}. Known MCP: ${knownMcp}`;
}

/**
 * 执行 execute_sql 调用：直接对数据源执行 SQL
 */
export async function executeSql(
  payload: { sql: string; explain?: string },
  ctx: ToolExecutionContext
): Promise<string> {
  if (!ctx.dataSource) {
    return 'Error: 数据源未配置，无法执行 SQL';
  }

  const sql = (payload.sql || '').trim();
  if (!sql) {
    return 'Error: SQL 不能为空';
  }

  // 安全检查：禁止危险操作
  const sqlUpper = sql.toUpperCase().trim();
  const dangerousPatterns = ['DROP ', 'DELETE ', 'TRUNCATE ', 'ALTER ', 'CREATE ', 'INSERT ', 'UPDATE '];
  for (const pattern of dangerousPatterns) {
    if (sqlUpper.startsWith(pattern)) {
      return `Error: 禁止执行危险操作: ${pattern.trim()}`;
    }
  }

  try {
    const result = await ctx.dataSource.executeQuery(sql);
    if (!result.success) {
      return `Error: SQL 执行失败: ${result.error}`;
    }

    const data = result.data || [];
    const rowCount = result.rowCount ?? data.length;

    // 截断大结果集
    const maxRows = 50;
    const truncated = data.length > maxRows;
    const displayData = truncated ? data.slice(0, maxRows) : data;

    let output = `查询成功，返回 ${rowCount} 行数据。\n`;
    if (truncated) {
      output += `(仅展示前 ${maxRows} 行)\n`;
    }
    output += JSON.stringify(displayData, null, 2);

    // 限制总长度
    if (output.length > 8000) {
      output = output.slice(0, 8000) + `\n... (结果已截断，共 ${output.length} 字符)`;
    }

    return output;
  } catch (e: any) {
    return `Error: SQL 执行异常: ${e.message}`;
  }
}

/**
 * 统一工具执行入口：根据 function name 分发
 */
export async function executeToolCall(
  functionName: string,
  argsStr: string,
  ctx: ToolExecutionContext
): Promise<string> {
  let args: Record<string, any>;
  try {
    args = argsStr ? JSON.parse(argsStr) : {};
  } catch {
    return `Error: 无法解析工具参数: ${argsStr}`;
  }

  switch (functionName) {
    case 'run_skill':
      return executeRunSkill(
        { skill: args.skill, action: args.action, args: args.args || {} },
        ctx
      );
    case 'execute_sql':
      return executeSql({ sql: args.sql, explain: args.explain }, ctx);
    default:
      return `Error: 未知工具: ${functionName}`;
  }
}

// ========== 辅助函数 ==========

function formatSkillResult(result: SkillResult): string {
  const parts: string[] = [];

  if (result.message) {
    parts.push(result.message);
  }

  if (result.outputPath) {
    parts.push(`输出文件: ${result.outputPath}`);
  }

  if (result.data) {
    const dataStr = typeof result.data === 'string'
      ? result.data
      : JSON.stringify(result.data, null, 2);
    // 截断大数据
    if (dataStr.length > 6000) {
      parts.push(dataStr.slice(0, 6000) + `\n... (数据已截断，共 ${dataStr.length} 字符)`);
    } else {
      parts.push(dataStr);
    }
  }

  return parts.join('\n') || '技能执行成功（无返回数据）';
}

/**
 * 构建包含数据源上下文的 system prompt
 */
export function buildAgentSystemPrompt(options: {
  schemas?: TableSchema[];
  dbType?: string;
  skillDescriptions?: string;
  mcpDescriptions?: string;
}): string {
  const lines: string[] = [];

  lines.push(`你是一个智能数据助手，能够帮助用户完成各种数据分析和处理任务。你可以使用提供的工具来完成任务。`);
  lines.push('');
  lines.push('使用工具的原则：');
  lines.push('1. 仔细理解用户的需求，选择合适的工具');
  lines.push('2. 一步一步地完成任务，每次工具调用后【必须检查结果】');
  lines.push('3. 如果任务需要多个步骤，规划好执行顺序');
  lines.push('4. 完成任务后，向用户总结完成的工作');
  lines.push('');
  lines.push('【错误处理】：');
  lines.push('- 如果工具返回以"Error:"开头的结果，这表示操作【失败】');
  lines.push('- 遇到错误时，你【绝对不能】假装操作成功或编造数据');
  lines.push('- 你必须向用户说明发生了什么错误，并尝试用其他方法解决');
  lines.push('');
  lines.push('【数据可靠性 - 禁止伪造】：');
  lines.push('- 任何数值/表格/指标必须来自工具返回的真实数据');
  lines.push('- 如果数据缺失/未提供/无法读取，必须明确标注"暂无数据"');
  lines.push('');

  // 可用工具说明
  lines.push('工具调用协议：');
  lines.push('- 你可以通过 run_skill 调用技能：{ skill: "类别", action: "动作", args: {...} }');
  lines.push('- 你可以通过 execute_sql 直接对数据源执行 SQL 查询');
  lines.push('- 对于 array/object 类型参数：直接传 JSON 数组/对象');
  lines.push('');

  // 数据源上下文
  if (options.dbType) {
    lines.push(`当前数据源类型: ${options.dbType}`);
  }

  if (options.schemas && options.schemas.length > 0) {
    lines.push('');
    lines.push('当前数据源表结构：');
    for (const table of options.schemas.slice(0, 20)) {
      const cols = table.columns.slice(0, 30).map(c =>
        `${c.name}(${c.type.split('(')[0]}${c.comment ? ',' + c.comment : ''})`
      ).join(', ');
      lines.push(`- ${table.tableName}: ${cols}`);
    }
  }

  // 技能描述
  if (options.skillDescriptions) {
    lines.push('');
    lines.push('可用技能：');
    lines.push(options.skillDescriptions);
  }

  // MCP 工具描述
  if (options.mcpDescriptions) {
    lines.push('');
    lines.push('可用 MCP 工具：');
    lines.push(options.mcpDescriptions);
  }

  return lines.join('\n');
}
