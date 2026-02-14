
import { SkillDefinition, SkillResult } from '../registry';

/**
 * 专家级问答技能
 * 提供深度、结构化的回答，结合 RAG 和搜索能力（如果配置）
 */
export const expertQA: SkillDefinition = {
    name: 'qa.expert',
    category: 'report', // 暂时归类为 report 或其他合适类别， registry可能需要扩充 category
    displayName: '专家问答',
    description: '提供深度、结构化的专业回答，适用于复杂问题咨询',
    parameters: [
        { name: 'question', type: 'string', description: '问题', required: true },
        { name: 'ragContext', type: 'string', description: 'RAG 上下文', required: false },
        { name: 'history', type: 'array', description: '聊天记录', required: false },
        { name: 'depth', type: 'string', description: '回答深度 (normal/deep)', required: false, default: 'deep' }
    ],
    execute: async (params, context): Promise<SkillResult> => {
        const { question, ragContext, history, depth = 'deep' } = params;

        if (!context.openai || !context.model) {
            return { success: false, message: 'AI 模型未配置' };
        }

        try {
            // 构建系统提示词
            let systemPrompt = `你是一位全能型的专家顾问，擅长深入分析复杂问题并提供结构清晰、逻辑严密的解答。\n`;

            if (depth === 'deep') {
                systemPrompt += `你需要：\n1. 拆解问题核心\n2. 多角度分析\n3. 提供具体的案例或数据支持（如有）\n4. 给出可执行的建议\n5. 使用 Markdown 格式美化输出\n`;
            } else {
                systemPrompt += `请给出简洁明了的回答，直接切中要害。\n`;
            }

            if (ragContext) {
                systemPrompt += `\n参考知识库信息:\n${ragContext}\n请优先引用上述知识库内容回答。`;
            }

            // 模拟联网搜索功能（如果有实际的搜索工具集成，可以在这里调用）
            // 这里作为示例，我们假设只能基于现有知识和 LLM 知识回答

            const messages = [
                { role: 'system', content: systemPrompt },
                ...(history || []).map((h: any) => ({ role: h.role, content: h.content })),
                { role: 'user', content: question }
            ];

            const response = await context.openai.chat.completions.create({
                model: context.model,
                messages: messages,
                temperature: 0.7,
            });

            const answer = response.choices[0].message.content || '无法生成回答';

            return {
                success: true,
                data: answer,
                message: '回答生成完成'
            };

        } catch (error: any) {
            return { success: false, message: `专家问答失败: ${error.message}` };
        }
    }
};
