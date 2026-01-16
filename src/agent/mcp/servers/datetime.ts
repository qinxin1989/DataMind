/**
 * DateTime MCP Server - 日期时间工具
 */

import { MCPServer } from '../registry';

export const datetimeServer: MCPServer = {
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
};
