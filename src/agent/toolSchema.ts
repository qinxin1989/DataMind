/**
 * Tool Schema - 统一工具适配层
 * 将 DataMind 的 SkillsRegistry + MCPRegistry 适配为 OpenAI function-calling tools 格式
 * 核心：桥接数据源上下文（dataSource, schemas, dbType）到每个工具调用
 */

import * as path from 'path';
import { skillsRegistry, SkillContext, SkillResult } from './skills';
import type { SkillDefinition } from './skills';
import { mcpRegistry } from './mcp';
import { DeclarativeSkillRegistry } from './runtime/declarativeRegistry';
import { BaseDataSource } from '../datasource';
import { TableSchema } from '../types';

const declarativeRegistry = new DeclarativeSkillRegistry(path.join(process.cwd(), 'skills'));
const MAX_DECLARATIVE_BODY_LENGTH = 1200;
const MAX_DECLARATIVE_DESCRIPTION_TOTAL = 18000;

const SKILL_ALIAS_MAP: Record<string, string[]> = {
  data_analysis: ['dataAnalysis'],
  dataanalysis: ['dataAnalysis'],
  dataAnalysis: ['dataAnalysis'],
  image_ocr: ['imageOcr'],
  imageocr: ['imageOcr'],
  imageOcr: ['imageOcr'],
  doc_coauthoring: ['docCoauthoring'],
  'doc-coauthoring': ['docCoauthoring'],
  doccoauthoring: ['docCoauthoring'],
  docCoauthoring: ['docCoauthoring'],
  canvas_design: ['canvas'],
  'canvas-design': ['canvas'],
  canvasdesign: ['canvas'],
  canvas: ['canvas'],
  architecture_diagram: ['diagram'],
  'architecture-diagram': ['diagram'],
  architecturediagram: ['diagram'],
  diagram: ['diagram'],
  word: ['docx'],
  docx: ['docx'],
  excel: ['excel'],
  pdf: ['pdf'],
  pptx: ['pptx'],
  file: ['file'],
  shell: ['shell'],
  web: ['web'],
  data: ['data'],
  report: ['report'],
  qa: ['qa'],
  crawler: ['crawler'],
  document: ['document'],
  media: ['media'],
};

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
export interface ToolExecutionPolicy {
  allowSql?: boolean;
  allowedSkills?: string[];
  allowedSkillPrefixes?: string[];
  allowedMcpServers?: string[];
}

export function getAgentTools(policy?: ToolExecutionPolicy): any[] {
  const tools = [getRunSkillToolSchema()];
  if (policy?.allowSql !== false) {
    tools.push(getExecuteSqlToolSchema());
  }
  return tools;
}

// ========== 工具执行分发 ==========

export interface ToolExecutionContext extends ToolExecutionPolicy {
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

  const requestedSkillName = `${skill}.${action}`;
  const resolution = resolveRegisteredSkill(skill, action);
  const permissionCandidates = resolution
    ? [requestedSkillName, ...resolution.candidates]
    : [requestedSkillName];

  if (!permissionCandidates.some(candidate => isSkillAllowed(candidate, ctx))) {
    return `Error: 当前业务模式不允许调用技能: ${requestedSkillName}`;
  }

  // 1. 尝试 SkillsRegistry（格式：category.name 如 data.query）
  const registeredSkill = resolution?.skill
    || skillsRegistry.get(requestedSkillName)
    || skillsRegistry.get(skill);

  if (registeredSkill) {
    const normalizedArgs = normalizeSkillArgs(registeredSkill, args || {});
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
        normalizedArgs,
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
  if (!isMcpServerAllowed(skill, ctx)) {
    return `Error: 当前业务模式不允许调用 MCP 服务: ${skill}`;
  }

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
  if (ctx.allowSql === false) {
    return 'Error: 当前业务模式不允许执行 SQL';
  }

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
  assistantName?: string;
  assistantDescription?: string;
  extraInstructions?: string;
  sessionContext?: string;
}): string {
  const lines: string[] = [];

  lines.push(`你是一个智能助手，能够帮助用户完成不同业务场景下的分析和处理任务。你可以使用提供的工具来完成任务。`);
  if (options.assistantName) {
    lines.push(`当前激活助手: ${options.assistantName}`);
  }
  if (options.assistantDescription) {
    lines.push(`助手职责: ${options.assistantDescription}`);
  }
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
  lines.push('- 任何真实操作（读写文件、处理网页、修改文档、生成图表、批量分析）都应优先通过工具完成，不要只停留在口头建议。');
  lines.push('- 你可以通过 run_skill 调用技能：{ skill: "类别", action: "动作", args: {...} }');
  lines.push('- 只有当前模式允许时，才可以通过 execute_sql 直接对数据源执行 SQL 查询');
  lines.push('- 对于 array/object 类型参数：直接传 JSON 数组/对象');
  lines.push('- 兼容旧技能命名，例如 data_analysis.execute_python、word.read_word、pptx.pptx_inventory 也可以直接调用');
  lines.push('- 如果用户目标是得到结果文件、批注结果、修订结果、图表或提取内容，就继续调用工具直到拿到可交付结果');
  lines.push('- 工具返回成功后，必须基于返回结果决定下一步，而不是忽略结果直接结束');
  lines.push('');

  if (options.extraInstructions) {
    lines.push('业务模式要求：');
    lines.push(options.extraInstructions);
    lines.push('');
  }

  if (options.sessionContext) {
    lines.push('当前会话摘要 / 长期上下文：');
    lines.push(options.sessionContext);
    lines.push('');
  }

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

export function getAllowedSkillDefinitions(policy?: ToolExecutionPolicy): SkillDefinition[] {
  const allSkills = skillsRegistry.getAll();
  return allSkills.filter(skill => isSkillAllowed(skill.name, policy));
}

export function getAllowedSkillDescriptions(policy?: ToolExecutionPolicy): string {
  const descriptions: string[] = [];
  const skills = getAllowedSkillDefinitions(policy);

  for (const skill of skills) {
    const params = skill.parameters
      .map(p => `${p.name}(${p.type}${p.required ? ',必填' : ''}): ${p.description}`)
      .join('; ');
    descriptions.push(`- ${skill.name}: ${skill.description}`);
    descriptions.push(`  参数: ${params}`);
  }

  const declarativeDescriptions = getAllowedDeclarativeSkillDescriptions(policy);
  if (declarativeDescriptions) {
    descriptions.push('');
    descriptions.push('声明式技能工作流：');
    descriptions.push(declarativeDescriptions);
  }

  return descriptions.join('\n');
}

export function isSkillAllowed(skillName: string, policy?: ToolExecutionPolicy): boolean {
  const allowedSkills = policy?.allowedSkills;
  const allowedSkillPrefixes = policy?.allowedSkillPrefixes;

  if ((!allowedSkills || allowedSkills.length === 0) && (!allowedSkillPrefixes || allowedSkillPrefixes.length === 0)) {
    return true;
  }

  if (allowedSkills?.includes(skillName)) {
    return true;
  }

  return (allowedSkillPrefixes || []).some(prefix => skillName.startsWith(prefix));
}

function isMcpServerAllowed(serverName: string, policy?: ToolExecutionPolicy): boolean {
  if (!policy?.allowedMcpServers || policy.allowedMcpServers.length === 0) {
    return true;
  }
  return policy.allowedMcpServers.includes(serverName);
}

function resolveRegisteredSkill(skill: string, action: string): {
  skill: SkillDefinition;
  candidates: string[];
} | null {
  const candidates = buildSkillCandidates(skill, action);

  for (const candidate of candidates) {
    const registered = skillsRegistry.get(candidate);
    if (registered) {
      return {
        skill: registered,
        candidates,
      };
    }
  }

  return null;
}

function buildSkillCandidates(skill: string, action: string): string[] {
  const skillVariants = expandSkillAliases(skill);
  const actionVariants = expandActionAliases(skill, action);
  const candidates = new Set<string>([`${skill}.${action}`]);

  for (const skillVariant of skillVariants) {
    for (const actionVariant of actionVariants) {
      candidates.add(`${skillVariant}.${actionVariant}`);
    }
  }

  return Array.from(candidates);
}

function expandSkillAliases(skill: string): string[] {
  const raw = (skill || '').trim();
  const normalized = raw.replace(/\s+/g, '');
  const normalizedKey = normalized.toLowerCase();
  const variants = new Set<string>();

  for (const value of [raw, normalized, normalized.replace(/-/g, '_'), normalized.replace(/_/g, '-')]) {
    if (value) {
      variants.add(value);
      variants.add(toCamelCase(value));
    }
  }

  const aliases = SKILL_ALIAS_MAP[raw]
    || SKILL_ALIAS_MAP[normalized]
    || SKILL_ALIAS_MAP[normalizedKey]
    || [];

  aliases.forEach(alias => variants.add(alias));

  return Array.from(variants).filter(Boolean);
}

function expandActionAliases(skill: string, action: string): string[] {
  const raw = (action || '').trim();
  const normalized = raw.replace(/\s+/g, '');
  const variants = new Set<string>();

  for (const value of [raw, normalized, normalized.replace(/-/g, '_'), normalized.replace(/_/g, '-')]) {
    if (value) {
      variants.add(value);
      variants.add(toCamelCase(value));
    }
  }

  const normalizedSkillNames = expandSkillAliases(skill)
    .map(item => item.toLowerCase().replace(/[.\-]/g, '_'));

  for (const skillName of normalizedSkillNames) {
    const prefix = `${skillName}_`;
    const normalizedAction = normalized.toLowerCase().replace(/[.\-]/g, '_');
    if (normalizedAction.startsWith(prefix)) {
      const stripped = normalizedAction.slice(prefix.length);
      if (stripped) {
        variants.add(stripped);
        variants.add(toCamelCase(stripped));
      }
    }
  }

  return Array.from(variants).filter(Boolean);
}

function normalizeSkillArgs(skill: SkillDefinition, args: Record<string, any>): Record<string, any> {
  const normalizedArgs: Record<string, any> = { ...(args || {}) };
  const paramNames = new Set(skill.parameters.map(param => param.name));

  for (const [key, value] of Object.entries(args || {})) {
    if (paramNames.has(key)) {
      continue;
    }

    const candidateKeys = new Set<string>([
      toCamelCase(key),
      key.replace(/^pdfPath$/i, 'path'),
      key.replace(/^pptxPath$/i, 'path'),
      key.replace(/^docPath$/i, 'path'),
      key.replace(/^inputPath$/i, 'path'),
      key.replace(/^outputPath$/i, 'path'),
    ]);

    for (const candidateKey of candidateKeys) {
      if (paramNames.has(candidateKey) && normalizedArgs[candidateKey] === undefined) {
        normalizedArgs[candidateKey] = value;
        break;
      }
    }
  }

  if (skill.name === 'docx.generateWordReport') {
    if (normalizedArgs.title === undefined && normalizedArgs.report_title !== undefined) {
      normalizedArgs.title = normalizedArgs.report_title;
    }
    if (normalizedArgs.outputPath === undefined && normalizedArgs.output_path !== undefined) {
      normalizedArgs.outputPath = normalizedArgs.output_path;
    }
  }

  return normalizedArgs;
}

function getAllowedDeclarativeSkillDescriptions(policy?: ToolExecutionPolicy): string {
  let totalLength = 0;
  const lines: string[] = [];

  for (const skill of declarativeRegistry.listSkills().sort((a, b) => a.name.localeCompare(b.name))) {
    const allowedActions = skill.actions.filter(action =>
      buildSkillCandidates(skill.name, action.name).some(candidate => isSkillAllowed(candidate, policy))
    );

    if (allowedActions.length === 0) {
      continue;
    }

    const summaryLines = [`- ${skill.name}: ${skill.description || '暂无描述'}`];

    for (const action of allowedActions) {
      const actionParts = [`  - ${action.name}${action.description ? `: ${action.description}` : ''}`];
      const params = getRegisteredActionParameters(skill.name, action.name);
      if (params) {
        actionParts.push(`参数: ${params}`);
      }
      summaryLines.push(actionParts.join(' | '));
    }

    const compactBody = compactDeclarativeBody(skill.body);
    if (compactBody) {
      summaryLines.push(`  工作流: ${compactBody}`);
    }

    const joined = summaryLines.join('\n');
    if (totalLength + joined.length > MAX_DECLARATIVE_DESCRIPTION_TOTAL) {
      break;
    }

    lines.push(joined);
    totalLength += joined.length;
  }

  return lines.join('\n');
}

function compactDeclarativeBody(body?: string): string {
  if (!body) {
    return '';
  }

  const compact = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 10)
    .join(' ');

  if (!compact) {
    return '';
  }

  return compact.length > MAX_DECLARATIVE_BODY_LENGTH
    ? `${compact.slice(0, MAX_DECLARATIVE_BODY_LENGTH)}...`
    : compact;
}

function toCamelCase(value: string): string {
  return value.replace(/[-_]+([a-zA-Z0-9])/g, (_, char: string) => char.toUpperCase());
}

function getRegisteredActionParameters(skill: string, action: string): string {
  const parts = new Set<string>();

  for (const candidate of buildSkillCandidates(skill, action)) {
    const registered = skillsRegistry.get(candidate);
    if (!registered || !registered.parameters?.length) {
      continue;
    }

    for (const parameter of registered.parameters) {
      parts.add(
        `${parameter.name}(${parameter.type}${parameter.required ? ',必填' : ''})${parameter.description ? `: ${parameter.description}` : ''}`
      );
    }
  }

  return Array.from(parts).join('; ');
}
