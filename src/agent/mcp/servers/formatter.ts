/**
 * Formatter MCP Server - 数据格式化工具
 */

import { MCPServer } from '../registry';

export const formatterServer: MCPServer = {
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
};
