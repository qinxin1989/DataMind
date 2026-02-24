/**
 * 声明式运行时 - 统一导出
 */

export { parseFrontmatter } from './frontmatter';
export type { FrontmatterResult } from './frontmatter';

export type { ParamSpec, ActionSpec, SkillIndex } from './specs';

export { DeclarativeSkillRegistry } from './declarativeRegistry';

export { RunSkillRouter } from './router';
export type { RouterContext } from './router';

export { buildDeclarativeSystemPrompt } from './prompt';
