/**
 * PDF Skill - PDF 文档操作
 * 移植自 ai-agent-plus pdf_skill.py
 */

import * as fs from 'fs';
import * as path from 'path';
import { SkillDefinition } from '../registry';

const readPdf: SkillDefinition = {
  name: 'pdf.readPdf',
  category: 'document',
  displayName: '读取 PDF',
  description: '读取 PDF 文件内容（提取文本）',
  parameters: [
    { name: 'path', type: 'string', description: 'PDF 文件路径', required: true },
    { name: 'maxPages', type: 'number', description: '最多读取页数', required: false },
  ],
  execute: async (params) => {
    const filePath = path.resolve(params.path);
    if (!fs.existsSync(filePath)) return { success: false, message: `Error: 文件不存在: ${filePath}` };

    try {
      const pdfParse = require('pdf-parse');
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer, { max: params.maxPages || 0 });
      const text = data.text || '';
      const truncated = text.length > 10000 ? text.slice(0, 10000) + `\n...(共${text.length}字符)` : text;
      return {
        success: true,
        data: truncated,
        message: `PDF: ${filePath} (${data.numpages} 页, ${text.length} 字符)`,
      };
    } catch (e: any) {
      return { success: false, message: `Error: 读取 PDF 失败: ${e.message}` };
    }
  },
};

const mergePdf: SkillDefinition = {
  name: 'pdf.mergePdf',
  category: 'document',
  displayName: '合并 PDF',
  description: '将多个 PDF 文件合并为一个',
  parameters: [
    { name: 'inputPaths', type: 'array', description: 'PDF 文件路径数组', required: true },
    { name: 'outputPath', type: 'string', description: '输出文件路径', required: true },
  ],
  execute: async (params) => {
    try {
      const { PDFDocument } = require('pdf-lib');
      const mergedPdf = await PDFDocument.create();

      for (const inputPath of params.inputPaths) {
        const filePath = path.resolve(inputPath);
        if (!fs.existsSync(filePath)) return { success: false, message: `Error: 文件不存在: ${filePath}` };
        const buffer = fs.readFileSync(filePath);
        const doc = await PDFDocument.load(buffer);
        const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
        pages.forEach((page: any) => mergedPdf.addPage(page));
      }

      const outputPath = path.resolve(params.outputPath);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, await mergedPdf.save());
      return { success: true, message: `成功合并 ${params.inputPaths.length} 个 PDF`, outputPath };
    } catch (e: any) {
      return { success: false, message: `Error: 合并 PDF 失败: ${e.message}` };
    }
  },
};

const splitPdf: SkillDefinition = {
  name: 'pdf.splitPdf',
  category: 'document',
  displayName: '拆分 PDF',
  description: '将 PDF 文件按页拆分',
  parameters: [
    { name: 'path', type: 'string', description: 'PDF 文件路径', required: true },
    { name: 'outputDir', type: 'string', description: '输出目录', required: true },
    { name: 'pages', type: 'array', description: '要提取的页码数组(1-indexed)，不传则拆分所有页', required: false },
  ],
  execute: async (params) => {
    try {
      const { PDFDocument } = require('pdf-lib');
      const filePath = path.resolve(params.path);
      if (!fs.existsSync(filePath)) return { success: false, message: `Error: 文件不存在: ${filePath}` };

      const buffer = fs.readFileSync(filePath);
      const srcDoc = await PDFDocument.load(buffer);
      const totalPages = srcDoc.getPageCount();
      const pageNums: number[] = params.pages || Array.from({ length: totalPages }, (_, i) => i + 1);

      const outputDir = path.resolve(params.outputDir);
      fs.mkdirSync(outputDir, { recursive: true });
      const outputPaths: string[] = [];

      for (const pageNum of pageNums) {
        if (pageNum < 1 || pageNum > totalPages) continue;
        const newDoc = await PDFDocument.create();
        const [page] = await newDoc.copyPages(srcDoc, [pageNum - 1]);
        newDoc.addPage(page);
        const outPath = path.join(outputDir, `page_${pageNum}.pdf`);
        fs.writeFileSync(outPath, await newDoc.save());
        outputPaths.push(outPath);
      }

      return { success: true, message: `成功拆分 ${outputPaths.length} 页`, data: outputPaths };
    } catch (e: any) {
      return { success: false, message: `Error: 拆分 PDF 失败: ${e.message}` };
    }
  },
};

export const pdfSkills: SkillDefinition[] = [readPdf, mergePdf, splitPdf];
