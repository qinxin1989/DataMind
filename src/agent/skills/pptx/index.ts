/**
 * PPTX Skill - PowerPoint OOXML 级操作
 * 兼容 ai-agent-plus 中的 PPTX 清单、替换、重排、解包、打包、校验动作
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

function decodeXmlText(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function sortSlideFiles(files: string[]): string[] {
  return [...files].sort((left, right) => {
    const leftIndex = Number(left.match(/slide(\d+)\.xml$/)?.[1] || '0');
    const rightIndex = Number(right.match(/slide(\d+)\.xml$/)?.[1] || '0');
    return leftIndex - rightIndex;
  });
}

async function loadZip(filePath: string) {
  const JSZip = require('jszip');
  const buffer = fs.readFileSync(filePath);
  return JSZip.loadAsync(buffer);
}

async function extractInventory(filePath: string, issuesOnly = false) {
  const zip = await loadZip(filePath);
  const slideFiles = sortSlideFiles(
    Object.keys(zip.files).filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry))
  );

  const inventory: Record<string, any> = {};

  for (let index = 0; index < slideFiles.length; index++) {
    const slideFile = slideFiles[index];
    const content = await zip.file(slideFile)!.async('string');
    const textItems = Array.from(content.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g))
      .map((match) => decodeXmlText((match as RegExpMatchArray)[1]).trim())
      .filter(Boolean);

    const slideKey = `slide-${index}`;
    const slideInfo = {
      slideIndex: index,
      path: slideFile,
      textItems,
      combinedText: textItems.join('\n'),
      issueFlags: {
        empty: textItems.length === 0,
      },
    };

    if (!issuesOnly || slideInfo.issueFlags.empty) {
      inventory[slideKey] = slideInfo;
    }
  }

  return inventory;
}

function walkDirectory(rootDir: string, currentDir = rootDir): string[] {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDirectory(rootDir, fullPath));
    } else {
      files.push(path.relative(rootDir, fullPath).replace(/\\/g, '/'));
    }
  }

  return files;
}

const pptxInventory: SkillDefinition = {
  name: 'pptx.inventory',
  category: 'document',
  displayName: 'PPTX 清单',
  description: '提取 PPTX 文件中每页幻灯片的文本清单',
  parameters: [
    { name: 'path', type: 'string', description: 'PPTX 文件路径', required: true },
    { name: 'issuesOnly', type: 'boolean', description: '仅返回疑似空白页等问题页', required: false },
  ],
  execute: async (params) => {
    const filePath = path.resolve(pickParam<string>(params, 'path', 'pptx_path') || '');
    if (!fs.existsSync(filePath)) {
      return { success: false, message: `Error: 文件不存在: ${filePath}` };
    }

    try {
      const inventory = await extractInventory(
        filePath,
        Boolean(pickParam(params, 'issuesOnly', 'issues_only'))
      );
      return {
        success: true,
        message: `已提取 ${Object.keys(inventory).length} 页 PPTX 清单`,
        data: inventory,
      };
    } catch (error: any) {
      return { success: false, message: `Error: 读取 PPTX 失败: ${error.message}` };
    }
  },
};

const pptxSaveInventory: SkillDefinition = {
  name: 'pptx.saveInventory',
  category: 'document',
  displayName: '保存 PPTX 清单',
  description: '将 PPTX 文本清单输出到 JSON 文件',
  parameters: [
    { name: 'path', type: 'string', description: 'PPTX 文件路径', required: true },
    { name: 'outputPath', type: 'string', description: '输出 JSON 路径', required: true },
    { name: 'issuesOnly', type: 'boolean', description: '仅输出问题页', required: false },
  ],
  execute: async (params) => {
    const filePath = path.resolve(pickParam<string>(params, 'path', 'pptx_path') || '');
    const outputPath = path.resolve(pickParam<string>(params, 'outputPath', 'output_path') || '');
    if (!fs.existsSync(filePath)) {
      return { success: false, message: `Error: 文件不存在: ${filePath}` };
    }

    try {
      const inventory = await extractInventory(
        filePath,
        Boolean(pickParam(params, 'issuesOnly', 'issues_only'))
      );
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify(inventory, null, 2), 'utf-8');
      return {
        success: true,
        message: `已输出 PPTX 清单: ${outputPath}`,
        outputPath,
      };
    } catch (error: any) {
      return { success: false, message: `Error: 保存 PPTX 清单失败: ${error.message}` };
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
    const filePath = path.resolve(pickParam<string>(params, 'inputPath', 'input_path', 'pptx_path') || '');
    if (!fs.existsSync(filePath)) return { success: false, message: `Error: 文件不存在: ${filePath}` };

    try {
      const zip = await loadZip(filePath);
      const replacements = pickParam<Record<string, string>>(params, 'replacements') || {};

      const slideFiles = Object.keys(zip.files).filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry));
      for (const slideFile of slideFiles) {
        let content = await zip.file(slideFile)!.async('string');
        for (const [oldText, newText] of Object.entries(replacements)) {
          content = content.split(oldText).join(newText);
        }
        zip.file(slideFile, content);
      }

      const outputPath = path.resolve(pickParam<string>(params, 'outputPath', 'output_path') || '');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      const outBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      fs.writeFileSync(outputPath, outBuffer);

      return {
        success: true,
        message: `成功替换文本，处理了 ${slideFiles.length} 个幻灯片`,
        outputPath,
      };
    } catch (error: any) {
      return { success: false, message: `Error: PPTX 替换失败: ${error.message}` };
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
    { name: 'order', type: 'array', description: '新的幻灯片顺序(1-indexed)', required: true },
  ],
  execute: async (params) => {
    const filePath = path.resolve(
      pickParam<string>(params, 'inputPath', 'input_path', 'template_path') || ''
    );
    if (!fs.existsSync(filePath)) return { success: false, message: `Error: 文件不存在: ${filePath}` };

    try {
      const zip = await loadZip(filePath);
      const slideFiles = sortSlideFiles(
        Object.keys(zip.files).filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry))
      );
      const slideContents: string[] = [];
      for (const slideFile of slideFiles) {
        slideContents.push(await zip.file(slideFile)!.async('string'));
      }

      const order: number[] = pickParam<number[]>(params, 'order', 'sequence') || [];
      for (let index = 0; index < order.length && index < slideFiles.length; index++) {
        const sourceIndex = Number(order[index]) - 1;
        if (sourceIndex >= 0 && sourceIndex < slideContents.length) {
          zip.file(slideFiles[index], slideContents[sourceIndex]);
        }
      }

      const outputPath = path.resolve(pickParam<string>(params, 'outputPath', 'output_path') || '');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, await zip.generateAsync({ type: 'nodebuffer' }));

      return { success: true, message: `成功重排 ${order.length} 个幻灯片`, outputPath };
    } catch (error: any) {
      return { success: false, message: `Error: PPTX 重排失败: ${error.message}` };
    }
  },
};

const pptxUnpack: SkillDefinition = {
  name: 'pptx.unpack',
  category: 'document',
  displayName: '解包 PPTX',
  description: '将 PPTX OOXML 结构解包到目录',
  parameters: [
    { name: 'path', type: 'string', description: 'PPTX 文件路径', required: true },
    { name: 'outputDir', type: 'string', description: '输出目录', required: true },
  ],
  execute: async (params) => {
    const filePath = path.resolve(pickParam<string>(params, 'path', 'pptx_path') || '');
    const outputDir = path.resolve(pickParam<string>(params, 'outputDir', 'output_dir') || '');
    if (!fs.existsSync(filePath)) {
      return { success: false, message: `Error: 文件不存在: ${filePath}` };
    }

    try {
      const zip = await loadZip(filePath);
      fs.mkdirSync(outputDir, { recursive: true });

      for (const entryName of Object.keys(zip.files)) {
        const entry = zip.files[entryName];
        const outputPath = path.join(outputDir, entryName);

        if (entry.dir) {
          fs.mkdirSync(outputPath, { recursive: true });
          continue;
        }

        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        const buffer = await entry.async('nodebuffer');
        fs.writeFileSync(outputPath, buffer);
      }

      return {
        success: true,
        message: `已解包 PPTX 到目录: ${outputDir}`,
        outputPath: outputDir,
      };
    } catch (error: any) {
      return { success: false, message: `Error: 解包 PPTX 失败: ${error.message}` };
    }
  },
};

const pptxPack: SkillDefinition = {
  name: 'pptx.pack',
  category: 'document',
  displayName: '打包 PPTX',
  description: '将解包后的 OOXML 目录重新打包为 PPTX',
  parameters: [
    { name: 'inputDir', type: 'string', description: '解包目录路径', required: true },
    { name: 'outputPath', type: 'string', description: '输出 PPTX 路径', required: true },
  ],
  execute: async (params) => {
    const inputDir = path.resolve(pickParam<string>(params, 'inputDir', 'input_dir') || '');
    const outputPath = path.resolve(pickParam<string>(params, 'outputPath', 'output_path') || '');
    if (!fs.existsSync(inputDir) || !fs.statSync(inputDir).isDirectory()) {
      return { success: false, message: `Error: 目录不存在: ${inputDir}` };
    }

    try {
      const JSZip = require('jszip');
      const zip = new JSZip();
      const files = walkDirectory(inputDir);

      for (const relativePath of files) {
        const absolutePath = path.join(inputDir, relativePath);
        zip.file(relativePath, fs.readFileSync(absolutePath));
      }

      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });
      fs.writeFileSync(outputPath, buffer);

      return {
        success: true,
        message: `已打包 PPTX: ${outputPath}`,
        outputPath,
      };
    } catch (error: any) {
      return { success: false, message: `Error: 打包 PPTX 失败: ${error.message}` };
    }
  },
};

const pptxValidate: SkillDefinition = {
  name: 'pptx.validate',
  category: 'document',
  displayName: '校验 PPTX 目录',
  description: '对解包后的 PPTX 目录做基础结构校验',
  parameters: [
    { name: 'unpackedDir', type: 'string', description: '解包目录路径', required: true },
  ],
  execute: async (params) => {
    const unpackedDir = path.resolve(pickParam<string>(params, 'unpackedDir', 'inputDir', 'input_dir') || '');
    if (!fs.existsSync(unpackedDir) || !fs.statSync(unpackedDir).isDirectory()) {
      return { success: false, message: `Error: 解包目录不存在: ${unpackedDir}` };
    }

    const requiredPaths = [
      '[Content_Types].xml',
      '_rels/.rels',
      'ppt/presentation.xml',
      'ppt/_rels/presentation.xml.rels',
    ];

    const missing = requiredPaths.filter((relativePath) =>
      !fs.existsSync(path.join(unpackedDir, relativePath))
    );

    return {
      success: true,
      data: {
        valid: missing.length === 0,
        missing,
      },
      message: missing.length === 0
        ? 'PPTX 目录结构校验通过'
        : `PPTX 目录结构缺少 ${missing.length} 个关键文件`,
    };
  },
};

export const pptxSkills: SkillDefinition[] = [
  pptxInventory,
  pptxSaveInventory,
  pptxReplaceText,
  pptxRearrange,
  pptxUnpack,
  pptxPack,
  pptxValidate,
];
