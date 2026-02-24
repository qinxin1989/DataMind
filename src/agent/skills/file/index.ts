/**
 * File Skill - 文件操作技能
 * 移植自 ai-agent-plus file_skill.py
 */

import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import { SkillDefinition, SkillResult } from '../registry';

function formatSize(bytes: number): string {
  for (const unit of ['B', 'KB', 'MB', 'GB']) {
    if (bytes < 1024) return `${bytes.toFixed(1)}${unit}`;
    bytes /= 1024;
  }
  return `${bytes.toFixed(1)}TB`;
}

const readFile: SkillDefinition = {
  name: 'file.readFile',
  category: 'file',
  displayName: '读取文件',
  description: '读取文件内容，支持指定行范围',
  parameters: [
    { name: 'path', type: 'string', description: '文件的绝对或相对路径', required: true },
    { name: 'startLine', type: 'number', description: '起始行号(1-indexed)', required: false },
    { name: 'endLine', type: 'number', description: '结束行号(1-indexed, inclusive)', required: false },
  ],
  execute: async (params) => {
    const filePath = path.resolve(params.path);
    if (!fs.existsSync(filePath)) return { success: false, message: `Error: 文件不存在: ${filePath}` };
    if (!fs.statSync(filePath).isFile()) return { success: false, message: `Error: 路径不是文件: ${filePath}` };

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const total = lines.length;
      const start = Math.max(0, (params.startLine || 1) - 1);
      const end = params.endLine ? Math.min(params.endLine, total) : total;
      const selected = lines.slice(start, end).join('\n');
      return { success: true, data: selected, message: `文件: ${filePath} (第${start + 1}-${end}行，共${total}行)` };
    } catch (e: any) {
      return { success: false, message: `Error: 读取文件失败: ${e.message}` };
    }
  },
};

const writeFile: SkillDefinition = {
  name: 'file.writeFile',
  category: 'file',
  displayName: '写入文件',
  description: '写入内容到文件',
  parameters: [
    { name: 'path', type: 'string', description: '文件的绝对或相对路径', required: true },
    { name: 'content', type: 'string', description: '要写入的内容', required: true },
    { name: 'overwrite', type: 'boolean', description: '文件存在时是否覆盖', required: false },
  ],
  execute: async (params) => {
    const filePath = path.resolve(params.path);
    if (fs.existsSync(filePath) && !params.overwrite) {
      return { success: false, message: `Error: 文件已存在: ${filePath}。设置 overwrite=true 以覆盖。` };
    }
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, params.content, 'utf-8');
      return { success: true, message: `成功写入文件: ${filePath} (${params.content.length} 字符)`, outputPath: filePath };
    } catch (e: any) {
      return { success: false, message: `Error: 写入文件失败: ${e.message}` };
    }
  },
};

const listDirectory: SkillDefinition = {
  name: 'file.listDirectory',
  category: 'file',
  displayName: '列出目录',
  description: '列出目录内容',
  parameters: [
    { name: 'path', type: 'string', description: '目录路径', required: false },
    { name: 'showHidden', type: 'boolean', description: '是否显示隐藏文件', required: false },
  ],
  execute: async (params) => {
    const dirPath = path.resolve(params.path || '.');
    if (!fs.existsSync(dirPath)) return { success: false, message: `Error: 目录不存在: ${dirPath}` };
    if (!fs.statSync(dirPath).isDirectory()) return { success: false, message: `Error: 路径不是目录: ${dirPath}` };

    try {
      let entries = fs.readdirSync(dirPath);
      if (!params.showHidden) entries = entries.filter(e => !e.startsWith('.'));
      entries.sort();

      const lines = [`目录: ${dirPath}\n`];
      for (const entry of entries) {
        const full = path.join(dirPath, entry);
        if (fs.statSync(full).isDirectory()) {
          lines.push(`  📁 ${entry}/`);
        } else {
          lines.push(`  📄 ${entry} (${formatSize(fs.statSync(full).size)})`);
        }
      }
      if (entries.length === 0) lines.push('  (空目录)');
      return { success: true, data: lines.join('\n') };
    } catch (e: any) {
      return { success: false, message: `Error: 列出目录失败: ${e.message}` };
    }
  },
};

const searchFiles: SkillDefinition = {
  name: 'file.searchFiles',
  category: 'file',
  displayName: '搜索文件',
  description: '使用 glob 模式搜索文件',
  parameters: [
    { name: 'pattern', type: 'string', description: '搜索模式，如 *.py, **/*.txt', required: true },
    { name: 'directory', type: 'string', description: '搜索的根目录', required: false },
  ],
  execute: async (params) => {
    const dir = path.resolve(params.directory || '.');
    if (!fs.existsSync(dir)) return { success: false, message: `Error: 目录不存在: ${dir}` };

    try {
      const pattern = path.join(dir, '**', params.pattern).replace(/\\/g, '/');
      const matches = glob.sync(pattern);
      if (matches.length === 0) return { success: true, message: `未找到匹配 '${params.pattern}' 的文件` };

      const maxResults = 50;
      const total = matches.length;
      const display = matches.slice(0, maxResults).map((m: string) => {
        const rel = path.relative(dir, m);
        return fs.statSync(m).isDirectory() ? `  📁 ${rel}/` : `  📄 ${rel}`;
      });
      let result = `搜索结果 (共${total}个匹配):\n` + display.join('\n');
      if (total > maxResults) result += `\n  ... 还有 ${total - maxResults} 个结果未显示`;
      return { success: true, data: result };
    } catch (e: any) {
      return { success: false, message: `Error: 搜索失败: ${e.message}` };
    }
  },
};

const createDirectory: SkillDefinition = {
  name: 'file.createDirectory',
  category: 'file',
  displayName: '创建目录',
  description: '创建目录（包括必要的父目录）',
  parameters: [
    { name: 'path', type: 'string', description: '要创建的目录路径', required: true },
  ],
  execute: async (params) => {
    try {
      const dirPath = path.resolve(params.path);
      fs.mkdirSync(dirPath, { recursive: true });
      return { success: true, message: `成功创建目录: ${dirPath}` };
    } catch (e: any) {
      return { success: false, message: `Error: 创建目录失败: ${e.message}` };
    }
  },
};

const deletePath: SkillDefinition = {
  name: 'file.deletePath',
  category: 'file',
  displayName: '删除文件或目录',
  description: '删除文件或目录',
  parameters: [
    { name: 'path', type: 'string', description: '要删除的文件或目录路径', required: true },
    { name: 'force', type: 'boolean', description: '是否强制删除非空目录', required: false },
  ],
  execute: async (params) => {
    const target = path.resolve(params.path);
    if (!fs.existsSync(target)) return { success: false, message: `Error: 路径不存在: ${target}` };

    try {
      if (fs.statSync(target).isFile()) {
        fs.unlinkSync(target);
        return { success: true, message: `成功删除文件: ${target}` };
      }
      if (params.force) {
        fs.rmSync(target, { recursive: true, force: true });
      } else {
        fs.rmdirSync(target);
      }
      return { success: true, message: `成功删除目录: ${target}` };
    } catch (e: any) {
      if (e.message.includes('not empty') || e.message.includes('ENOTEMPTY')) {
        return { success: false, message: 'Error: 目录非空。使用 force=true 强制删除。' };
      }
      return { success: false, message: `Error: 删除失败: ${e.message}` };
    }
  },
};

export const fileSkills: SkillDefinition[] = [
  readFile, writeFile, listDirectory, searchFiles, createDirectory, deletePath,
];
