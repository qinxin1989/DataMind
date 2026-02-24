/**
 * Frontmatter 解析器
 * 从 SKILL.md 的 YAML frontmatter (---...---) 中提取元数据
 */

import * as yaml from 'js-yaml';

export interface FrontmatterResult {
  meta: Record<string, any>;
  body: string;
}

/**
 * 解析 Markdown 文件的 YAML frontmatter
 * @param markdown 完整 Markdown 文本
 * @returns { meta: 解析后的对象, body: frontmatter 之后的正文 }
 */
export function parseFrontmatter(markdown: string): FrontmatterResult {
  const lines = markdown.split('\n');

  if (!lines.length || lines[0].trim() !== '---') {
    return { meta: {}, body: markdown };
  }

  let endIndex: number | null = null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === null) {
    return { meta: {}, body: markdown };
  }

  const frontmatterText = lines.slice(1, endIndex).join('\n').trim();
  const body = lines.slice(endIndex + 1).join('\n').replace(/^\n+/, '');

  let data: any = {};
  if (frontmatterText) {
    try {
      data = yaml.load(frontmatterText) || {};
    } catch {
      data = {};
    }
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    data = { _: data };
  }

  return { meta: data, body };
}
