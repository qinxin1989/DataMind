/**
 * Skills Registry - 技能注册中心
 * 统一管理所有技能的注册、发现和执行
 */

import { BaseDataSource } from '../../datasource';
import { TableSchema } from '../../types';

// 技能参数定义
export interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: any;
}

// 技能执行上下文
export interface SkillContext {
  dataSource?: BaseDataSource;
  schemas?: TableSchema[];
  dbType?: string;
  workDir?: string;  // 工作目录
  userId?: string;   // 用户ID
}

// 技能执行结果
export interface SkillResult {
  success: boolean;
  data?: any;
  message?: string;
  outputPath?: string;  // 输出文件路径
  visualization?: {
    type: 'table' | 'bar' | 'line' | 'pie' | 'scatter' | 'image';
    title?: string;
    xField?: string;
    yField?: string;
    data: any[];
  };
}

// 技能定义
export interface SkillDefinition {
  name: string;           // 技能ID，如 data.query
  category: string;       // 分类：data, document, media, report
  displayName: string;    // 显示名称
  description: string;    // 描述
  parameters: SkillParameter[];
  execute: (params: Record<string, any>, context: SkillContext) => Promise<SkillResult>;
}

// 技能分类
export type SkillCategory = 'data' | 'document' | 'media' | 'report';

// 技能注册中心
export class SkillsRegistry {
  private skills = new Map<string, SkillDefinition>();
  private categories = new Map<SkillCategory, SkillDefinition[]>();

  constructor() {
    // 初始化分类
    this.categories.set('data', []);
    this.categories.set('document', []);
    this.categories.set('media', []);
    this.categories.set('report', []);
  }

  // 注册技能
  register(skill: SkillDefinition): void {
    this.skills.set(skill.name, skill);
    
    // 添加到分类
    const category = skill.category as SkillCategory;
    if (this.categories.has(category)) {
      this.categories.get(category)!.push(skill);
    }
    
    console.log(`[SkillsRegistry] Registered skill: ${skill.name}`);
  }

  // 批量注册
  registerAll(skills: SkillDefinition[]): void {
    for (const skill of skills) {
      this.register(skill);
    }
  }

  // 获取技能
  get(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  // 获取所有技能
  getAll(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  // 按分类获取技能
  getByCategory(category: SkillCategory): SkillDefinition[] {
    return this.categories.get(category) || [];
  }

  // 获取所有分类
  getCategories(): SkillCategory[] {
    return Array.from(this.categories.keys());
  }

  // 执行技能
  async execute(
    skillName: string,
    params: Record<string, any>,
    context: SkillContext
  ): Promise<SkillResult> {
    const skill = this.skills.get(skillName);
    
    if (!skill) {
      return {
        success: false,
        message: `技能不存在: ${skillName}`
      };
    }

    // 验证必填参数
    for (const param of skill.parameters) {
      if (param.required && !(param.name in params)) {
        // 使用默认值
        if (param.default !== undefined) {
          params[param.name] = param.default;
        } else {
          return {
            success: false,
            message: `缺少必填参数: ${param.name}`
          };
        }
      }
    }

    try {
      console.log(`[SkillsRegistry] Executing skill: ${skillName}`, params);
      const result = await skill.execute(params, context);
      console.log(`[SkillsRegistry] Skill ${skillName} completed:`, result.success);
      return result;
    } catch (error: any) {
      console.error(`[SkillsRegistry] Skill ${skillName} failed:`, error);
      return {
        success: false,
        message: `技能执行失败: ${error.message}`
      };
    }
  }

  // 获取技能描述（供 AI 选择）
  getSkillDescriptions(): string {
    const descriptions: string[] = [];
    
    for (const category of this.getCategories()) {
      const skills = this.getByCategory(category);
      if (skills.length === 0) continue;
      
      descriptions.push(`\n## ${category.toUpperCase()} 技能`);
      
      for (const skill of skills) {
        const params = skill.parameters
          .map(p => `${p.name}(${p.type}${p.required ? ',必填' : ''}): ${p.description}`)
          .join('; ');
        descriptions.push(`- ${skill.name}: ${skill.description}`);
        descriptions.push(`  参数: ${params}`);
      }
    }
    
    return descriptions.join('\n');
  }

  // 获取 MCP 工具定义
  getMCPTools(): any[] {
    return this.getAll().map(skill => ({
      name: skill.name.replace('.', '_'),
      description: skill.description,
      inputSchema: {
        type: 'object',
        properties: skill.parameters.reduce((acc, param) => {
          acc[param.name] = {
            type: param.type === 'array' ? 'array' : param.type,
            description: param.description,
            default: param.default
          };
          return acc;
        }, {} as Record<string, any>),
        required: skill.parameters.filter(p => p.required).map(p => p.name)
      }
    }));
  }
}

// 全局技能注册中心实例
export const skillsRegistry = new SkillsRegistry();
