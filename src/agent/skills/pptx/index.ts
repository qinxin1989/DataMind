/**
 * PPTX Skill - PowerPoint OOXML 级操作
 * 移植自 ai-agent-plus pptx_skill.py（扩展 DataMind 已有 pptGenerator）
 */

import * as fs from 'fs';
import * as path from 'path';
import { SkillDefinition } from '../registry';

const pptxInventory: SkillDefinition = {
  name: 'pptx.inventory',
  category: 'document',
  displayName: 'PPTX 目录',
  description: '列出 PPTX 文件中所有幻灯片的标题和内容摘要',
  parameters: [
    { name: 'path', type: 'string', description: 'PPTX 文件路径', required: true },
  ],
  execute: async (params) => {
    const filePath = path.resolve(params.path);
    if (!fs.existsSync(filePath)) return { success: false, message: `Error: 文件不存在: ${filePath}` };

    try {
      const PptxGenJS = require('pptxgenjs');
      // 使用 pptx-parser 或 officegen 解析（这里使用简化方案）
      // 对于完整解析可用 node-pptx 或 unzip + xml 解析
      return {
        success: true,
        message: `PPTX 文件: ${filePath}`,
        data: '注意：完整的 PPTX 解析需要安装 pptx-parser 依赖。当前可使用 file.readFile 读取解压后的 XML。',
      };
    } catch (e: any) {
      return { success: false, message: `Error: 读取 PPTX 失败: ${e.message}` };
    }
  },
};

const pptxReplaceText: SkillDefinition = {
  name: 'pptx.replaceText',
  category: 'document',
  displayName: 'PPTX 替换文本',
  description: '在 PPTX 文件中批量替换文本',
  parameters: [
    { name: 'inputPath', type: 'string', description: '输入 PPTX 路径', required: true },
    { name: 'outputPath', type: 'string', description: '输出 PPTX 路径', required: true },
    { name: 'replacements', type: 'object', description: '替换映射 {old: new}', required: true },
  ],
  execute: async (params) => {
    const filePath = path.resolve(params.inputPath);
    if (!fs.existsSync(filePath)) return { success: false, message: `Error: 文件不存在: ${filePath}` };

    try {
      const JSZip = require('jszip');
      const buffer = fs.readFileSync(filePath);
      const zip = await JSZip.loadAsync(buffer);

      // 遍历所有 slide XML 文件进行文本替换
      const slideFiles = Object.keys(zip.files).filter(f => f.match(/ppt\/slides\/slide\d+\.xml/));
      for (const slideFile of slideFiles) {
        let content = await zip.file(slideFile)!.async('string');
        for (const [oldText, newText] of Object.entries(params.replacements)) {
          content = content.split(oldText).join(newText as string);
        }
        zip.file(slideFile, content);
      }

      const outputPath = path.resolve(params.outputPath);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      const outBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      fs.writeFileSync(outputPath, outBuffer);

      return {
        success: true,
        message: `成功替换文本，处理了 ${slideFiles.length} 个幻灯片`,
        outputPath,
      };
    } catch (e: any) {
      return { success: false, message: `Error: PPTX 替换失败: ${e.message}` };
    }
  },
};

const pptxRearrange: SkillDefinition = {
  name: 'pptx.rearrange',
  category: 'document',
  displayName: 'PPTX 重排幻灯片',
  description: '按指定顺序重排 PPTX 中的幻灯片',
  parameters: [
    { name: 'inputPath', type: 'string', description: '输入 PPTX 路径', required: true },
    { name: 'outputPath', type: 'string', description: '输出 PPTX 路径', required: true },
    { name: 'order', type: 'array', description: '新的幻灯片顺序(1-indexed)，如 [3,1,2]', required: true },
  ],
  execute: async (params) => {
    const filePath = path.resolve(params.inputPath);
    if (!fs.existsSync(filePath)) return { success: false, message: `Error: 文件不存在: ${filePath}` };

    try {
      const JSZip = require('jszip');
      const buffer = fs.readFileSync(filePath);
      const zip = await JSZip.loadAsync(buffer);

      const slideFiles = Object.keys(zip.files)
        .filter(f => f.match(/ppt\/slides\/slide\d+\.xml/))
        .sort((a, b) => {
          const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0');
          const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0');
          return numA - numB;
        });

      const slideContents: string[] = [];
      for (const sf of slideFiles) {
        slideContents.push(await zip.file(sf)!.async('string'));
      }

      // 按新顺序重排
      const order: number[] = params.order;
      for (let i = 0; i < order.length && i < slideFiles.length; i++) {
        const srcIdx = order[i] - 1;
        if (srcIdx >= 0 && srcIdx < slideContents.length) {
          zip.file(slideFiles[i], slideContents[srcIdx]);
        }
      }

      const outputPath = path.resolve(params.outputPath);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, await zip.generateAsync({ type: 'nodebuffer' }));

      return { success: true, message: `成功重排 ${order.length} 个幻灯片`, outputPath };
    } catch (e: any) {
      return { success: false, message: `Error: PPTX 重排失败: ${e.message}` };
    }
  },
};

export const pptxSkills: SkillDefinition[] = [pptxInventory, pptxReplaceText, pptxRearrange];
