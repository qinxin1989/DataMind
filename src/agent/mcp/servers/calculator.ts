/**
 * Calculator MCP Server - 数学计算工具
 */

import { MCPServer } from '../registry';

export const calculatorServer: MCPServer = {
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
};
