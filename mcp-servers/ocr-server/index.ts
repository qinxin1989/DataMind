#!/usr/bin/env node

/**
 * OCR MCP Server
 * 提供图片文字识别功能的 MCP 服务器
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:5100';

// 定义工具
const tools: Tool[] = [
  {
    name: 'ocr_recognize_image',
    description: '识别图片中的文字内容，支持中英文混合识别。可以传入图片的base64编码或文件路径。',
    inputSchema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          description: '图片的base64编码（可以包含data:image前缀）或本地文件路径',
        },
        type: {
          type: 'string',
          enum: ['base64', 'file'],
          description: '输入类型：base64编码或文件路径',
          default: 'base64',
        },
      },
      required: ['image'],
    },
  },
  {
    name: 'ocr_check_status',
    description: '检查OCR服务是否可用',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// 检查OCR服务状态
async function checkOCRStatus(): Promise<{ available: boolean; message: string }> {
  try {
    const response = await fetch(`${OCR_SERVICE_URL}/health`, {
      method: 'GET',
      timeout: 3000,
    } as any);
    
    const data = await response.json() as any;
    
    if (data.status === 'ok') {
      return {
        available: true,
        message: `OCR服务正常运行 (${data.gpu ? 'GPU模式' : 'CPU模式'})`,
      };
    } else {
      return {
        available: false,
        message: 'OCR服务状态异常',
      };
    }
  } catch (error: any) {
    return {
      available: false,
      message: `OCR服务不可用: ${error.message}`,
    };
  }
}

// 识别图片
async function recognizeImage(imageInput: string, type: string = 'base64'): Promise<any> {
  try {
    let imageBase64: string;

    // 处理输入
    if (type === 'file') {
      // 读取文件
      if (!fs.existsSync(imageInput)) {
        throw new Error(`文件不存在: ${imageInput}`);
      }
      const imageBuffer = fs.readFileSync(imageInput);
      imageBase64 = imageBuffer.toString('base64');
    } else {
      // 使用base64
      imageBase64 = imageInput;
      // 去除data:image前缀
      if (imageBase64.includes(',')) {
        imageBase64 = imageBase64.split(',')[1];
      }
    }

    // 调用OCR服务
    const response = await fetch(`${OCR_SERVICE_URL}/ocr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageBase64 }),
    });

    const result = await response.json() as any;

    if (result.success) {
      return {
        success: true,
        text: result.text,
        lines: result.lines || [],
        count: result.count || 0,
        message: `成功识别 ${result.count || 0} 行文字`,
      };
    } else {
      return {
        success: false,
        error: result.error || '识别失败',
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: `OCR识别失败: ${error.message}`,
    };
  }
}

// 创建服务器
const server = new Server(
  {
    name: 'ocr-server',
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
    if (name === 'ocr_check_status') {
      const status = await checkOCRStatus();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    }

    if (name === 'ocr_recognize_image') {
      const { image, type = 'base64' } = args as { image: string; type?: string };

      if (!image) {
        throw new Error('缺少必需参数: image');
      }

      const result = await recognizeImage(image, type);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    throw new Error(`未知工具: ${name}`);
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: error.message }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('OCR MCP Server 已启动');
}

main().catch((error) => {
  console.error('服务器启动失败:', error);
  process.exit(1);
});
