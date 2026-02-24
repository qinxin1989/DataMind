/**
 * Doc Coauthoring Skill - 文档协作工作流
 * 移植自 ai-agent-plus doc-coauthoring
 * 纯 prompt 引导型技能：LLM 辅助用户完成文档审阅、修订、合并
 */

import { SkillDefinition } from '../registry';

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
    if (!ctx?.openai || !ctx?.model) {
      return { success: false, message: 'Error: 需要 OpenAI 实例来执行文档审阅' };
    }

    try {
      const criteria = params.criteria || '语言流畅性、逻辑清晰度、格式规范性、内容完整性';
      const response = await ctx.openai.chat.completions.create({
        model: ctx.model,
        messages: [{
          role: 'user',
          content: `请对以下文档进行专业审阅。
审阅标准: ${criteria}

请按以下格式输出：
1. 总体评价（1-2句）
2. 具体修改建议（按重要性排序）
3. 修订后的文本（如需要）

文档内容：
${params.content.slice(0, 8000)}`,
        }],
        max_tokens: 4096,
      });

      const result = response.choices?.[0]?.message?.content || '';
      return { success: true, data: result, message: '文档审阅完成' };
    } catch (e: any) {
      return { success: false, message: `Error: 文档审阅失败: ${e.message}` };
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
  ],
  execute: async (params, ctx) => {
    if (!ctx?.openai || !ctx?.model) {
      return { success: false, message: 'Error: 需要 OpenAI 实例来合并修订' };
    }

    try {
      const revisionsText = (params.revisions || [])
        .map((r: string, i: number) => `--- 修订版本 ${i + 1} ---\n${r}`)
        .join('\n\n');

      const response = await ctx.openai.chat.completions.create({
        model: ctx.model,
        messages: [{
          role: 'user',
          content: `请合并以下文档的原始版本和多个修订版本，保留最佳的修改。

原始版本：
${params.original.slice(0, 4000)}

${revisionsText.slice(0, 6000)}

请输出合并后的最终版本。`,
        }],
        max_tokens: 4096,
      });

      const result = response.choices?.[0]?.message?.content || '';
      return { success: true, data: result, message: '修订合并完成' };
    } catch (e: any) {
      return { success: false, message: `Error: 合并修订失败: ${e.message}` };
    }
  },
};

export const docCoauthoringSkills: SkillDefinition[] = [reviewDocument, mergeRevisions];
