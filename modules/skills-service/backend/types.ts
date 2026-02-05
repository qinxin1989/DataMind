/**
 * 技能服务类型定义
 */

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
    dataSource?: any;
    schemas?: any[];
    dbType?: string;
    workDir?: string;
    userId?: string;
    openai?: any;
    model?: string;
}

// 技能执行结果
export interface SkillResult {
    success: boolean;
    data?: any;
    message?: string;
    outputPath?: string;
    visualization?: {
        type: 'table' | 'bar' | 'line' | 'pie' | 'scatter' | 'image' | 'html';
        title?: string;
        data?: any;
        content?: string;
        xField?: string;
        yField?: string;
        config?: any;
    };
}

// 技能定义
export interface SkillDefinition {
    name: string;
    category: string;
    displayName: string;
    description: string;
    parameters: SkillParameter[];
    execute: (params: Record<string, any>, context: SkillContext) => Promise<SkillResult>;
}

// 技能分类
export type SkillCategory = 'data' | 'document' | 'media' | 'report' | 'crawler';

// 技能列表响应
export interface SkillListResponse {
    skills: Array<{
        name: string;
        displayName: string;
        description: string;
        category: string;
        parameters: SkillParameter[];
    }>;
    categories: SkillCategory[];
    total: number;
}

// 技能执行请求
export interface ExecuteSkillRequest {
    skillName: string;
    params: Record<string, any>;
    context?: Partial<SkillContext>;
}

// 技能执行响应
export interface ExecuteSkillResponse {
    success: boolean;
    result: SkillResult;
    executionTime: number;
}

// Agent 能力
export interface AgentCapabilities {
    dataAnalysis: boolean;
    webCrawling: boolean;
    textProcessing: boolean;
    imageRecognition: boolean;
    documentGeneration: boolean;
    reportGeneration: boolean;
    mediaProcessing: boolean;
}
