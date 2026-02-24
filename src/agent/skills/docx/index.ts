/**
 * Docx Skill - Word 文档操作
 * 移植自 ai-agent-plus word_skill.py
 */

import * as fs from 'fs';
import * as path from 'path';
import { SkillDefinition } from '../registry';

const readWord: SkillDefinition = {
  name: 'docx.readWord',
  category: 'document',
  displayName: '读取 Word',
  description: '读取 Word(.docx) 文件的文本内容',
  parameters: [
    { name: 'path', type: 'string', description: 'Word 文件路径', required: true },
  ],
  execute: async (params) => {
    const filePath = path.resolve(params.path);
    if (!fs.existsSync(filePath)) return { success: false, message: `Error: 文件不存在: ${filePath}` };

    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      const text = result.value || '';
      const truncated = text.length > 10000 ? text.slice(0, 10000) + `\n...(共${text.length}字符)` : text;
      return { success: true, data: truncated, message: `Word: ${filePath} (${text.length} 字符)` };
    } catch (e: any) {
      return { success: false, message: `Error: 读取 Word 失败: ${e.message}` };
    }
  },
};

const createWordDocument: SkillDefinition = {
  name: 'docx.createWordDocument',
  category: 'document',
  displayName: '创建 Word 文档',
  description: '创建一个新的 Word(.docx) 文档',
  parameters: [
    { name: 'outputPath', type: 'string', description: '输出文件路径', required: true },
    { name: 'title', type: 'string', description: '文档标题', required: false },
    { name: 'content', type: 'string', description: '文档内容（纯文本，段落用换行分隔）', required: true },
  ],
  execute: async (params) => {
    try {
      const docx = require('docx');
      const paragraphs = (params.content || '').split('\n').map((line: string) => {
        if (params.title && line === params.title) {
          return new docx.Paragraph({ text: line, heading: docx.HeadingLevel.HEADING_1 });
        }
        return new docx.Paragraph({ text: line });
      });

      if (params.title) {
        paragraphs.unshift(new docx.Paragraph({ text: params.title, heading: docx.HeadingLevel.TITLE }));
      }

      const doc = new docx.Document({
        sections: [{ properties: {}, children: paragraphs }],
      });

      const outputPath = path.resolve(params.outputPath);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      const buffer = await docx.Packer.toBuffer(doc);
      fs.writeFileSync(outputPath, buffer);
      return { success: true, message: `成功创建 Word 文档: ${outputPath}`, outputPath };
    } catch (e: any) {
      return { success: false, message: `Error: 创建 Word 文档失败: ${e.message}` };
    }
  },
};

const generateWordReport: SkillDefinition = {
  name: 'docx.generateWordReport',
  category: 'document',
  displayName: '生成 Word 报告',
  description: '基于数据生成结构化的 Word 报告',
  parameters: [
    { name: 'outputPath', type: 'string', description: '输出文件路径', required: true },
    { name: 'title', type: 'string', description: '报告标题', required: true },
    { name: 'sections', type: 'array', description: '报告章节数组，每项 {heading, content}', required: true },
  ],
  execute: async (params) => {
    try {
      const docx = require('docx');
      const children: any[] = [];

      children.push(new docx.Paragraph({ text: params.title, heading: docx.HeadingLevel.TITLE }));
      children.push(new docx.Paragraph({ text: '' }));

      for (const section of params.sections || []) {
        if (section.heading) {
          children.push(new docx.Paragraph({ text: section.heading, heading: docx.HeadingLevel.HEADING_1 }));
        }
        const lines = (section.content || '').split('\n');
        for (const line of lines) {
          children.push(new docx.Paragraph({ text: line }));
        }
        children.push(new docx.Paragraph({ text: '' }));
      }

      const doc = new docx.Document({
        sections: [{ properties: {}, children }],
      });

      const outputPath = path.resolve(params.outputPath);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      const buffer = await docx.Packer.toBuffer(doc);
      fs.writeFileSync(outputPath, buffer);
      return { success: true, message: `成功生成报告: ${outputPath}`, outputPath };
    } catch (e: any) {
      return { success: false, message: `Error: 生成报告失败: ${e.message}` };
    }
  },
};

export const docxSkills: SkillDefinition[] = [readWord, createWordDocument, generateWordReport];
