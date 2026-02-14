/**
 * Agent Skills - 技能系统入口
 * 统一导出所有技能和注册中心
 */

import { skillsRegistry, SkillsRegistry, SkillDefinition, SkillContext, SkillResult, SkillParameter, SkillCategory } from './registry';
import { dataSkills } from './data';
import { documentSkills } from './document';
import { mediaSkills } from './media';
import { reportSkills } from './report';
import { crawlerSkills } from './crawler';
import { qaSkills } from './qa';

// 注册所有技能
export function registerAllSkills() {
  console.log('[Skills] Registering all skills...');

  // 注册数据技能
  skillsRegistry.registerAll(dataSkills);
  console.log(`[Skills] Registered ${dataSkills.length} data skills`);

  // 注册文档技能
  skillsRegistry.registerAll(documentSkills);
  console.log(`[Skills] Registered ${documentSkills.length} document skills`);

  // 注册媒体技能
  skillsRegistry.registerAll(mediaSkills);
  console.log(`[Skills] Registered ${mediaSkills.length} media skills`);

  // 注册报告技能
  skillsRegistry.registerAll(reportSkills);
  console.log(`[Skills] Registered ${reportSkills.length} report skills`);

  // 注册问答技能
  skillsRegistry.registerAll(qaSkills);
  console.log(`[Skills] Registered ${qaSkills.length} qa skills`);

  // 注册爬虫技能 (使用已更新的本地实现)
  skillsRegistry.registerAll(crawlerSkills);
  console.log(`[Skills] Registered ${crawlerSkills.length} crawler skills`);

  console.log(`[Skills] Total skills registered: ${skillsRegistry.getAll().length}`);
}

// 初始化时注册所有技能
registerAllSkills();

// 导出
export {
  skillsRegistry,
  SkillsRegistry,
  SkillDefinition,
  SkillContext,
  SkillResult,
  SkillParameter,
  SkillCategory,
  dataSkills,
  documentSkills,
  mediaSkills,
  reportSkills,
  qaSkills,
  crawlerSkills
};

// 默认导出注册中心
export default skillsRegistry;
