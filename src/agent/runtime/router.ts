/**
 * RunSkill Router
 * 接收 LLM 的 run_skill { skill, action, args } 调用，路由到正确的执行后端
 * 在 DataMind 中，执行后端是 SkillsRegistry 和 MCPRegistry（而非 Python legacy provider）
 */

import { DeclarativeSkillRegistry } from './declarativeRegistry';
import { ActionSpec, ParamSpec } from './specs';
import { skillsRegistry, SkillContext } from '../skills';
import { mcpRegistry } from '../mcp';
import { BaseDataSource } from '../../datasource';
import { TableSchema } from '../../types';

export interface RouterContext {
  dataSource?: BaseDataSource;
  schemas?: TableSchema[];
  dbType?: string;
  openai?: any;
  model?: string;
  workDir?: string;
  userId?: string;
}

export class RunSkillRouter {
  constructor(
    public readonly registry: DeclarativeSkillRegistry,
  ) {}

  /**
   * 执行 run_skill 调用
   */
  async execute(
    payload: { skill: string; action: string; args: Record<string, any> },
    ctx: RouterContext
  ): Promise<string> {
    const { skill, action, args } = payload;

    if (!skill || typeof skill !== 'string') {
      return 'Error: run_skill.skill must be a non-empty string';
    }
    if (!action || typeof action !== 'string') {
      return 'Error: run_skill.action must be a non-empty string';
    }

    const skillSpec = this.registry.getSkill(skill);
    if (!skillSpec) {
      const known = this.registry.listSkills().map(s => s.name).sort().join(', ');
      return known
        ? `Error: unknown skill: ${skill}. Known skills: ${known}`
        : `Error: unknown skill: ${skill}`;
    }

    // 校验 action 是否在声明的 actions 列表中
    if (skillSpec.actions.length > 0) {
      const allowed = new Set(skillSpec.actions.map(a => a.name));
      if (!allowed.has(action)) {
        const allowedStr = Array.from(allowed).sort().join(', ');
        return `Error: unknown action '${action}' for skill '${skill}'. Allowed: ${allowedStr}`;
      }
    }

    // 尝试 SkillsRegistry
    const skillName = `${skill}.${action}`;
    const registered = skillsRegistry.get(skillName) || skillsRegistry.get(action);
    if (registered) {
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
        const result = await skillsRegistry.execute(registered.name, args || {}, skillCtx);
        if (!result.success) return `Error: ${result.message || '技能执行失败'}`;
        return formatResult(result);
      } catch (e: any) {
        return `Error: 技能执行异常: ${e.message}`;
      }
    }

    // 尝试 MCPRegistry
    const allMcpTools = mcpRegistry.getAllTools();
    const mcpKey = `${skill}__${action}`;
    const mcpMatch = allMcpTools.find(t => `${t.serverName}__${t.tool.name}` === mcpKey);
    if (mcpMatch) {
      try {
        const mcpResult = await mcpRegistry.callTool(skill, action, args || {});
        if (mcpResult.isError) return `Error: ${mcpResult.content.map((c: any) => c.text).join('\n')}`;
        return mcpResult.content.map((c: any) => c.text).join('\n');
      } catch (e: any) {
        return `Error: MCP 工具执行异常: ${e.message}`;
      }
    }

    return `Error: no adapter found for ${skill}.${action}`;
  }

  /**
   * 获取某个 action 的参数规格（用于 prompt 构建）
   */
  getActionSpec(skill: string, action: string): ActionSpec | undefined {
    const skillSpec = this.registry.getSkill(skill);
    if (!skillSpec) return undefined;
    return skillSpec.actions.find(a => a.name === action);
  }
}

function formatResult(result: any): string {
  const parts: string[] = [];
  if (result.message) parts.push(result.message);
  if (result.outputPath) parts.push(`输出文件: ${result.outputPath}`);
  if (result.data) {
    const dataStr = typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2);
    parts.push(dataStr.length > 6000 ? dataStr.slice(0, 6000) + '\n...(截断)' : dataStr);
  }
  return parts.join('\n') || '技能执行成功';
}
