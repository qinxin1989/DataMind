/**
 * Canvas Design Skill - 画布设计技能
 * 移植自 ai-agent-plus canvas-design
 * 基于 JSON schema 生成可视化设计（导出为 HTML/SVG）
 */

import * as fs from 'fs';
import * as path from 'path';
import { SkillDefinition } from '../registry';

function pickParam<T = any>(params: Record<string, any>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (params[key] !== undefined) {
      return params[key] as T;
    }
  }
  return undefined;
}

function extractCodeBlock(content: string, language: string): string {
  const pattern = new RegExp(`\\\`\\\`\\\`${language}\\s*([\\s\\S]*?)\\\`\\\`\\\``, 'i');
  const match = content.match(pattern);
  return match ? match[1].trim() : content.trim();
}

function resolveCanvasFontInfo(outputPath: string) {
  const fontDir = path.join(process.cwd(), 'skills', 'canvas_design', 'canvas-fonts');
  if (!fs.existsSync(fontDir)) {
    return {
      fontDir,
      fontFamilies: [] as string[],
      relativeFontDir: '',
    };
  }

  const fontFamilies = fs.readdirSync(fontDir)
    .filter((name) => /\.(ttf|otf|woff2?)$/i.test(name))
    .map((name) => name.replace(/\.(ttf|otf|woff2?)$/i, ''))
    .slice(0, 18);

  return {
    fontDir,
    fontFamilies,
    relativeFontDir: path.relative(path.dirname(outputPath), fontDir).replace(/\\/g, '/'),
  };
}

const generateCanvas: SkillDefinition = {
  name: 'canvas.generate',
  category: 'media',
  displayName: '生成画布设计',
  description: '根据描述生成设计哲学和 HTML 画布设计（信息图、流程图、海报等）',
  parameters: [
    { name: 'description', type: 'string', description: '设计描述/需求', required: true },
    { name: 'outputPath', type: 'string', description: '输出 HTML 文件路径', required: true },
    { name: 'philosophyPath', type: 'string', description: '设计哲学 Markdown 输出路径', required: false },
    { name: 'width', type: 'number', description: '画布宽度(px)', required: false },
    { name: 'height', type: 'number', description: '画布高度(px)', required: false },
    { name: 'themeHint', type: 'string', description: '可选：主题线索/隐喻方向', required: false },
  ],
  execute: async (params, ctx) => {
    if (!ctx?.openai || !ctx?.model) {
      return { success: false, message: 'Error: 需要 OpenAI 实例来生成设计' };
    }

    try {
      const outputPath = path.resolve(pickParam<string>(params, 'outputPath', 'output_path') || '');
      const philosophyPath = path.resolve(
        pickParam<string>(params, 'philosophyPath', 'philosophy_path')
          || outputPath.replace(/\.[^.]+$/, '.md')
      );
      const width = Number(pickParam<number>(params, 'width')) || 800;
      const height = Number(pickParam<number>(params, 'height')) || 600;
      const description = pickParam<string>(params, 'description') || '';
      const themeHint = pickParam<string>(params, 'themeHint', 'theme_hint') || '';
      const { fontFamilies, relativeFontDir } = resolveCanvasFontInfo(outputPath);

      const philosophyResponse = await ctx.openai.chat.completions.create({
        model: ctx.model,
        messages: [{
          role: 'user',
          content: `你正在为一张静态视觉作品创建“设计哲学”。

任务描述：
${description}

补充主题线索：
${themeHint || '无，需你从任务里自行抽取隐含主题'}

请输出一份中文 Markdown，结构如下：
1. 标题：设计哲学名称（2-6字）
2. 核心宣言：4-6段，强调空间、色彩、节奏、材质、视觉层次
3. 视觉语汇：6-10条短句
4. 执行提醒：3-5条，强调极高完成度、克制文字、边界留白、无低质装饰

要求：
- 更像“艺术方向说明”，不是普通需求拆解
- 强调作品要像顶尖设计师反复打磨后的成品
- 文字要少而准，为后续视觉生成留出发挥空间

只输出 Markdown，不要解释。`,
        }],
        max_tokens: 1800,
      });

      const philosophyMarkdown = extractCodeBlock(
        philosophyResponse.choices?.[0]?.message?.content || '',
        'md'
      );

      const response = await ctx.openai.chat.completions.create({
        model: ctx.model,
        messages: [{
          role: 'user',
          content: `你是一个顶级视觉设计师兼前端实现者。请根据以下“设计哲学”和任务描述，生成一个完整的单文件 HTML 页面（含内联 CSS，可使用 SVG，但不要依赖外网资源）。

画布尺寸: ${width}x${height}px
设计任务:
${description}

设计哲学:
${philosophyMarkdown}

附加约束:
- 这是静态视觉作品，不是后台管理页面
- 90% 视觉，10% 必要文字；文字必须克制、像画面元素的一部分
- 不允许元素溢出画布，不允许遮挡和排版混乱
- 必须有明确的视觉层次、留白、材质感和专业感
- 尽量避免通用模板感，不要做成廉价 AI 海报
- 如需字体，可优先使用这些本地字体名称：${fontFamilies.length ? fontFamilies.join(', ') : '当前未检测到本地字体资产，可退回常见衬线/无衬线组合'}
- 如果使用本地字体，可通过相对目录 ${relativeFontDir || './canvas-fonts'} 引用
- 输出内容必须是可直接保存的完整 HTML，主体画布尺寸固定为 ${width}px × ${height}px

只输出完整 HTML 代码，不要解释，不要 Markdown 代码块。`,
        }],
        max_tokens: 4096,
      });

      const html = extractCodeBlock(response.choices?.[0]?.message?.content || '', 'html');

      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.mkdirSync(path.dirname(philosophyPath), { recursive: true });
      fs.writeFileSync(philosophyPath, philosophyMarkdown, 'utf-8');
      fs.writeFileSync(outputPath, html, 'utf-8');
      return {
        success: true,
        message: `成功生成设计哲学与画布作品\n哲学文件: ${philosophyPath}\n画布文件: ${outputPath}`,
        outputPath,
        data: {
          philosophyPath,
          outputPath,
        },
      };
    } catch (e: any) {
      return { success: false, message: `Error: 生成设计失败: ${e.message}` };
    }
  },
};

export const canvasDesignSkills: SkillDefinition[] = [generateCanvas];
