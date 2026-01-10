// MCP (Model Context Protocol) 集成
// 支持外部工具调用，扩展AI能力

import { pptGenerator, PPTConfig, SlideContent } from './pptGenerator';
import * as fs from 'fs';
import * as path from 'path';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
  handler: (input: Record<string, any>) => Promise<MCPToolResult>;
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface MCPServer {
  name: string;
  description: string;
  tools: MCPTool[];
}

// MCP 工具注册中心
export class MCPRegistry {
  private servers = new Map<string, MCPServer>();
  private tools = new Map<string, { server: string; tool: MCPTool }>();

  // 注册 MCP 服务器
  registerServer(server: MCPServer) {
    this.servers.set(server.name, server);
    for (const tool of server.tools) {
      this.tools.set(`${server.name}__${tool.name}`, { server: server.name, tool });
    }
  }

  // 获取所有可用工具
  getAllTools(): Array<{ serverName: string; tool: MCPTool }> {
    return Array.from(this.tools.values()).map(({ server, tool }) => ({
      serverName: server,
      tool
    }));
  }

  // 调用工具
  async callTool(serverName: string, toolName: string, input: Record<string, any>): Promise<MCPToolResult> {
    const key = `${serverName}__${toolName}`;
    const entry = this.tools.get(key);
    
    if (!entry) {
      return {
        content: [{ type: 'text', text: `工具 ${toolName} 不存在` }],
        isError: true
      };
    }

    try {
      return await entry.tool.handler(input);
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `工具执行失败: ${error.message}` }],
        isError: true
      };
    }
  }

  // 获取工具描述（供AI选择）
  getToolDescriptions(): string {
    const tools = this.getAllTools();
    if (tools.length === 0) return '暂无可用的MCP工具';
    
    return tools.map(({ serverName, tool }) => {
      const params = Object.entries(tool.inputSchema.properties)
        .map(([name, schema]) => `${name}(${schema.type}): ${schema.description}`)
        .join('; ');
      return `- [${serverName}] ${tool.name}: ${tool.description}\n  参数: ${params}`;
    }).join('\n');
  }
}

// 内置 MCP 工具服务器
function createBuiltinServers(): MCPServer[] {
  return [
    // 计算工具服务器
    {
      name: 'calculator',
      description: '数学计算工具',
      tools: [
        {
          name: 'calculate',
          description: '执行数学表达式计算',
          inputSchema: {
            type: 'object',
            properties: {
              expression: { type: 'string', description: '数学表达式，如 "2+3*4"' }
            },
            required: ['expression']
          },
          handler: async (input) => {
            try {
              // 安全的数学表达式计算
              const expr = input.expression.replace(/[^0-9+\-*/().%\s]/g, '');
              const result = Function(`"use strict"; return (${expr})`)();
              return { content: [{ type: 'text', text: `计算结果: ${result}` }] };
            } catch {
              return { content: [{ type: 'text', text: '表达式无效' }], isError: true };
            }
          }
        },
        {
          name: 'percentage',
          description: '计算百分比',
          inputSchema: {
            type: 'object',
            properties: {
              value: { type: 'number', description: '数值' },
              total: { type: 'number', description: '总数' }
            },
            required: ['value', 'total']
          },
          handler: async (input) => {
            const pct = ((input.value / input.total) * 100).toFixed(2);
            return { content: [{ type: 'text', text: `${input.value} 占 ${input.total} 的 ${pct}%` }] };
          }
        }
      ]
    },
    // 时间工具服务器
    {
      name: 'datetime',
      description: '日期时间工具',
      tools: [
        {
          name: 'now',
          description: '获取当前时间',
          inputSchema: {
            type: 'object',
            properties: {
              format: { type: 'string', description: '格式: date/time/datetime/timestamp' }
            }
          },
          handler: async (input) => {
            const now = new Date();
            let result: string;
            switch (input.format) {
              case 'date': result = now.toISOString().split('T')[0]; break;
              case 'time': result = now.toTimeString().split(' ')[0]; break;
              case 'timestamp': result = now.getTime().toString(); break;
              default: result = now.toISOString();
            }
            return { content: [{ type: 'text', text: result }] };
          }
        },
        {
          name: 'date_diff',
          description: '计算两个日期之间的差值',
          inputSchema: {
            type: 'object',
            properties: {
              date1: { type: 'string', description: '日期1 (YYYY-MM-DD)' },
              date2: { type: 'string', description: '日期2 (YYYY-MM-DD)' },
              unit: { type: 'string', description: '单位: days/hours/minutes' }
            },
            required: ['date1', 'date2']
          },
          handler: async (input) => {
            const d1 = new Date(input.date1);
            const d2 = new Date(input.date2);
            const diffMs = Math.abs(d2.getTime() - d1.getTime());
            
            let result: number;
            const unit = input.unit || 'days';
            switch (unit) {
              case 'hours': result = diffMs / (1000 * 60 * 60); break;
              case 'minutes': result = diffMs / (1000 * 60); break;
              default: result = diffMs / (1000 * 60 * 60 * 24);
            }
            return { content: [{ type: 'text', text: `相差 ${result.toFixed(2)} ${unit}` }] };
          }
        }
      ]
    },
    // 格式化工具服务器
    {
      name: 'formatter',
      description: '数据格式化工具',
      tools: [
        {
          name: 'format_number',
          description: '格式化数字（千分位、货币等）',
          inputSchema: {
            type: 'object',
            properties: {
              value: { type: 'number', description: '数值' },
              style: { type: 'string', description: '样式: decimal/currency/percent' },
              currency: { type: 'string', description: '货币代码，如 CNY/USD' }
            },
            required: ['value']
          },
          handler: async (input) => {
            const options: Intl.NumberFormatOptions = { style: input.style || 'decimal' };
            if (input.style === 'currency') {
              options.currency = input.currency || 'CNY';
            }
            const formatted = new Intl.NumberFormat('zh-CN', options).format(input.value);
            return { content: [{ type: 'text', text: formatted }] };
          }
        },
        {
          name: 'json_to_table',
          description: '将JSON数组转换为Markdown表格',
          inputSchema: {
            type: 'object',
            properties: {
              data: { type: 'string', description: 'JSON数组字符串' }
            },
            required: ['data']
          },
          handler: async (input) => {
            try {
              const data = JSON.parse(input.data);
              if (!Array.isArray(data) || data.length === 0) {
                return { content: [{ type: 'text', text: '数据为空' }] };
              }
              
              const headers = Object.keys(data[0]);
              const headerRow = `| ${headers.join(' | ')} |`;
              const separator = `| ${headers.map(() => '---').join(' | ')} |`;
              const rows = data.map(row => `| ${headers.map(h => row[h] ?? '').join(' | ')} |`);
              
              return { content: [{ type: 'text', text: [headerRow, separator, ...rows].join('\n') }] };
            } catch {
              return { content: [{ type: 'text', text: 'JSON解析失败' }], isError: true };
            }
          }
        }
      ]
    }
  ];
}

// 文本编排工具服务器
function createTextFormatterServer(): MCPServer {
  return {
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
          
          // 解析文本中的结构
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
}

// ========== 文本处理辅助函数 ==========

interface TextSection {
  type: 'title' | 'subtitle' | 'paragraph' | 'list' | 'table' | 'data';
  content: string;
  items?: string[];
}

function parseTextSections(text: string): TextSection[] {
  const sections: TextSection[] = [];
  
  // 清理文本
  let cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
  
  // 识别标题（### 或 **文字**）
  const titlePattern = /(?:^|\n)(?:#{1,3}\s*|[\*]{2})([^\n\*#]+)(?:[\*]{2})?/g;
  // 识别列表项（数字. 或 - 或 emoji开头）
  const listPattern = /(?:^|\n)(?:\d+\.|[-•●◆]|[🔍📊💡✅🌍📈🎯⚡])\s*([^\n]+)/g;
  // 识别表格行（包含 | 分隔符）
  const tablePattern = /(?:^|\n)([^\n]*\|[^\n]*)/g;
  
  // 提取标题
  let match;
  const titles: string[] = [];
  while ((match = titlePattern.exec(cleaned)) !== null) {
    titles.push(match[1].trim());
  }
  
  // 提取列表项
  const listItems: string[] = [];
  const listRegex = /(?:^|\n)(?:\d+\.|[-•●◆]|[🔍📊💡✅🌍📈🎯⚡])\s*([^\n]+)/g;
  while ((match = listRegex.exec(cleaned)) !== null) {
    listItems.push(match[1].trim());
  }
  
  // 提取表格数据
  const tableRows: string[] = [];
  while ((match = tablePattern.exec(cleaned)) !== null) {
    if (match[1].includes('|')) {
      tableRows.push(match[1].trim());
    }
  }
  
  // 构建结构
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
  
  // 剩余内容作为段落
  let remaining = cleaned
    .replace(titlePattern, '')
    .replace(listRegex, '')
    .replace(tablePattern, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  if (remaining) {
    // 按句号或换行分段
    const paragraphs = remaining.split(/(?<=[。！？\.\!\?])\s*(?=[\u4e00-\u9fa5A-Z])/);
    paragraphs.forEach(p => {
      if (p.trim()) {
        sections.push({ type: 'paragraph', content: p.trim() });
      }
    });
  }
  
  return sections;
}

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

function formatAsSlides(sections: TextSection[]): string {
  let slides = '';
  let slideNum = 1;
  
  const title = sections.find(s => s.type === 'title');
  if (title) {
    slides += `---\n## 幻灯片 ${slideNum++}: 封面\n\n# ${title.content}\n\n`;
  }
  
  const list = sections.find(s => s.type === 'list');
  if (list?.items && list.items.length > 0) {
    // 每3个要点一页
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

function formatTableContent(content: string): string {
  const rows = content.split('\n').filter(r => r.includes('|'));
  if (rows.length === 0) return content;
  
  // 解析列
  const parsed = rows.map(row => 
    row.split('|').map(cell => cell.trim()).filter(c => c)
  );
  
  if (parsed.length === 0) return content;
  
  // 生成Markdown表格
  const header = `| ${parsed[0].join(' | ')} |`;
  const separator = `| ${parsed[0].map(() => '---').join(' | ')} |`;
  const body = parsed.slice(1).map(row => `| ${row.join(' | ')} |`).join('\n');
  
  return `${header}\n${separator}\n${body}`;
}

function extractKeyPoints(text: string, maxPoints: number): string[] {
  const points: string[] = [];
  
  // 提取带标记的要点
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

function parseAndFormatTable(content: string, delimiter?: string): string {
  // 自动检测分隔符
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

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/([。！？\.\!\?])([^\n])/g, '$1 $2')
    .replace(/\s+([，。！？、；：])/g, '$1')
    .trim();
}

function splitIntoParagraphs(text: string): string[] {
  // 先清理
  const cleaned = cleanText(text);
  
  // 按多种方式分段
  const paragraphs = cleaned
    .split(/\n{2,}|(?<=[。！？\.\!\?])\s*(?=[\u4e00-\u9fa5A-Z【])|(?=#{1,3}\s)|(?=\d+\.\s)/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
  
  return paragraphs;
}

// 创建全局 MCP 注册中心
export const mcpRegistry = new MCPRegistry();

// 注册内置服务器
for (const server of createBuiltinServers()) {
  mcpRegistry.registerServer(server);
}

// 注册文本编排服务器
mcpRegistry.registerServer(createTextFormatterServer());

// PPT 生成工具服务器
function createPPTServer(): MCPServer {
  return {
    name: 'ppt_generator',
    description: 'PPT演示文稿生成工具',
    tools: [
      {
        name: 'create_ppt',
        description: '根据内容生成PPT文件，返回文件路径',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'PPT标题' },
            theme: { type: 'string', description: '主题风格: default/dark/corporate/minimal' },
            slides: { type: 'string', description: 'JSON格式的幻灯片数组' },
            outputPath: { type: 'string', description: '输出文件路径（可选）' }
          },
          required: ['title', 'slides']
        },
        handler: async (input) => {
          try {
            const slides: SlideContent[] = typeof input.slides === 'string' 
              ? JSON.parse(input.slides) 
              : input.slides;
            
            const config: PPTConfig = {
              title: input.title,
              theme: input.theme || 'default',
              slides
            };
            
            const buffer = await pptGenerator.generate(config);
            
            // 保存文件
            const outputDir = path.join(process.cwd(), 'public', 'downloads');
            if (!fs.existsSync(outputDir)) {
              fs.mkdirSync(outputDir, { recursive: true });
            }
            
            const filename = input.outputPath || `report_${Date.now()}.pptx`;
            const filepath = path.join(outputDir, filename);
            fs.writeFileSync(filepath, buffer);
            
            return { 
              content: [{ 
                type: 'text', 
                text: `PPT已生成: /downloads/${filename}\n可通过 http://localhost:3001/downloads/${filename} 下载` 
              }] 
            };
          } catch (error: any) {
            return { content: [{ type: 'text', text: `生成失败: ${error.message}` }], isError: true };
          }
        }
      },
      {
        name: 'create_ppt_from_text',
        description: '从文本内容自动生成PPT（自动拆分幻灯片）',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'PPT标题' },
            content: { type: 'string', description: '要转换的文本内容' },
            theme: { type: 'string', description: '主题风格' }
          },
          required: ['title', 'content']
        },
        handler: async (input) => {
          try {
            const slides = textToSlides(input.title, input.content);
            
            const config: PPTConfig = {
              title: input.title,
              theme: input.theme || 'default',
              slides
            };
            
            const buffer = await pptGenerator.generate(config);
            
            const outputDir = path.join(process.cwd(), 'public', 'downloads');
            if (!fs.existsSync(outputDir)) {
              fs.mkdirSync(outputDir, { recursive: true });
            }
            
            const filename = `report_${Date.now()}.pptx`;
            const filepath = path.join(outputDir, filename);
            fs.writeFileSync(filepath, buffer);
            
            return { 
              content: [{ 
                type: 'text', 
                text: `PPT已生成（共${slides.length}页）: /downloads/${filename}\n下载地址: http://localhost:3001/downloads/${filename}` 
              }] 
            };
          } catch (error: any) {
            return { content: [{ type: 'text', text: `生成失败: ${error.message}` }], isError: true };
          }
        }
      },
      {
        name: 'create_data_report_ppt',
        description: '根据数据分析结果生成数据报告PPT',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '报告标题' },
            summary: { type: 'string', description: '摘要/结论' },
            insights: { type: 'string', description: 'JSON数组格式的关键发现' },
            tableData: { type: 'string', description: 'JSON二维数组格式的表格数据' },
            chartData: { type: 'string', description: 'JSON格式的图表数据 {type, labels, values}' },
            recommendations: { type: 'string', description: 'JSON数组格式的建议' },
            theme: { type: 'string', description: '主题风格' }
          },
          required: ['title']
        },
        handler: async (input) => {
          try {
            const slides: SlideContent[] = [];
            
            // 封面
            slides.push({
              type: 'title',
              title: input.title,
              subtitle: new Date().toLocaleDateString('zh-CN') + ' 数据分析报告'
            });
            
            // 摘要页
            if (input.summary) {
              slides.push({
                type: 'content',
                title: '报告摘要',
                content: input.summary
              });
            }
            
            // 关键发现
            if (input.insights) {
              const insights = JSON.parse(input.insights);
              slides.push({
                type: 'bullets',
                title: '关键发现',
                bullets: insights
              });
            }
            
            // 数据表格
            if (input.tableData) {
              const tableData = JSON.parse(input.tableData);
              slides.push({
                type: 'table',
                title: '数据详情',
                tableData
              });
            }
            
            // 图表
            if (input.chartData) {
              const chartData = JSON.parse(input.chartData);
              slides.push({
                type: 'chart',
                title: '数据可视化',
                chartData
              });
            }
            
            // 建议
            if (input.recommendations) {
              const recommendations = JSON.parse(input.recommendations);
              slides.push({
                type: 'bullets',
                title: '建议与行动',
                bullets: recommendations
              });
            }
            
            // 结束页
            slides.push({
              type: 'title',
              title: '谢谢',
              subtitle: 'AI Data Platform 自动生成'
            });
            
            const config: PPTConfig = {
              title: input.title,
              theme: input.theme || 'corporate',
              slides
            };
            
            const buffer = await pptGenerator.generate(config);
            
            const outputDir = path.join(process.cwd(), 'public', 'downloads');
            if (!fs.existsSync(outputDir)) {
              fs.mkdirSync(outputDir, { recursive: true });
            }
            
            const filename = `data_report_${Date.now()}.pptx`;
            const filepath = path.join(outputDir, filename);
            fs.writeFileSync(filepath, buffer);
            
            return { 
              content: [{ 
                type: 'text', 
                text: `数据报告PPT已生成（共${slides.length}页）\n下载: http://localhost:3001/downloads/${filename}` 
              }] 
            };
          } catch (error: any) {
            return { content: [{ type: 'text', text: `生成失败: ${error.message}` }], isError: true };
          }
        }
      }
    ]
  };
}

// 文本自动转幻灯片
function textToSlides(title: string, content: string): SlideContent[] {
  const slides: SlideContent[] = [];
  
  // 封面
  slides.push({
    type: 'title',
    title: title,
    subtitle: new Date().toLocaleDateString('zh-CN')
  });
  
  // 解析内容
  const sections = content.split(/(?=#{1,3}\s)|(?=\n\n)/g).filter(s => s.trim());
  
  let currentBullets: string[] = [];
  let currentTitle = '内容';
  
  for (const section of sections) {
    const trimmed = section.trim();
    
    // 检测标题
    const titleMatch = trimmed.match(/^#{1,3}\s*(.+)/);
    if (titleMatch) {
      // 保存之前的要点
      if (currentBullets.length > 0) {
        slides.push({
          type: 'bullets',
          title: currentTitle,
          bullets: currentBullets
        });
        currentBullets = [];
      }
      currentTitle = titleMatch[1].replace(/[#*]/g, '').trim();
      continue;
    }
    
    // 检测列表项
    const listItems = trimmed.match(/(?:^|\n)[-•●\d.]\s*([^\n]+)/g);
    if (listItems) {
      listItems.forEach(item => {
        const text = item.replace(/^[\n\-•●\d.\s]+/, '').trim();
        if (text) currentBullets.push(text);
      });
      
      // 每5个要点一页
      if (currentBullets.length >= 5) {
        slides.push({
          type: 'bullets',
          title: currentTitle,
          bullets: currentBullets.slice(0, 5)
        });
        currentBullets = currentBullets.slice(5);
      }
      continue;
    }
    
    // 普通段落
    if (trimmed.length > 20) {
      // 长段落作为内容页
      if (currentBullets.length > 0) {
        slides.push({
          type: 'bullets',
          title: currentTitle,
          bullets: currentBullets
        });
        currentBullets = [];
      }
      
      slides.push({
        type: 'content',
        title: currentTitle,
        content: trimmed.slice(0, 500)
      });
    } else if (trimmed.length > 5) {
      // 短文本作为要点
      currentBullets.push(trimmed);
    }
  }
  
  // 保存剩余要点
  if (currentBullets.length > 0) {
    slides.push({
      type: 'bullets',
      title: currentTitle,
      bullets: currentBullets
    });
  }
  
  // 结束页
  slides.push({
    type: 'title',
    title: '谢谢',
    subtitle: ''
  });
  
  return slides;
}

// 注册 PPT 服务器
mcpRegistry.registerServer(createPPTServer());
