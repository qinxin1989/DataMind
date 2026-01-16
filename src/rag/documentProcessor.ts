/**
 * 文档处理器
 * 支持多种文档格式的解析和处理
 */

import * as fs from 'fs';
import * as path from 'path';
import { KnowledgeDocument, KnowledgeChunk, DocumentType } from './knowledgeBase';
import { v4 as uuidv4 } from 'uuid';

// 支持的文件类型
export type SupportedFileType = 'txt' | 'md' | 'json' | 'csv' | 'html';

export interface ProcessedDocument {
  title: string;
  content: string;
  metadata: Record<string, any>;
  sections?: { heading: string; content: string }[];
}

export class DocumentProcessor {
  
  // 处理文件
  async processFile(filePath: string): Promise<ProcessedDocument> {
    const ext = path.extname(filePath).toLowerCase().slice(1) as SupportedFileType;
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);

    switch (ext) {
      case 'txt':
        return this.processTxt(content, fileName);
      case 'md':
        return this.processMarkdown(content, fileName);
      case 'json':
        return this.processJson(content, fileName);
      case 'csv':
        return this.processCsv(content, fileName);
      case 'html':
        return this.processHtml(content, fileName);
      default:
        // 默认当作纯文本处理
        return this.processTxt(content, fileName);
    }
  }

  // 处理纯文本
  private processTxt(content: string, fileName: string): ProcessedDocument {
    return {
      title: fileName.replace(/\.[^.]+$/, ''),
      content: content.trim(),
      metadata: {
        fileType: 'txt',
        charCount: content.length,
        lineCount: content.split('\n').length,
      },
    };
  }

  // 处理 Markdown
  private processMarkdown(content: string, fileName: string): ProcessedDocument {
    const sections: { heading: string; content: string }[] = [];
    const lines = content.split('\n');
    
    let currentHeading = '';
    let currentContent: string[] = [];
    let title = fileName.replace(/\.[^.]+$/, '');

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (headingMatch) {
        // 保存之前的section
        if (currentHeading || currentContent.length > 0) {
          sections.push({
            heading: currentHeading,
            content: currentContent.join('\n').trim(),
          });
        }
        
        currentHeading = headingMatch[2];
        currentContent = [];
        
        // 第一个一级标题作为文档标题
        if (headingMatch[1] === '#' && title === fileName.replace(/\.[^.]+$/, '')) {
          title = currentHeading;
        }
      } else {
        currentContent.push(line);
      }
    }

    // 保存最后一个section
    if (currentHeading || currentContent.length > 0) {
      sections.push({
        heading: currentHeading,
        content: currentContent.join('\n').trim(),
      });
    }

    return {
      title,
      content,
      metadata: {
        fileType: 'markdown',
        sectionCount: sections.length,
      },
      sections,
    };
  }

  // 处理 JSON
  private processJson(content: string, fileName: string): ProcessedDocument {
    try {
      const data = JSON.parse(content);
      const formatted = JSON.stringify(data, null, 2);
      
      return {
        title: fileName.replace(/\.[^.]+$/, ''),
        content: formatted,
        metadata: {
          fileType: 'json',
          isArray: Array.isArray(data),
          recordCount: Array.isArray(data) ? data.length : 1,
        },
      };
    } catch (e) {
      return this.processTxt(content, fileName);
    }
  }

  // 处理 CSV
  private processCsv(content: string, fileName: string): ProcessedDocument {
    const lines = content.split('\n').filter(l => l.trim());
    const headers = lines[0]?.split(',').map(h => h.trim()) || [];
    
    // 转换为可读格式
    const records: string[] = [];
    for (let i = 1; i < Math.min(lines.length, 100); i++) {
      const values = lines[i].split(',');
      const record = headers.map((h, idx) => `${h}: ${values[idx]?.trim() || ''}`).join(', ');
      records.push(record);
    }

    return {
      title: fileName.replace(/\.[^.]+$/, ''),
      content: `字段: ${headers.join(', ')}\n\n数据记录:\n${records.join('\n')}`,
      metadata: {
        fileType: 'csv',
        headers,
        recordCount: lines.length - 1,
      },
    };
  }

  // 处理 HTML（简单提取文本）
  private processHtml(content: string, fileName: string): ProcessedDocument {
    // 移除script和style标签
    let text = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    // 提取标题
    const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : fileName.replace(/\.[^.]+$/, '');
    
    // 移除所有HTML标签
    text = text.replace(/<[^>]+>/g, ' ');
    // 清理多余空白
    text = text.replace(/\s+/g, ' ').trim();

    return {
      title,
      content: text,
      metadata: {
        fileType: 'html',
        originalLength: content.length,
      },
    };
  }

  // 处理网页内容
  processWebContent(html: string, url: string): ProcessedDocument {
    const doc = this.processHtml(html, url);
    doc.metadata.source = url;
    doc.metadata.sourceType = 'webpage';
    return doc;
  }

  // 处理纯文本笔记
  processNote(content: string, title: string): ProcessedDocument {
    return {
      title,
      content,
      metadata: {
        sourceType: 'note',
        createdAt: Date.now(),
      },
    };
  }

  // 智能分块（考虑语义边界）
  smartChunk(
    content: string, 
    documentId: string,
    options: { chunkSize?: number; overlap?: number; respectBoundaries?: boolean } = {}
  ): KnowledgeChunk[] {
    const { chunkSize = 500, overlap = 50, respectBoundaries = true } = options;
    const chunks: KnowledgeChunk[] = [];

    if (respectBoundaries) {
      // 按段落/句子边界分块
      const paragraphs = content.split(/\n\n+/);
      let currentChunk = '';
      let currentOffset = 0;
      let chunkIndex = 0;

      for (const para of paragraphs) {
        // 如果段落本身超过chunkSize，按句子分割
        if (para.length > chunkSize) {
          // 先保存当前块
          if (currentChunk.trim()) {
            chunks.push(this.createChunk(currentChunk, documentId, chunkIndex++, currentOffset));
          }
          
          // 按句子分割长段落
          const sentences = para.split(/(?<=[。！？.!?])\s*/);
          currentChunk = '';
          
          for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > chunkSize && currentChunk) {
              chunks.push(this.createChunk(currentChunk, documentId, chunkIndex++, currentOffset));
              // 保留重叠
              currentChunk = currentChunk.slice(-overlap) + sentence;
            } else {
              currentChunk += sentence;
            }
          }
        } else if (currentChunk.length + para.length > chunkSize) {
          // 保存当前块
          chunks.push(this.createChunk(currentChunk, documentId, chunkIndex++, currentOffset));
          // 保留重叠开始新块
          currentChunk = currentChunk.slice(-overlap) + '\n\n' + para;
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + para;
        }
        
        currentOffset += para.length + 2;
      }

      // 保存最后一块
      if (currentChunk.trim()) {
        chunks.push(this.createChunk(currentChunk, documentId, chunkIndex, currentOffset));
      }
    } else {
      // 简单按字符数分块
      for (let i = 0; i < content.length; i += chunkSize - overlap) {
        const chunkContent = content.slice(i, i + chunkSize);
        chunks.push(this.createChunk(chunkContent, documentId, chunks.length, i));
      }
    }

    return chunks;
  }

  private createChunk(
    content: string, 
    documentId: string, 
    index: number, 
    offset: number
  ): KnowledgeChunk {
    return {
      id: uuidv4(),
      documentId,
      content: content.trim(),
      index,
      startOffset: offset,
      endOffset: offset + content.length,
    };
  }

  // 提取关键词（简单实现）
  extractKeywords(content: string, topK: number = 10): string[] {
    // 移除标点和数字
    const cleaned = content.replace(/[^\u4e00-\u9fa5a-zA-Z\s]/g, ' ');
    const words = cleaned.split(/\s+/).filter(w => w.length > 1);
    
    // 词频统计
    const freq: Record<string, number> = {};
    for (const word of words) {
      const lower = word.toLowerCase();
      freq[lower] = (freq[lower] || 0) + 1;
    }

    // 排序取TopK
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([word]) => word);
  }

  // 提取实体（简单规则匹配）
  extractEntities(content: string): { type: string; value: string; position: number }[] {
    const entities: { type: string; value: string; position: number }[] = [];

    // 日期
    const dateRegex = /\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?/g;
    let match;
    while ((match = dateRegex.exec(content)) !== null) {
      entities.push({ type: 'date', value: match[0], position: match.index });
    }

    // 数字+单位
    const numberRegex = /\d+(?:\.\d+)?(?:万|亿|千|百|%|元|个|件|次|人)/g;
    while ((match = numberRegex.exec(content)) !== null) {
      entities.push({ type: 'metric', value: match[0], position: match.index });
    }

    // 中文人名（简单：2-4个汉字）
    // 这里只是示例，实际需要NER模型
    const nameRegex = /(?:张|王|李|刘|陈|杨|黄|赵|周|吴|徐|孙|马|朱|胡|郭|何|高|林|罗|郑|梁)[\u4e00-\u9fa5]{1,3}/g;
    while ((match = nameRegex.exec(content)) !== null) {
      entities.push({ type: 'person', value: match[0], position: match.index });
    }

    return entities;
  }
}
