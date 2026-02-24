/**
 * Error Reflection - 工具错误反思机制
 * 移植自 ai-agent-plus: 工具失败自动分类 → 注入诊断提示 → LLM 自我修正
 */

export type ToolErrorCategory =
  | 'bad_arguments'
  | 'invalid_skill_call'
  | 'unknown_skill'
  | 'unknown_tool'
  | 'missing_file'
  | 'permission'
  | 'timeout'
  | 'missing_dependency'
  | 'nonzero_exit'
  | 'unknown';

/**
 * 对工具返回的错误文本进行分类
 */
export function classifyToolError(result: string): ToolErrorCategory {
  const t = (result || '').toLowerCase();

  if (t.includes('无法解析') || (t.includes('json') && t.includes('parse'))) return 'bad_arguments';
  if (t.includes('缺少必填参数') || t.includes('未知参数') || t.includes('类型不匹配')) return 'bad_arguments';
  if (t.includes('missing required') || t.includes('unknown args') || t.includes('invalid type for')) return 'bad_arguments';

  if (t.includes('run_skill.skill must be') || t.includes('run_skill.action must be')) return 'invalid_skill_call';
  if (t.includes('invalid run_skill payload') || t.includes('run_skill.args must be')) return 'invalid_skill_call';

  if (t.includes('unknown skill') || t.includes('unknown action') || t.includes('技能不存在')) return 'unknown_skill';
  if (t.includes('未知工具') || t.includes('unknown tool')) return 'unknown_tool';

  if (t.includes('文件不存在') || t.includes('no such file') || t.includes('enoent')) return 'missing_file';
  if (t.includes('permission') || t.includes('权限') || t.includes('access is denied') || t.includes('eperm')) return 'permission';
  if (t.includes('timeout') || t.includes('超时') || t.includes('etimedout')) return 'timeout';
  if (t.includes('module') && t.includes('not found')) return 'missing_dependency';
  if (t.includes('返回非零') || t.includes('exit code') || t.includes('exited with')) return 'nonzero_exit';

  return 'unknown';
}

/**
 * 根据错误分类生成中文诊断建议
 */
export function buildToolErrorGuidance(toolName: string, args: Record<string, any>, result: string): string {
  const category = classifyToolError(result);
  let argsPreview = '';
  try {
    argsPreview = JSON.stringify(args || {});
  } catch {
    argsPreview = String(args);
  }

  switch (category) {
    case 'bad_arguments':
      return '【建议】优先检查工具参数是否正确、字段名是否正确、必填参数是否缺失。';
    case 'invalid_skill_call':
      return '【建议】run_skill 调用缺少必要字段。请明确 skill 与 action，或先列出可用技能/动作。';
    case 'unknown_skill':
      return '【建议】技能或动作不存在。请从已提供的技能/动作列表中选择，或让我先列出可用技能。';
    case 'unknown_tool':
      return '【建议】你调用了不存在的工具。请先列出可用工具或改用 run_skill。';
    case 'missing_file':
      return '【建议】路径可能写错或文件未生成。请先用 file.list_directory 确认文件是否存在，再重试。';
    case 'permission':
      return '【建议】可能权限不足或文件被占用。请检查文件是否被打开、是否需要管理员权限。';
    case 'timeout':
      return '【建议】可能网络或系统卡顿导致超时。可尝试增大 timeout 或减少数据量。';
    case 'missing_dependency':
      return '【建议】环境缺少依赖。请输出缺失库名，并指导用户安装。';
    case 'nonzero_exit':
      return '【建议】命令执行失败。请先阅读错误输出，定位报错行，再决定修复后重试。';
    default:
      return `【建议】先复述错误要点，再根据参数与环境做定位。tool=${toolName}, args=${argsPreview.slice(0, 300)}`;
  }
}

/**
 * 构建错误反思 system message，注入到消息列表中引导 LLM 自我修正
 */
export function buildReflexMessage(toolName: string, args: Record<string, any>, result: string): { role: 'system'; content: string } {
  const guidance = buildToolErrorGuidance(toolName, args, result);
  const content =
    '你刚刚的工具调用失败了。下一轮回复必须先做【诊断闭环】而不是盲试：\n' +
    '1) 用一句话复述失败点（工具/关键参数/错误摘要）\n' +
    '2) 给出1-3个最可能原因（基于错误文本与参数）\n' +
    '3) 选择一个最小代价的验证动作（例如列目录/检查路径/重试并调整参数）\n' +
    '4) 再执行下一步工具。\n' +
    guidance;
  return { role: 'system', content };
}

/**
 * 判断结果是否为错误（以 Error: 开头）
 */
export function isToolError(result: string): boolean {
  return (result || '').trimStart().toLowerCase().startsWith('error:');
}

/**
 * 增强错误结果文本，使 LLM 更容易注意到
 */
export function enhanceErrorResult(result: string, toolName: string, args: Record<string, any>): string {
  const guidance = buildToolErrorGuidance(toolName, args, result);
  return `【操作失败】${result}\n【重要提示】此操作未成功，请勿假设数据已获取或操作已完成。\n${guidance}`;
}
