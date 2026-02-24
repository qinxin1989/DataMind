/**
 * Image OCR Skill - 图片文字识别
 * 移植自 ai-agent-plus image_ocr_skill.py
 * 使用 OpenAI Vision API 进行 OCR（更准确）或 tesseract.js 作为后备
 */

import * as fs from 'fs';
import * as path from 'path';
import { SkillDefinition } from '../registry';

const ocrImage: SkillDefinition = {
  name: 'imageOcr.ocrImage',
  category: 'media',
  displayName: '图片 OCR',
  description: '识别图片中的文字内容（支持 png/jpg/bmp/webp）',
  parameters: [
    { name: 'path', type: 'string', description: '图片文件路径', required: true },
    { name: 'useVision', type: 'boolean', description: '是否使用 OpenAI Vision API（更准确）', required: false },
  ],
  execute: async (params, ctx) => {
    const filePath = path.resolve(params.path);
    if (!fs.existsSync(filePath)) return { success: false, message: `Error: 文件不存在: ${filePath}` };

    // 优先使用 OpenAI Vision API
    if (params.useVision !== false && ctx?.openai && ctx?.model) {
      try {
        const buffer = fs.readFileSync(filePath);
        const base64 = buffer.toString('base64');
        const ext = path.extname(filePath).slice(1).toLowerCase();
        const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

        const response = await ctx.openai.chat.completions.create({
          model: ctx.model,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: '请提取这张图片中的所有文字内容，保持原始格式和布局。如果是表格，请用 markdown 表格格式输出。' },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          }],
          max_tokens: 4096,
        });

        const text = response.choices?.[0]?.message?.content || '';
        return { success: true, data: text, message: `OCR (Vision): ${filePath}` };
      } catch (e: any) {
        // Vision 失败，尝试 tesseract 后备
        console.warn(`Vision OCR 失败: ${e.message}，尝试 tesseract...`);
      }
    }

    // 后备：tesseract.js
    try {
      const Tesseract = require('tesseract.js');
      const { data: { text } } = await Tesseract.recognize(filePath, 'chi_sim+eng');
      return { success: true, data: text, message: `OCR (Tesseract): ${filePath}` };
    } catch (e: any) {
      return { success: false, message: `Error: OCR 失败: ${e.message}。请安装 tesseract.js: npm i tesseract.js` };
    }
  },
};

export const imageOcrSkills: SkillDefinition[] = [ocrImage];
