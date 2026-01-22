#!/usr/bin/env node

/**
 * Skills MCP Server
 * 提供 Agent Skills 的 MCP 服务器
 * 支持数据处理、文档转换、媒体处理、报告生成等技能
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// 加载环境变量策略：
// 1. 优先尝试根目录 .env
// 2. 如果不存在，尝试根目录 .env.encrypted (读取其中的未加密字段)
const rootDir = path.resolve(process.cwd(), '../../');
const envFile = path.join(rootDir, '.env');
const encryptedEnvFile = path.join(rootDir, '.env.encrypted');

if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
} else if (fs.existsSync(encryptedEnvFile)) {
  try {
    const envConfig = dotenv.parse(fs.readFileSync(encryptedEnvFile));
    for (const k in envConfig) {
      // 忽略已加密的字段 (SM4ENC:...)，仅加载明文配置
      if (!envConfig[k].startsWith('SM4ENC:')) {
        process.env[k] = envConfig[k];
      }
    }
    console.log('已从 .env.encrypted 加载未加密的配置');
  } catch (error) {
    console.warn('读取 .env.encrypted 失败:', error);
  }
}

// 后端服务地址
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

// 定义所有技能工具
const tools: Tool[] = [
  // ========== 数据处理技能 ==========
  {
    name: 'data_query',
    description: '根据自然语言问题查询数据源',
    inputSchema: {
      type: 'object',
      properties: {
        datasourceId: { type: 'string', description: '数据源ID' },
        question: { type: 'string', description: '自然语言问题' },
        limit: { type: 'number', description: '返回行数限制', default: 20 }
      },
      required: ['datasourceId', 'question']
    }
  },
  {
    name: 'data_analyze',
    description: '对数据源进行综合分析，生成分析报告',
    inputSchema: {
      type: 'object',
      properties: {
        datasourceId: { type: 'string', description: '数据源ID' },
        topic: { type: 'string', description: '分析主题' },
        depth: { type: 'string', enum: ['quick', 'normal', 'deep'], description: '分析深度' }
      },
      required: ['datasourceId', 'topic']
    }
  },
  {
    name: 'data_summarize',
    description: '生成数据源的概要信息',
    inputSchema: {
      type: 'object',
      properties: {
        datasourceId: { type: 'string', description: '数据源ID' },
        tables: { type: 'array', items: { type: 'string' }, description: '指定表名' }
      },
      required: ['datasourceId']
    }
  },
  {
    name: 'data_join',
    description: '跨多个表进行关联查询',
    inputSchema: {
      type: 'object',
      properties: {
        datasourceId: { type: 'string', description: '数据源ID' },
        tables: { type: 'array', items: { type: 'string' }, description: '要关联的表名' },
        joinFields: { type: 'object', description: '关联字段映射' },
        selectFields: { type: 'array', items: { type: 'string' }, description: '选择的字段' }
      },
      required: ['datasourceId', 'tables', 'joinFields']
    }
  },
  {
    name: 'data_clean',
    description: '检测并清洗数据质量问题',
    inputSchema: {
      type: 'object',
      properties: {
        datasourceId: { type: 'string', description: '数据源ID' },
        table: { type: 'string', description: '表名' },
        rules: { type: 'array', description: '清洗规则' }
      },
      required: ['datasourceId', 'table']
    }
  },

  // ========== 文档处理技能 ==========
  {
    name: 'document_pdf_to_word',
    description: '将PDF文档转换为Word格式',
    inputSchema: {
      type: 'object',
      properties: {
        inputPath: { type: 'string', description: '输入PDF文件路径' },
        outputPath: { type: 'string', description: '输出Word文件路径' },
        preserveLayout: { type: 'boolean', description: '是否保留布局', default: true }
      },
      required: ['inputPath']
    }
  },
  {
    name: 'document_word_to_pdf',
    description: '将Word文档转换为PDF格式',
    inputSchema: {
      type: 'object',
      properties: {
        inputPath: { type: 'string', description: '输入Word文件路径' },
        outputPath: { type: 'string', description: '输出PDF文件路径' }
      },
      required: ['inputPath']
    }
  },
  {
    name: 'document_merge',
    description: '合并多个文档为一个',
    inputSchema: {
      type: 'object',
      properties: {
        inputPaths: { type: 'array', items: { type: 'string' }, description: '输入文件路径列表' },
        outputPath: { type: 'string', description: '输出文件路径' },
        format: { type: 'string', enum: ['pdf', 'docx'], description: '输出格式' }
      },
      required: ['inputPaths', 'outputPath']
    }
  },
  {
    name: 'document_extract_text',
    description: '从文档中提取纯文本内容',
    inputSchema: {
      type: 'object',
      properties: {
        inputPath: { type: 'string', description: '输入文件路径' },
        pages: { type: 'array', items: { type: 'number' }, description: '指定页码' }
      },
      required: ['inputPath']
    }
  },
  {
    name: 'document_extract_tables',
    description: '从文档中提取表格数据',
    inputSchema: {
      type: 'object',
      properties: {
        inputPath: { type: 'string', description: '输入文件路径' },
        format: { type: 'string', enum: ['json', 'csv', 'xlsx'], description: '输出格式' }
      },
      required: ['inputPath']
    }
  },
  {
    name: 'document_split',
    description: '将文档按页拆分为多个文件',
    inputSchema: {
      type: 'object',
      properties: {
        inputPath: { type: 'string', description: '输入文件路径' },
        outputDir: { type: 'string', description: '输出目录' },
        pagesPerFile: { type: 'number', description: '每个文件的页数', default: 1 }
      },
      required: ['inputPath', 'outputDir']
    }
  },

  // ========== 媒体处理技能 ==========
  {
    name: 'media_ocr',
    description: '使用OCR识别图片中的文字',
    inputSchema: {
      type: 'object',
      properties: {
        imagePath: { type: 'string', description: '图片路径或Base64' },
        language: { type: 'string', description: '识别语言', default: 'ch' },
        outputFormat: { type: 'string', enum: ['text', 'json', 'markdown'], description: '输出格式' }
      },
      required: ['imagePath']
    }
  },
  {
    name: 'media_image_convert',
    description: '转换图片格式',
    inputSchema: {
      type: 'object',
      properties: {
        inputPath: { type: 'string', description: '输入图片路径' },
        outputFormat: { type: 'string', enum: ['png', 'jpg', 'webp', 'gif'], description: '目标格式' },
        quality: { type: 'number', description: '质量 0-100', default: 85 },
        resize: { type: 'object', properties: { width: { type: 'number' }, height: { type: 'number' } }, description: '调整尺寸' }
      },
      required: ['inputPath', 'outputFormat']
    }
  },
  {
    name: 'media_image_compress',
    description: '压缩图片文件大小',
    inputSchema: {
      type: 'object',
      properties: {
        inputPath: { type: 'string', description: '输入图片路径' },
        targetSize: { type: 'number', description: '目标大小(KB)' },
        quality: { type: 'number', description: '质量 0-100', default: 80 }
      },
      required: ['inputPath']
    }
  },
  {
    name: 'media_chart_generate',
    description: '根据数据生成图表图片',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['bar', 'line', 'pie', 'scatter'], description: '图表类型' },
        data: { type: 'array', description: '图表数据' },
        config: { type: 'object', description: '图表配置' },
        outputFormat: { type: 'string', enum: ['png', 'svg'], description: '输出格式' }
      },
      required: ['type', 'data']
    }
  },
  {
    name: 'media_screenshot',
    description: '对网页进行截图',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '网页URL' },
        fullPage: { type: 'boolean', description: '是否全页截图', default: false },
        viewport: { type: 'object', properties: { width: { type: 'number' }, height: { type: 'number' } }, description: '视口大小' }
      },
      required: ['url']
    }
  },
  {
    name: 'media_qrcode',
    description: '生成或识别二维码',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['generate', 'decode'], description: '操作类型' },
        content: { type: 'string', description: '生成时的内容' },
        imagePath: { type: 'string', description: '识别时的图片路径' }
      },
      required: ['action']
    }
  },

  // ========== 报告生成技能 ==========
  {
    name: 'report_ppt',
    description: '根据数据和主题生成PPT演示文稿',
    inputSchema: {
      type: 'object',
      properties: {
        datasourceId: { type: 'string', description: '数据源ID' },
        topic: { type: 'string', description: '报告主题' },
        template: { type: 'string', description: '模板名称' },
        slides: { type: 'number', description: '幻灯片数量', default: 10 },
        style: { type: 'string', enum: ['business', 'tech', 'simple'], description: '风格' }
      },
      required: ['datasourceId', 'topic']
    }
  },
  {
    name: 'report_dashboard',
    description: '生成数据可视化大屏',
    inputSchema: {
      type: 'object',
      properties: {
        datasourceId: { type: 'string', description: '数据源ID' },
        topic: { type: 'string', description: '大屏主题' },
        theme: { type: 'string', enum: ['dark', 'light'], description: '主题' },
        layout: { type: 'string', enum: ['auto', 'grid', 'flow'], description: '布局' },
        charts: { type: 'array', description: '指定图表配置' }
      },
      required: ['datasourceId', 'topic']
    }
  },
  {
    name: 'report_summary',
    description: '生成数据摘要文档',
    inputSchema: {
      type: 'object',
      properties: {
        datasourceId: { type: 'string', description: '数据源ID' },
        topic: { type: 'string', description: '摘要主题' },
        format: { type: 'string', enum: ['markdown', 'html', 'pdf'], description: '输出格式' },
        sections: { type: 'array', items: { type: 'string' }, description: '包含的章节' }
      },
      required: ['datasourceId']
    }
  },
  {
    name: 'report_excel',
    description: '生成Excel数据报表',
    inputSchema: {
      type: 'object',
      properties: {
        datasourceId: { type: 'string', description: '数据源ID' },
        queries: { type: 'array', description: '查询配置列表' },
        template: { type: 'string', description: 'Excel模板路径' },
        charts: { type: 'boolean', description: '是否包含图表', default: true }
      },
      required: ['datasourceId', 'queries']
    }
  },
  {
    name: 'report_insight',
    description: '自动发现数据中的关键洞察',
    inputSchema: {
      type: 'object',
      properties: {
        datasourceId: { type: 'string', description: '数据源ID' },
        focus: { type: 'string', description: '关注点' },
        depth: { type: 'string', enum: ['quick', 'deep'], description: '分析深度' }
      },
      required: ['datasourceId']
    }
  },
  {
    name: 'report_compare',
    description: '生成多维度对比分析报告',
    inputSchema: {
      type: 'object',
      properties: {
        datasourceId: { type: 'string', description: '数据源ID' },
        dimensions: { type: 'array', items: { type: 'string' }, description: '对比维度' },
        metrics: { type: 'array', items: { type: 'string' }, description: '对比指标' },
        format: { type: 'string', description: '输出格式' }
      },
      required: ['datasourceId', 'dimensions', 'metrics']
    }
  },

  // ========== 通用技能 ==========
  {
    name: 'skill_list',
    description: '列出所有可用的技能',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['data', 'document', 'media', 'report'], description: '技能分类' }
      }
    }
  },
  {
    name: 'skill_execute',
    description: '执行指定的技能',
    inputSchema: {
      type: 'object',
      properties: {
        skill: { type: 'string', description: '技能名称，如 data.query, report.ppt' },
        params: { type: 'object', description: '技能参数' }
      },
      required: ['skill', 'params']
    }
  },
  // ========== 迁移的数据技能 ==========
  {
    name: 'data_statistics',
    description: '对指定表或字段进行统计分析',
    inputSchema: {
      type: 'object',
      properties: {
        datasourceId: { type: 'string', description: '数据源ID' },
        table: { type: 'string', description: '表名' },
        field: { type: 'string', description: '统计字段（单个字段名）' },
        groupBy: { type: 'string', description: '分组字段' }
      },
      required: ['datasourceId', 'table']
    }
  },
  {
    name: 'data_trend',
    description: '分析数据随时间的变化趋势',
    inputSchema: {
      type: 'object',
      properties: {
        datasourceId: { type: 'string', description: '数据源ID' },
        table: { type: 'string', description: '表名' },
        dateField: { type: 'string', description: '日期字段' },
        valueField: { type: 'string', description: '数值字段' },
        aggregation: { type: 'string', description: '聚合方式: sum/count/avg' }
      },
      required: ['datasourceId', 'table', 'dateField', 'valueField']
    }
  },
  {
    name: 'data_ranking',
    description: '获取某个维度的Top N排名',
    inputSchema: {
      type: 'object',
      properties: {
        datasourceId: { type: 'string', description: '数据源ID' },
        table: { type: 'string', description: '表名' },
        rankField: { type: 'string', description: '排名依据字段' },
        labelField: { type: 'string', description: '标签字段' },
        limit: { type: 'number', description: '返回数量' },
        order: { type: 'string', description: '排序: desc/asc' }
      },
      required: ['datasourceId', 'table', 'rankField', 'labelField']
    }
  },
  {
    name: 'data_comparison',
    description: '对比不同维度或时间段的数据',
    inputSchema: {
      type: 'object',
      properties: {
        datasourceId: { type: 'string', description: '数据源ID' },
        table: { type: 'string', description: '表名' },
        compareField: { type: 'string', description: '对比维度字段' },
        valueField: { type: 'string', description: '数值字段' }
      },
      required: ['datasourceId', 'table', 'compareField', 'valueField']
    }
  },
  {
    name: 'data_anomaly',
    description: '检测数据中的异常值',
    inputSchema: {
      type: 'object',
      properties: {
        datasourceId: { type: 'string', description: '数据源ID' },
        table: { type: 'string', description: '表名' },
        field: { type: 'string', description: '检测字段' },
        threshold: { type: 'number', description: '标准差倍数阈值' }
      },
      required: ['datasourceId', 'table', 'field']
    }
  },
  {
    name: 'data_export',
    description: '导出查询结果为指定格式',
    inputSchema: {
      type: 'object',
      properties: {
        datasourceId: { type: 'string', description: '数据源ID' },
        sql: { type: 'string', description: 'SQL查询语句' },
        format: { type: 'string', description: '导出格式: json/csv' }
      },
      required: ['datasourceId', 'sql']
    }
  },
  {
    name: 'data_comprehensive_analysis',
    description: '综合分析问题，基于多个指标',
    inputSchema: {
      type: 'object',
      properties: {
        datasourceId: { type: 'string', description: '数据源ID' },
        table: { type: 'string', description: '主表名' },
        topic: { type: 'string', description: '分析主题' },
        metrics: { type: 'array', items: { type: 'string' }, description: '分析指标列表' },
        labelField: { type: 'string', description: '标签字段' }
      },
      required: ['datasourceId', 'table', 'topic', 'metrics', 'labelField']
    }
  },
  {
    name: 'data_compare_entities',
    description: '对比特定对象的多个指标',
    inputSchema: {
      type: 'object',
      properties: {
        datasourceId: { type: 'string', description: '数据源ID' },
        table: { type: 'string', description: '表名' },
        labelField: { type: 'string', description: '标签字段' },
        entities: { type: 'array', items: { type: 'string' }, description: '对象列表' },
        metrics: { type: 'array', items: { type: 'string' }, description: '指标列表' }
      },
      required: ['datasourceId', 'table', 'labelField', 'entities', 'metrics']
    }
  }
];

// 调用后端技能 API
// 调用后端技能 API
async function callSkillAPI(skill: string, args: Record<string, any>): Promise<any> {
  try {
    const { datasourceId, ...params } = args;

    // 如果没有 API_TOKEN，可能无法访问受保护的接口
    const token = process.env.MCP_API_KEY;

    if (!token) {
      console.warn('警告: 未配置 MCP_API_KEY，调用可能会失败');
    }

    const response = await fetch(`${BACKEND_URL}/api/agent/skills/${skill}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        datasourceId,
        params
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 调用失败 (${response.status}): ${errorText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('Skill API call failed:', error);
    return { success: false, error: error.message };
  }
}

// 将工具名转换为技能名
function toolNameToSkillName(toolName: string): string {
  // data_query -> data.query
  // document_pdf_to_word -> document.pdf_to_word
  const parts = toolName.split('_');
  if (parts.length >= 2) {
    const category = parts[0];
    const action = parts.slice(1).join('_');
    return `${category}.${action}`;
  }
  return toolName;
}

// 创建服务器
const server = new Server(
  {
    name: 'skills-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 处理工具列表请求
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// 处理工具调用请求
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // 特殊处理：列出技能
    if (name === 'skill_list') {
      const category = (args as any)?.category;
      const skillList = tools
        .filter(t => !['skill_list', 'skill_execute'].includes(t.name))
        .filter(t => !category || t.name.startsWith(category))
        .map(t => ({
          name: t.name,
          description: t.description
        }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ skills: skillList, count: skillList.length }, null, 2)
        }]
      };
    }

    // 特殊处理：执行技能
    if (name === 'skill_execute') {
      const { skill, params } = args as { skill: string; params: Record<string, any> };
      const result = await callSkillAPI(skill, params);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    }

    // 普通技能调用
    const skillName = toolNameToSkillName(name);
    const result = await callSkillAPI(skillName, args as Record<string, any>);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: error.message }, null, 2)
      }],
      isError: true
    };
  }
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Skills MCP Server 已启动');
  console.error(`后端地址: ${BACKEND_URL}`);
  console.error(`可用技能: ${tools.length} 个`);
}

main().catch((error) => {
  console.error('服务器启动失败:', error);
  process.exit(1);
});
