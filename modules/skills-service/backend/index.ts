/**
 * 技能服务模块入口
 */

import { createSkillsRoutes } from './routes';
import { skillsService, SkillsService } from './service';
import { SkillsRegistry } from './registry';

// 导入各分类技能（如果存在）
let dataSkills: any[] = [];
let documentSkills: any[] = [];
let mediaSkills: any[] = [];
let reportSkills: any[] = [];

// 动态加载技能
async function loadSkills() {
    try {
        const data = await import('./data');
        dataSkills = data.dataSkills || [];
        skillsService.registerSkills(dataSkills);
        console.log(`[Skills] 注册 ${dataSkills.length} 个数据技能`);
    } catch (e) {
        console.log('[Skills] 数据技能未找到，跳过');
    }

    try {
        const doc = await import('./document');
        documentSkills = doc.documentSkills || [];
        skillsService.registerSkills(documentSkills);
        console.log(`[Skills] 注册 ${documentSkills.length} 个文档技能`);
    } catch (e) {
        console.log('[Skills] 文档技能未找到，跳过');
    }

    try {
        const media = await import('./media');
        mediaSkills = media.mediaSkills || [];
        skillsService.registerSkills(mediaSkills);
        console.log(`[Skills] 注册 ${mediaSkills.length} 个媒体技能`);
    } catch (e) {
        console.log('[Skills] 媒体技能未找到，跳过');
    }

    try {
        const report = await import('./report');
        reportSkills = report.reportSkills || [];
        skillsService.registerSkills(reportSkills);
        console.log(`[Skills] 注册 ${reportSkills.length} 个报告技能`);
    } catch (e) {
        console.log('[Skills] 报告技能未找到，跳过');
    }

    console.log(`[Skills] 总计注册 ${skillsService.getRegistry().getAll().length} 个技能`);
}

export interface SkillsModuleOptions {
    autoRegister?: boolean;  // 是否自动注册内置技能
}

export function initSkillsModule(options: SkillsModuleOptions = {}) {
    const { autoRegister = true } = options;

    // 自动注册内置技能
    if (autoRegister) {
        loadSkills();
    }

    return {
        routes: createSkillsRoutes(),
        name: 'skills-service',
        version: '1.0.0',

        // 提供服务实例
        service: skillsService,

        // 提供注册中心
        registry: skillsService.getRegistry()
    };
}

// 导出所有类型和服务
export * from './types';
export { skillsService, SkillsService } from './service';
export { SkillsRegistry } from './registry';
