/**
 * Prompt Builder
 * 根据 DeclarativeSkillRegistry 中注册的技能构建 system prompt
 */

import { DeclarativeSkillRegistry } from './declarativeRegistry';
import { RunSkillRouter } from './router';
import { ParamSpec } from './specs';

function formatDefault(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v === '' ? '' : ` default=${JSON.stringify(v)}`;
  return ` default=${v}`;
}

/**
 * 构建包含声明式技能目录的 system prompt
 */
export function buildDeclarativeSystemPrompt(
  basePrompt: string,
  registry: DeclarativeSkillRegistry,
  router?: RunSkillRouter
): string {
  const lines: string[] = [basePrompt.trimEnd()];

  lines.push('\n工具调用协议：');
  lines.push('- 你只能通过调用工具 run_skill 来执行任何真实操作');
  lines.push('- run_skill 参数: { skill: string, action: string, args: object }');
  lines.push('- 工具调用后必须检查返回结果；若返回以 \'Error:\' 开头表示失败');
  lines.push('- 对于 array/object 类型参数：直接传 JSON 数组/对象，不要把 JSON 再序列化为字符串');

  const skills = registry.listSkills().sort((a, b) => a.name.localeCompare(b.name));
  if (skills.length > 0) {
    lines.push('\n可用技能：');
    for (const s of skills) {
      lines.push(`- ${s.name}: ${s.description || ''}`);
      if (s.actions.length > 0) {
        for (const a of s.actions) {
          lines.push(a.description ? `  - ${a.name}: ${a.description}` : `  - ${a.name}`);

          // 如果有 router，输出参数签名
          if (router) {
            const spec = router.getActionSpec(s.name, a.name);
            const params = spec?.parameters;
            if (params && params.length > 0) {
              const req = params.filter(p => p.required !== false);
              const opt = params.filter(p => p.required === false);

              if (req.length > 0) {
                lines.push('    args.required:');
                for (const p of req) {
                  lines.push(`      - ${formatParam(p)}`);
                }
              }
              if (opt.length > 0) {
                lines.push('    args.optional:');
                for (const p of opt) {
                  lines.push(`      - ${formatParam(p)}`);
                }
              }
            }
          }
        }
      }
    }

    // 技能详情（SKILL.md 正文）
    const withBody = skills.filter(s => s.body?.trim());
    if (withBody.length > 0) {
      lines.push('\n技能详情：');
      for (const s of withBody) {
        lines.push(`\n# Skill: ${s.name}`);
        if (s.description) lines.push(s.description);
        lines.push(s.body!.trim());
      }
    }
  }

  return lines.join('\n').trim() + '\n';
}

function formatParam(p: ParamSpec): string {
  const required = p.required !== false;
  const def = formatDefault(p.default);
  const enumStr = Array.isArray(p.enum) && p.enum.length > 0 ? ` enum=${JSON.stringify(p.enum)}` : '';
  let item = `${p.name}:${p.type}${required ? '!' : ''}${def}${enumStr}`;
  if (p.description) item += ` - ${p.description}`;
  return item;
}
