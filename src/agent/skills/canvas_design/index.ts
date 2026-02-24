/**
 * Canvas Design Skill - 画布设计技能
 * 移植自 ai-agent-plus canvas-design
 * 基于 JSON schema 生成可视化设计（导出为 HTML/SVG）
 */

import * as fs from 'fs';
import * as path from 'path';
import { SkillDefinition } from '../registry';

const generateCanvas: SkillDefinition = {
  name: 'canvas.generate',
  category: 'media',
  displayName: '生成画布设计',
  description: '根据描述生成 HTML 画布设计（信息图、流程图、海报等）',
  parameters: [
    { name: 'description', type: 'string', description: '设计描述/需求', required: true },
    { name: 'outputPath', type: 'string', description: '输出 HTML 文件路径', required: true },
    { name: 'width', type: 'number', description: '画布宽度(px)', required: false },
    { name: 'height', type: 'number', description: '画布高度(px)', required: false },
  ],
  execute: async (params, ctx) => {
    if (!ctx?.openai || !ctx?.model) {
      return { success: false, message: 'Error: 需要 OpenAI 实例来生成设计' };
    }

    try {
      const width = params.width || 800;
      const height = params.height || 600;

      const response = await ctx.openai.chat.completions.create({
        model: ctx.model,
        messages: [{
          role: 'user',
          content: `你是一个前端设计师。请根据以下描述生成一个完整的 HTML 页面（含内联 CSS 和 SVG/Canvas）。
画布尺寸: ${width}x${height}px
要求: 美观、专业、信息清晰
设计描述: ${params.description}

只输出完整的 HTML 代码，不要其他说明。`,
        }],
        max_tokens: 4096,
      });

      let html = response.choices?.[0]?.message?.content || '';
      // 提取 HTML 代码块
      const match = html.match(/```html\s*([\s\S]*?)```/);
      if (match) html = match[1];

      const outputPath = path.resolve(params.outputPath);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, html, 'utf-8');
      return { success: true, message: `成功生成设计: ${outputPath}`, outputPath };
    } catch (e: any) {
      return { success: false, message: `Error: 生成设计失败: ${e.message}` };
    }
  },
};

export const canvasDesignSkills: SkillDefinition[] = [generateCanvas];
