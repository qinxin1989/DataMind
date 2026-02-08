
import { ModuleContext } from '../../../../src/module-system/types';

export async function afterEnable(context?: ModuleContext): Promise<void> {
  console.log('[ai-crawler-assistant] Hook afterEnable executed');

  // 注册爬虫技能到 SkillsService
  try {
    // 动态导入以避免循环依赖或加载顺序问题
    // 路径说明: 
    // ./backend/hooks/afterEnable.ts -> ../../../ -> modules/
    // -> skills-service/backend/service
    const { skillsService } = require('../../../skills-service/backend/service');
    // -> ai-crawler-assistant/backend/skills
    const { crawlerSkills } = require('../skills');

    if (skillsService && crawlerSkills) {
      skillsService.registerSkills(crawlerSkills);
      console.log(`[ai-crawler-assistant] 已注册 ${crawlerSkills.length} 个爬虫技能到 SkillsService`);
    } else {
      console.error('[ai-crawler-assistant] 注册失败: 无法加载 skillsService 或 crawlerSkills');
    }
  } catch (e: any) {
    console.error(`[ai-crawler-assistant] 注册技能失败: ${e.message}`);
    // 打印堆栈以便调试路径问题
    console.error(e.stack);
  }
}
