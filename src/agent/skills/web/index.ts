/**
 * Web Skill - HTTP 请求与网络操作
 * 移植自 ai-agent-plus web_tools.py
 */

import axios from 'axios';
import { SkillDefinition } from '../registry';

const fetchUrl: SkillDefinition = {
  name: 'web.fetchUrl',
  category: 'web',
  displayName: '获取网页内容',
  description: '获取指定 URL 的内容（GET 请求）',
  parameters: [
    { name: 'url', type: 'string', description: '目标 URL', required: true },
    { name: 'timeout', type: 'number', description: '超时时间（秒）', required: false },
  ],
  execute: async (params) => {
    try {
      const resp = await axios.get(params.url, {
        timeout: (params.timeout || 15) * 1000,
        maxContentLength: 2 * 1024 * 1024,
        responseType: 'text',
        headers: { 'User-Agent': 'DataMind-Agent/1.0' },
      });
      const text = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
      const truncated = text.length > 8000 ? text.slice(0, 8000) + `\n...(共${text.length}字符)` : text;
      return { success: true, data: truncated, message: `HTTP ${resp.status} OK` };
    } catch (e: any) {
      return { success: false, message: `Error: HTTP 请求失败: ${e.message}` };
    }
  },
};

const httpRequest: SkillDefinition = {
  name: 'web.httpRequest',
  category: 'web',
  displayName: 'HTTP 请求',
  description: '发送自定义 HTTP 请求（GET/POST/PUT/DELETE 等）',
  parameters: [
    { name: 'url', type: 'string', description: '目标 URL', required: true },
    { name: 'method', type: 'string', description: 'HTTP 方法（GET/POST/PUT/DELETE）', required: false },
    { name: 'headers', type: 'object', description: '请求头', required: false },
    { name: 'body', type: 'object', description: '请求体（JSON）', required: false },
    { name: 'timeout', type: 'number', description: '超时时间（秒）', required: false },
  ],
  execute: async (params) => {
    try {
      const resp = await axios({
        url: params.url,
        method: (params.method || 'GET').toUpperCase(),
        headers: params.headers || {},
        data: params.body,
        timeout: (params.timeout || 15) * 1000,
        maxContentLength: 2 * 1024 * 1024,
        validateStatus: () => true,
      });
      const text = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data, null, 2);
      const truncated = text.length > 8000 ? text.slice(0, 8000) + '\n...(截断)' : text;
      return { success: true, data: truncated, message: `HTTP ${resp.status} ${resp.statusText}` };
    } catch (e: any) {
      return { success: false, message: `Error: HTTP 请求失败: ${e.message}` };
    }
  },
};

const getCurrentTime: SkillDefinition = {
  name: 'web.getCurrentTime',
  category: 'web',
  displayName: '获取当前时间',
  description: '获取服务器当前时间',
  parameters: [],
  execute: async () => {
    const now = new Date();
    return {
      success: true,
      data: {
        iso: now.toISOString(),
        local: now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
        timestamp: now.getTime(),
      },
    };
  },
};

export const webSkills: SkillDefinition[] = [fetchUrl, httpRequest, getCurrentTime];
