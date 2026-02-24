/**
 * 声明式技能规格定义
 * 对应 ai-agent-plus 的 ParamSpec / ActionSpec / SkillIndex
 */

export interface ParamSpec {
  name: string;
  type: string;        // 'string' | 'integer' | 'number' | 'boolean' | 'array' | 'object'
  description?: string;
  required?: boolean;
  default?: any;
  enum?: any[];
}

export interface ActionSpec {
  name: string;
  description?: string;
  parameters?: ParamSpec[];
  requiresConfirmation?: boolean;
}

export interface SkillIndex {
  /** 技能名称（如 file, excel, web） */
  name: string;
  description?: string;
  version?: string;
  /** 适配器类型：auto_legacy | legacy_skills | legacy_tools */
  adapter?: string;
  actions: ActionSpec[];
  /** SKILL.md 正文（frontmatter 之后的内容） */
  body?: string;
}
