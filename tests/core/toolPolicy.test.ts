import { describe, expect, it } from 'vitest';
import { executeRunSkill, getAgentTools, isSkillAllowed } from '../../src/agent/toolSchema';

describe('tool policy', () => {
  it('应根据前缀判断技能是否允许', () => {
    expect(isSkillAllowed('data.query', { allowedSkillPrefixes: ['data.'] })).toBe(true);
    expect(isSkillAllowed('crawler.extract', { allowedSkillPrefixes: ['data.'] })).toBe(false);
  });

  it('关闭 SQL 权限时不应暴露 execute_sql', () => {
    const tools = getAgentTools({ allowSql: false });
    const toolNames = tools.map(tool => tool.function.name);

    expect(toolNames).toContain('run_skill');
    expect(toolNames).not.toContain('execute_sql');
  });

  it('开启 SQL 权限时应暴露 execute_sql', () => {
    const tools = getAgentTools({ allowSql: true });
    const toolNames = tools.map(tool => tool.function.name);

    expect(toolNames).toContain('execute_sql');
  });

  it('被白名单拦截的技能不应执行', async () => {
    const result = await executeRunSkill(
      {
        skill: 'data',
        action: 'query',
        args: {},
      },
      {
        allowedSkillPrefixes: ['crawler.'],
      }
    );

    expect(result).toContain('不允许调用技能');
  });
});
