/**
 * 技能服务层
 */

import type {
    SkillDefinition,
    SkillContext,
    SkillResult,
    SkillCategory,
    SkillListResponse,
    AgentCapabilities
} from './types';
import { SkillsRegistry } from './registry';

export class SkillsService {
    private registry: SkillsRegistry;

    constructor() {
        this.registry = new SkillsRegistry();
    }

    /**
     * 获取注册中心实例
     */
    getRegistry(): SkillsRegistry {
        return this.registry;
    }

    /**
     * 注册技能
     */
    registerSkill(skill: SkillDefinition): void {
        this.registry.register(skill);
    }

    /**
     * 批量注册技能
     */
    registerSkills(skills: SkillDefinition[]): void {
        this.registry.registerAll(skills);
    }

    /**
     * 获取技能列表
     */
    getSkillList(category?: SkillCategory): SkillListResponse {
        const skills = category
            ? this.registry.getByCategory(category)
            : this.registry.getAll();

        return {
            skills: skills.map(s => ({
                name: s.name,
                displayName: s.displayName,
                description: s.description,
                category: s.category,
                parameters: s.parameters
            })),
            categories: this.registry.getCategories(),
            total: skills.length
        };
    }

    /**
     * 获取技能详情
     */
    getSkill(name: string): SkillDefinition | undefined {
        return this.registry.get(name);
    }

    /**
     * 执行技能
     */
    async executeSkill(
        skillName: string,
        params: Record<string, any>,
        context: SkillContext
    ): Promise<SkillResult> {
        const startTime = Date.now();
        const result = await this.registry.execute(skillName, params, context);
        const executionTime = Date.now() - startTime;

        console.log(`[SkillsService] ${skillName} 执行完成，耗时: ${executionTime}ms`);

        return result;
    }

    /**
     * 获取技能描述（供 AI 使用）
     */
    getSkillDescriptions(): string {
        return this.registry.getSkillDescriptions();
    }

    /**
     * 获取 MCP 工具定义
     */
    getMCPTools(): any[] {
        return this.registry.getMCPTools();
    }

    /**
     * 获取 Agent 能力
     */
    getCapabilities(): AgentCapabilities {
        const skills = this.registry.getAll();
        const categories = new Set(skills.map(s => s.category));

        return {
            dataAnalysis: categories.has('data'),
            webCrawling: categories.has('crawler'),
            textProcessing: categories.has('document'),
            imageRecognition: categories.has('media'),
            documentGeneration: categories.has('document'),
            reportGeneration: categories.has('report'),
            mediaProcessing: categories.has('media')
        };
    }

    /**
     * 获取统计信息
     */
    getStats(): {
        totalSkills: number;
        skillsByCategory: Record<string, number>;
    } {
        const all = this.registry.getAll();
        const byCategory: Record<string, number> = {};

        for (const skill of all) {
            byCategory[skill.category] = (byCategory[skill.category] || 0) + 1;
        }

        return {
            totalSkills: all.length,
            skillsByCategory: byCategory
        };
    }
}

// 全局服务实例
export const skillsService = new SkillsService();
