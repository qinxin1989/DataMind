/**
 * Doc Coauthoring Skill - 文档协作工作流
 * 移植并扩展自 ai-agent-plus doc-coauthoring
 * 支持上下文收集、结构规划、分节起草、读者测试与修订合并
 */

import * as fs from 'fs';
import * as path from 'path';
import { SkillDefinition, SkillContext } from '../registry';

function pickParam<T = any>(params: Record<string, any>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (params[key] !== undefined) {
      return params[key] as T;
    }
  }
  return undefined;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? '').trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function resolveOutputPath(outputPath: string, ctx?: SkillContext): string {
  if (path.isAbsolute(outputPath)) {
    return outputPath;
  }
  return path.resolve(ctx?.workDir || process.cwd(), outputPath);
}

function getDefaultSections(docType: string): string[] {
  const normalized = docType.toLowerCase();

  if (/(prd|需求|产品|proposal|方案建议)/.test(normalized)) {
    return ['背景与目标', '用户问题', '范围说明', '方案概述', '实施计划', '风险与待确认事项'];
  }

  if (/(rfc|设计|decision|spec|技术|架构)/.test(normalized)) {
    return ['背景', '问题定义', '约束条件', '候选方案', '推荐方案', '影响范围', '风险与回滚', '开放问题'];
  }

  if (/(复盘|总结|报告)/.test(normalized)) {
    return ['背景', '关键事实', '分析结论', '经验教训', '后续动作'];
  }

  return ['背景', '目标', '核心方案', '实施步骤', '风险', '待确认事项'];
}

async function runPrompt(
  ctx: SkillContext | undefined,
  userPrompt: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  if (!ctx?.openai || !ctx?.model) {
    throw new Error('需要 OpenAI 实例来执行文档协作流程');
  }

  const response = await ctx.openai.chat.completions.create({
    model: ctx.model,
    messages: [
      {
        role: 'system',
        content: [
          '你是资深文档协作助手，擅长把复杂想法整理成对外可读的文档。',
          '请避免空话和泛泛而谈，优先输出结构化、可执行、可迭代的内容。',
          '默认使用中文输出，保持标题清楚、分点明确、能直接进入下一步写作。'
        ].join('\n'),
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    max_tokens: options?.maxTokens ?? 2400,
    temperature: options?.temperature ?? 0.4,
  });

  return response.choices?.[0]?.message?.content || '';
}

const createScaffold: SkillDefinition = {
  name: 'docCoauthoring.createScaffold',
  category: 'document',
  displayName: '创建文档脚手架',
  description: '根据文档类型和章节结构生成 Markdown 脚手架，可直接落盘为文件',
  parameters: [
    { name: 'title', type: 'string', description: '文档标题', required: true },
    { name: 'docType', type: 'string', description: '文档类型，如 PRD / RFC / 方案 / 设计文档', required: false },
    { name: 'audience', type: 'string', description: '目标读者', required: false },
    { name: 'sections', type: 'array', description: '章节列表，可选', required: false },
    { name: 'outputPath', type: 'string', description: '可选：输出 Markdown 路径', required: false },
  ],
  execute: async (params, ctx) => {
    const title = pickParam<string>(params, 'title') || '未命名文档';
    const docType = pickParam<string>(params, 'docType', 'doc_type') || '通用文档';
    const audience = pickParam<string>(params, 'audience') || '待补充';
    const sections = normalizeStringArray(pickParam(params, 'sections'));
    const finalSections = sections.length > 0 ? sections : getDefaultSections(docType);

    const scaffold = [
      `# ${title}`,
      '',
      `- 文档类型：${docType}`,
      `- 目标读者：${audience}`,
      `- 创建时间：${new Date().toISOString().slice(0, 10)}`,
      '',
      ...finalSections.flatMap((section) => [
        `## ${section}`,
        '',
        '[待补充]',
        '',
      ]),
    ].join('\n');

    const outputPath = pickParam<string>(params, 'outputPath', 'output_path');
    if (outputPath) {
      const resolvedPath = resolveOutputPath(outputPath, ctx);
      fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
      fs.writeFileSync(resolvedPath, scaffold, 'utf-8');
      return {
        success: true,
        data: scaffold,
        outputPath: resolvedPath,
        message: `已创建文档脚手架: ${resolvedPath}`,
      };
    }

    return {
      success: true,
      data: scaffold,
      message: `已生成 ${finalSections.length} 个章节的文档脚手架`,
    };
  },
};

const collectContext: SkillDefinition = {
  name: 'docCoauthoring.collectContext',
  category: 'document',
  displayName: '收集文档上下文',
  description: '根据已知背景整理文档上下文、缺失信息和澄清问题',
  parameters: [
    { name: 'docType', type: 'string', description: '文档类型', required: true },
    { name: 'audience', type: 'string', description: '目标读者', required: false },
    { name: 'desiredImpact', type: 'string', description: '读者读完后的预期效果', required: false },
    { name: 'constraints', type: 'string', description: '限制条件', required: false },
    { name: 'contextDump', type: 'string', description: '已有背景信息或资料汇总', required: true },
  ],
  execute: async (params, ctx) => {
    try {
      const result = await runPrompt(
        ctx,
        `请把下面这份文档写作背景，整理成“上下文收集结果”。

文档类型：${pickParam<string>(params, 'docType', 'doc_type') || '未说明'}
目标读者：${pickParam<string>(params, 'audience') || '未说明'}
希望读者读完后的效果：${pickParam<string>(params, 'desiredImpact', 'desired_impact') || '未说明'}
限制条件：${pickParam<string>(params, 'constraints') || '未说明'}

背景信息：
${(pickParam<string>(params, 'contextDump', 'context_dump') || '').slice(0, 12000)}

请输出以下结构：
## 已知信息
## 缺失信息
## 建议优先澄清的问题（5-10条，编号）
## 建议下一步`,
        { maxTokens: 2200 }
      );

      return { success: true, data: result, message: '已完成文档上下文梳理' };
    } catch (error: any) {
      return { success: false, message: `Error: 上下文梳理失败: ${error.message}` };
    }
  },
};

const planStructure: SkillDefinition = {
  name: 'docCoauthoring.planStructure',
  category: 'document',
  displayName: '规划文档结构',
  description: '为文档生成章节结构、章节目的和推荐起草顺序',
  parameters: [
    { name: 'docType', type: 'string', description: '文档类型', required: true },
    { name: 'audience', type: 'string', description: '目标读者', required: false },
    { name: 'goal', type: 'string', description: '文档目标', required: false },
    { name: 'contextDump', type: 'string', description: '背景上下文', required: true },
    { name: 'template', type: 'string', description: '模板说明，可选', required: false },
  ],
  execute: async (params, ctx) => {
    try {
      const result = await runPrompt(
        ctx,
        `请为下面这份文档规划结构。

文档类型：${pickParam<string>(params, 'docType', 'doc_type') || '未说明'}
目标读者：${pickParam<string>(params, 'audience') || '未说明'}
文档目标：${pickParam<string>(params, 'goal') || '未说明'}
模板要求：${pickParam<string>(params, 'template') || '无'}

背景上下文：
${(pickParam<string>(params, 'contextDump', 'context_dump') || '').slice(0, 12000)}

请输出：
## 推荐章节结构
- 每节说明“为什么要有这一节”
## 推荐起草顺序
## 哪一节最适合先写
## Markdown 脚手架`,
        { maxTokens: 2400 }
      );

      return { success: true, data: result, message: '已生成文档结构规划' };
    } catch (error: any) {
      return { success: false, message: `Error: 结构规划失败: ${error.message}` };
    }
  },
};

const brainstormSection: SkillDefinition = {
  name: 'docCoauthoring.brainstormSection',
  category: 'document',
  displayName: '章节脑暴',
  description: '围绕某一章节输出澄清问题、候选要点和推荐优先内容',
  parameters: [
    { name: 'sectionName', type: 'string', description: '章节名', required: true },
    { name: 'docType', type: 'string', description: '文档类型', required: false },
    { name: 'documentGoal', type: 'string', description: '整份文档的目标', required: false },
    { name: 'contextDump', type: 'string', description: '相关背景', required: true },
    { name: 'currentOutline', type: 'string', description: '当前结构或其它章节摘要', required: false },
  ],
  execute: async (params, ctx) => {
    try {
      const result = await runPrompt(
        ctx,
        `请围绕文档章节做一轮高质量脑暴。

章节名：${pickParam<string>(params, 'sectionName', 'section_name') || '未命名章节'}
文档类型：${pickParam<string>(params, 'docType', 'doc_type') || '未说明'}
文档目标：${pickParam<string>(params, 'documentGoal', 'document_goal') || '未说明'}
当前结构：${pickParam<string>(params, 'currentOutline', 'current_outline') || '无'}

章节相关背景：
${(pickParam<string>(params, 'contextDump', 'context_dump') || '').slice(0, 12000)}

请输出：
## 需要先确认的问题（5-8条）
## 可写入本节的候选要点（8-15条，编号）
## 推荐优先保留的要点
## 本节常见的空话/重复风险`,
        { maxTokens: 2200 }
      );

      return { success: true, data: result, message: '已完成章节脑暴' };
    } catch (error: any) {
      return { success: false, message: `Error: 章节脑暴失败: ${error.message}` };
    }
  },
};

const draftSection: SkillDefinition = {
  name: 'docCoauthoring.draftSection',
  category: 'document',
  displayName: '起草章节',
  description: '根据选定要点起草某一章节，并附带可继续打磨的编辑建议',
  parameters: [
    { name: 'sectionName', type: 'string', description: '章节名', required: true },
    { name: 'docType', type: 'string', description: '文档类型', required: false },
    { name: 'audience', type: 'string', description: '目标读者', required: false },
    { name: 'tone', type: 'string', description: '写作口吻', required: false },
    { name: 'selectedPoints', type: 'array', description: '本节保留要点', required: true },
    { name: 'contextDump', type: 'string', description: '相关背景', required: true },
    { name: 'existingContent', type: 'string', description: '已有内容，可选', required: false },
  ],
  execute: async (params, ctx) => {
    try {
      const selectedPoints = normalizeStringArray(pickParam(params, 'selectedPoints', 'selected_points'));
      const result = await runPrompt(
        ctx,
        `请起草一段高质量文档章节内容。

章节名：${pickParam<string>(params, 'sectionName', 'section_name') || '未命名章节'}
文档类型：${pickParam<string>(params, 'docType', 'doc_type') || '未说明'}
目标读者：${pickParam<string>(params, 'audience') || '未说明'}
写作口吻：${pickParam<string>(params, 'tone') || '专业、清晰、克制'}

本节保留要点：
${selectedPoints.map((item, index) => `${index + 1}. ${item}`).join('\n') || '无'}

已有内容（如有）：
${(pickParam<string>(params, 'existingContent', 'existing_content') || '无').slice(0, 5000)}

背景信息：
${(pickParam<string>(params, 'contextDump', 'context_dump') || '').slice(0, 10000)}

请输出：
## 起草内容
## 可以继续精修的点（3-6条）
## 建议下一轮用户重点反馈什么`,
        { maxTokens: 2400 }
      );

      return { success: true, data: result, message: '已完成章节起草' };
    } catch (error: any) {
      return { success: false, message: `Error: 章节起草失败: ${error.message}` };
    }
  },
};

const reviseSection: SkillDefinition = {
  name: 'docCoauthoring.reviseSection',
  category: 'document',
  displayName: '精修章节',
  description: '根据用户反馈对章节做定向修改，输出修订稿和改动说明',
  parameters: [
    { name: 'sectionName', type: 'string', description: '章节名', required: true },
    { name: 'currentContent', type: 'string', description: '当前章节内容', required: true },
    { name: 'editInstructions', type: 'string', description: '修改要求或用户反馈', required: true },
    { name: 'contextDump', type: 'string', description: '相关背景，可选', required: false },
    { name: 'tone', type: 'string', description: '目标口吻，可选', required: false },
  ],
  execute: async (params, ctx) => {
    try {
      const result = await runPrompt(
        ctx,
        `请对文档章节做一次“外科式精修”，重点是按反馈修改，而不是整段重写到面目全非。

章节名：${pickParam<string>(params, 'sectionName', 'section_name') || '未命名章节'}
目标口吻：${pickParam<string>(params, 'tone') || '保持专业、清晰、克制'}

当前章节内容：
${(pickParam<string>(params, 'currentContent', 'current_content') || '').slice(0, 9000)}

修改要求：
${(pickParam<string>(params, 'editInstructions', 'edit_instructions') || '').slice(0, 6000)}

补充背景：
${(pickParam<string>(params, 'contextDump', 'context_dump') || '无').slice(0, 4000)}

请输出：
## 修订稿
## 本轮具体改了什么
## 仍建议继续确认的点`,
        { maxTokens: 2200 }
      );

      return { success: true, data: result, message: '章节精修完成' };
    } catch (error: any) {
      return { success: false, message: `Error: 章节精修失败: ${error.message}` };
    }
  },
};

const reviewDocument: SkillDefinition = {
  name: 'docCoauthoring.review',
  category: 'document',
  displayName: '文档审阅',
  description: '对文档内容进行审阅，提供修改建议',
  parameters: [
    { name: 'content', type: 'string', description: '待审阅的文档内容', required: true },
    { name: 'criteria', type: 'string', description: '审阅标准/关注点', required: false },
  ],
  execute: async (params, ctx) => {
    try {
      const criteria = pickParam<string>(params, 'criteria') || '语言流畅性、逻辑清晰度、格式规范性、内容完整性';
      const result = await runPrompt(
        ctx,
        `请对以下文档进行专业审阅。

审阅标准：${criteria}

文档内容：
${(pickParam<string>(params, 'content') || '').slice(0, 12000)}

请按以下结构输出：
## 总体评价
## 具体修改建议（按重要性排序）
## 哪些句子像空话或重复
## 建议改写示例（如需要）`,
        { maxTokens: 2400 }
      );

      return { success: true, data: result, message: '文档审阅完成' };
    } catch (error: any) {
      return { success: false, message: `Error: 文档审阅失败: ${error.message}` };
    }
  },
};

const readerTest: SkillDefinition = {
  name: 'docCoauthoring.readerTest',
  category: 'document',
  displayName: '读者测试',
  description: '从陌生读者视角测试文档是否可理解、可检索、可回答问题',
  parameters: [
    { name: 'documentContent', type: 'string', description: '完整文档内容', required: true },
    { name: 'audience', type: 'string', description: '目标读者', required: false },
    { name: 'desiredImpact', type: 'string', description: '希望文档达成的效果', required: false },
    { name: 'knownContext', type: 'string', description: '读者默认已知上下文', required: false },
  ],
  execute: async (params, ctx) => {
    try {
      const result = await runPrompt(
        ctx,
        `请以“第一次接触这份文档的读者”视角进行读者测试。

目标读者：${pickParam<string>(params, 'audience') || '未说明'}
希望达成的效果：${pickParam<string>(params, 'desiredImpact', 'desired_impact') || '未说明'}
读者默认已知上下文：${pickParam<string>(params, 'knownContext', 'known_context') || '尽量假设不知道太多背景'}

文档内容：
${(pickParam<string>(params, 'documentContent', 'document_content') || '').slice(0, 14000)}

请输出：
## 读者可能会问的问题（5-10条）
## 文档目前能否回答这些问题
## 可能卡住读者的歧义/跳步/默认前提
## 建议补强的位置
## 如果只能改 3 处，优先改哪里`,
        { maxTokens: 2400 }
      );

      return { success: true, data: result, message: '读者测试完成' };
    } catch (error: any) {
      return { success: false, message: `Error: 读者测试失败: ${error.message}` };
    }
  },
};

const mergeRevisions: SkillDefinition = {
  name: 'docCoauthoring.mergeRevisions',
  category: 'document',
  displayName: '合并修订',
  description: '合并多个版本的文档修订内容',
  parameters: [
    { name: 'original', type: 'string', description: '原始文档内容', required: true },
    { name: 'revisions', type: 'array', description: '修订版本数组', required: true },
    { name: 'mergeStrategy', type: 'string', description: '合并策略，可选', required: false },
  ],
  execute: async (params, ctx) => {
    try {
      const revisions = normalizeStringArray(pickParam(params, 'revisions'));
      const revisionsText = revisions
        .map((revision, index) => `--- 修订版本 ${index + 1} ---\n${revision}`)
        .join('\n\n');

      const result = await runPrompt(
        ctx,
        `请合并以下文档的原始版本和多个修订版本，保留最佳修改。

合并策略：${pickParam<string>(params, 'mergeStrategy', 'merge_strategy') || '优先保留更清晰、更完整、更可执行的内容'}

原始版本：
${(pickParam<string>(params, 'original') || '').slice(0, 5000)}

${revisionsText.slice(0, 9000)}

请输出：
## 合并后的最终版本
## 合并取舍说明
## 仍然建议人工确认的地方`,
        { maxTokens: 2600 }
      );

      return { success: true, data: result, message: '修订合并完成' };
    } catch (error: any) {
      return { success: false, message: `Error: 合并修订失败: ${error.message}` };
    }
  },
};

export const docCoauthoringSkills: SkillDefinition[] = [
  createScaffold,
  collectContext,
  planStructure,
  brainstormSection,
  draftSection,
  reviseSection,
  reviewDocument,
  readerTest,
  mergeRevisions,
];
