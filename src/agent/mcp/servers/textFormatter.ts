/**
 * Text Formatter MCP Server - 文本内容编排和格式化工具
 */

import { MCPServer } from '../registry';

// 文本段落结构
interface TextSection {
  type: 'title' | 'subtitle' | 'paragraph' | 'list' | 'table' | 'data';
  content: string;
  items?: string[];
}

// 解析文本段落
function parseTextSections(text: string): TextSection[] {
  const sections: TextSection[] = [];
  
  let cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
  
  const titlePattern = /(?:^|\n)(?:#{1,3}\s*|[\*]{2})([^\n\*#]+)(?:[\*]{2})?/g;
  const listPattern = /(?:^|\n)(?:\d+\.|[-•●◆]|[🔍📊💡✅🌍📈🎯⚡])\s*([^\n]+)/g;
  const tablePattern = /(?:^|\n)([^\n]*\|[^\n]*)/g;
  
  let match;
  const titles: string[] = [];
  while ((match = titlePattern.exec(cleaned)) !== null) {
    titles.push(match[1].trim());
  }
  
  const listItems: string[] = [];
  const listRegex = /(?:^|\n)(?:\d+\.|[-•●◆]|[🔍📊💡✅🌍📈🎯⚡])\s*([^\n]+)/g;
  while ((match = listRegex.exec(cleaned)) !== null) {
    listItems.push(match[1].trim());
  }
  
  const tableRows: string[] = [];
  while ((match = tablePattern.exec(cleaned)) !== null) {
    if (match[1].includes('|')) {
      tableRows.push(match[1].trim());
    }
  }
  
  if (titles.length > 0) {
    sections.push({ type: 'title', content: titles[0] });
    titles.slice(1).forEach(t => {
      sections.push({ type: 'subtitle', content: t });
    });
  }
  
  if (tableRows.length > 0) {
    sections.push({ type: 'table', content: tableRows.join('\n') });
  }
  
  if (listItems.length > 0) {
    sections.push({ type: 'list', content: '', items: listItems });
  }
  
  let remaining = cleaned
    .replace(titlePattern, '')
    .replace(listRegex, '')
    .replace(tablePattern, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  if (remaining) {
    const paragraphs = remaining.split(/(?<=[。！？\.\!\?])\s*(?=[\u4e00-\u9fa5A-Z])/);
    paragraphs.forEach(p => {
      if (p.trim()) {
        sections.push({ type: 'paragraph', content: p.trim() });
      }
    });
  }
  
  return sections;
}

// 格式化为报告
function formatAsReport(sections: TextSection[]): string {
  let report = '';
  
  sections.forEach(section => {
    switch (section.type) {
      case 'title':
        report += `# ${section.content}\n\n`;
        break;
      case 'subtitle':
        report += `## ${section.content}\n\n`;
        break;
      case 'paragraph':
        report += `${section.content}\n\n`;
        break;
      case 'list':
        section.items?.forEach(item => {
          report += `- ${item}\n`;
        });
        report += '\n';
        break;
      case 'table':
        report += formatTableContent(section.content) + '\n\n';
        break;
    }
  });
  
  return report.trim();
}

// 格式化为摘要
function formatAsSummary(sections: TextSection[]): string {
  let summary = '## 摘要\n\n';
  
  const title = sections.find(s => s.type === 'title');
  if (title) {
    summary += `**主题：** ${title.content}\n\n`;
  }
  
  summary += '### 关键要点\n\n';
  const list = sections.find(s => s.type === 'list');
  if (list?.items) {
    list.items.slice(0, 5).forEach((item, i) => {
      summary += `${i + 1}. ${item}\n`;
    });
  }
  
  const paragraphs = sections.filter(s => s.type === 'paragraph');
  if (paragraphs.length > 0) {
    summary += '\n### 核心内容\n\n';
    summary += paragraphs.slice(0, 2).map(p => p.content).join('\n\n');
  }
  
  return summary;
}

// 格式化为幻灯片
function formatAsSlides(sections: TextSection[]): string {
  let slides = '';
  let slideNum = 1;
  
  const title = sections.find(s => s.type === 'title');
  if (title) {
    slides += `---\n## 幻灯片 ${slideNum++}: 封面\n\n# ${title.content}\n\n`;
  }
  
  const list = sections.find(s => s.type === 'list');
  if (list?.items && list.items.length > 0) {
    for (let i = 0; i < list.items.length; i += 3) {
      slides += `---\n## 幻灯片 ${slideNum++}: 要点\n\n`;
      list.items.slice(i, i + 3).forEach(item => {
        slides += `• ${item}\n\n`;
      });
    }
  }
  
  const table = sections.find(s => s.type === 'table');
  if (table) {
    slides += `---\n## 幻灯片 ${slideNum++}: 数据\n\n`;
    slides += formatTableContent(table.content) + '\n\n';
  }
  
  return slides;
}

// 格式化为大纲
function formatAsOutline(sections: TextSection[]): string {
  let outline = '# 大纲\n\n';
  
  const title = sections.find(s => s.type === 'title');
  if (title) {
    outline += `## ${title.content}\n\n`;
  }
  
  sections.filter(s => s.type === 'subtitle').forEach((s, i) => {
    outline += `${i + 1}. ${s.content}\n`;
  });
  
  const list = sections.find(s => s.type === 'list');
  if (list?.items) {
    outline += '\n### 要点\n';
    list.items.forEach((item, i) => {
      outline += `   ${i + 1}. ${item}\n`;
    });
  }
  
  return outline;
}

// 格式化表格内容
function formatTableContent(content: string): string {
  const rows = content.split('\n').filter(r => r.includes('|'));
  if (rows.length === 0) return content;
  
  const parsed = rows.map(row => 
    row.split('|').map(cell => cell.trim()).filter(c => c)
  );
  
  if (parsed.length === 0) return content;
  
  const header = `| ${parsed[0].join(' | ')} |`;
  const separator = `| ${parsed[0].map(() => '---').join(' | ')} |`;
  const body = parsed.slice(1).map(row => `| ${row.join(' | ')} |`).join('\n');
  
  return `${header}\n${separator}\n${body}`;
}

// 提取关键要点
function extractKeyPoints(text: string, maxPoints: number): string[] {
  const points: string[] = [];
  
  const patterns = [
    /(?:^|\n)(?:\d+\.|[-•●])\s*([^\n]+)/g,
    /(?:^|\n)[🔍📊💡✅🌍📈🎯⚡]\s*([^\n]+)/g,
    /\*\*([^*]+)\*\*/g,
    /：\s*([^。\n]+[。]?)/g
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null && points.length < maxPoints) {
      const point = match[1].trim();
      if (point.length > 5 && point.length < 200 && !points.includes(point)) {
        points.push(point);
      }
    }
  });
  
  return points.slice(0, maxPoints);
}

// 解析并格式化表格
function parseAndFormatTable(content: string, delimiter?: string): string {
  const delim = delimiter || (content.includes('|') ? '|' : content.includes('\t') ? '\t' : ',');
  
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length === 0) return content;
  
  const rows = lines.map(line => 
    line.split(delim).map(cell => cell.trim()).filter(c => c)
  );
  
  if (rows.length === 0 || rows[0].length === 0) return content;
  
  const header = `| ${rows[0].join(' | ')} |`;
  const separator = `| ${rows[0].map(() => '---').join(' | ')} |`;
  const body = rows.slice(1).map(row => `| ${row.join(' | ')} |`).join('\n');
  
  return `${header}\n${separator}\n${body}`;
}

// 清理文本
function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/([。！？\.\!\?])([^\n])/g, '$1 $2')
    .replace(/\s+([，。！？、；：])/g, '$1')
    .trim();
}

// 智能分段
function splitIntoParagraphs(text: string): string[] {
  const cleaned = cleanText(text);
  
  const paragraphs = cleaned
    .split(/\n{2,}|(?<=[。！？\.\!\?])\s*(?=[\u4e00-\u9fa5A-Z【])|(?=#{1,3}\s)|(?=\d+\.\s)/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
  
  return paragraphs;
}

export const textFormatterServer: MCPServer = {
  name: 'text_formatter',
  description: '文本内容编排和格式化工具',
  tools: [
    {
      name: 'format_report',
      description: '将杂乱的分析文本编排成结构化的报告格式（Markdown）',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: '需要编排的原始文本内容' },
          style: { type: 'string', description: '输出风格: report(报告)/summary(摘要)/slides(幻灯片)/outline(大纲)' }
        },
        required: ['content']
      },
      handler: async (input) => {
        const { content, style = 'report' } = input;
        const sections = parseTextSections(content);
        
        let formatted = '';
        switch (style) {
          case 'summary':
            formatted = formatAsSummary(sections);
            break;
          case 'slides':
            formatted = formatAsSlides(sections);
            break;
          case 'outline':
            formatted = formatAsOutline(sections);
            break;
          default:
            formatted = formatAsReport(sections);
        }
        
        return { content: [{ type: 'text', text: formatted }] };
      }
    },
    {
      name: 'extract_key_points',
      description: '从文本中提取关键要点',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: '原始文本' },
          maxPoints: { type: 'number', description: '最多提取几个要点' }
        },
        required: ['content']
      },
      handler: async (input) => {
        const { content, maxPoints = 10 } = input;
        const points = extractKeyPoints(content, maxPoints);
        return { 
          content: [{ 
            type: 'text', 
            text: points.map((p, i) => `${i + 1}. ${p}`).join('\n') 
          }] 
        };
      }
    },
    {
      name: 'format_table',
      description: '将文本中的表格数据格式化为Markdown表格',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: '包含表格数据的文本' },
          delimiter: { type: 'string', description: '分隔符，默认自动检测' }
        },
        required: ['content']
      },
      handler: async (input) => {
        const { content, delimiter } = input;
        const table = parseAndFormatTable(content, delimiter);
        return { content: [{ type: 'text', text: table }] };
      }
    },
    {
      name: 'clean_text',
      description: '清理文本，去除多余空格、特殊字符，规范标点',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: '需要清理的文本' }
        },
        required: ['content']
      },
      handler: async (input) => {
        const cleaned = cleanText(input.content);
        return { content: [{ type: 'text', text: cleaned }] };
      }
    },
    {
      name: 'split_paragraphs',
      description: '智能分段，将长文本拆分成段落',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: '长文本' }
        },
        required: ['content']
      },
      handler: async (input) => {
        const paragraphs = splitIntoParagraphs(input.content);
        return { content: [{ type: 'text', text: paragraphs.join('\n\n') }] };
      }
    }
  ]
};
