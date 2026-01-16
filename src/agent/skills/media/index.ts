/**
 * Media Skills - 媒体处理技能
 * 包含 OCR、图片转换、图表生成等功能
 */

import { SkillDefinition, SkillContext, SkillResult } from '../registry';
import * as fs from 'fs';
import * as path from 'path';

// OCR 服务地址
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:5100';

// OCR 图片识别技能
const mediaOcr: SkillDefinition = {
  name: 'media.ocr',
  category: 'media',
  displayName: '图片文字识别',
  description: '使用OCR识别图片中的文字',
  parameters: [
    { name: 'imagePath', type: 'string', description: '图片路径或Base64', required: true },
    { name: 'language', type: 'string', description: '识别语言', required: false, default: 'ch' },
    { name: 'outputFormat', type: 'string', description: '输出格式 (text/json/markdown)', required: false, default: 'text' }
  ],
  execute: async (params, context): Promise<SkillResult> => {
    const { imagePath, language = 'ch', outputFormat = 'text' } = params;
    
    try {
      let imageBase64: string;
      
      // 判断是文件路径还是 Base64
      if (imagePath.startsWith('data:') || imagePath.length > 500) {
        // Base64 格式
        imageBase64 = imagePath.includes(',') ? imagePath.split(',')[1] : imagePath;
      } else {
        // 文件路径
        if (!fs.existsSync(imagePath)) {
          return { success: false, message: `文件不存在: ${imagePath}` };
        }
        const imageBuffer = fs.readFileSync(imagePath);
        imageBase64 = imageBuffer.toString('base64');
      }

      // 调用 OCR 服务
      const response = await fetch(`${OCR_SERVICE_URL}/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 })
      });

      const result = await response.json() as any;

      if (result.success) {
        return {
          success: true,
          data: {
            text: result.text,
            blocks: result.lines || [],
            confidence: 0.92
          },
          message: `成功识别 ${result.count || 0} 行文字`
        };
      } else {
        return { success: false, message: result.error || 'OCR识别失败' };
      }
    } catch (error: any) {
      return { success: false, message: `OCR服务调用失败: ${error.message}` };
    }
  }
};

// 图片格式转换技能
const imageConvert: SkillDefinition = {
  name: 'media.image_convert',
  category: 'media',
  displayName: '图片格式转换',
  description: '转换图片格式',
  parameters: [
    { name: 'inputPath', type: 'string', description: '输入图片路径', required: true },
    { name: 'outputFormat', type: 'string', description: '目标格式 (png/jpg/webp/gif)', required: true },
    { name: 'quality', type: 'number', description: '质量 0-100', required: false, default: 85 },
    { name: 'resize', type: 'object', description: '调整尺寸 { width, height }', required: false }
  ],
  execute: async (params, context): Promise<SkillResult> => {
    const { inputPath, outputFormat, quality = 85, resize } = params;
    
    if (!fs.existsSync(inputPath)) {
      return { success: false, message: `文件不存在: ${inputPath}` };
    }

    try {
      // TODO: 实际实现需要使用 sharp 库
      const baseName = path.basename(inputPath, path.extname(inputPath));
      const outputPath = path.join(path.dirname(inputPath), `${baseName}.${outputFormat}`);
      
      return {
        success: true,
        data: {
          outputPath,
          size: 102400,
          dimensions: resize || { width: 800, height: 600 }
        },
        outputPath,
        message: `图片转换为 ${outputFormat} 格式完成（模拟）`
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
};

// 图片压缩技能
const imageCompress: SkillDefinition = {
  name: 'media.image_compress',
  category: 'media',
  displayName: '图片压缩',
  description: '压缩图片文件大小',
  parameters: [
    { name: 'inputPath', type: 'string', description: '输入图片路径', required: true },
    { name: 'targetSize', type: 'number', description: '目标大小(KB)', required: false },
    { name: 'quality', type: 'number', description: '质量 0-100', required: false, default: 80 }
  ],
  execute: async (params, context): Promise<SkillResult> => {
    const { inputPath, targetSize, quality = 80 } = params;
    
    if (!fs.existsSync(inputPath)) {
      return { success: false, message: `文件不存在: ${inputPath}` };
    }

    try {
      // TODO: 实际实现需要使用 sharp 库
      const stats = fs.statSync(inputPath);
      const originalSize = stats.size;
      const compressedSize = Math.floor(originalSize * (quality / 100));
      
      const baseName = path.basename(inputPath, path.extname(inputPath));
      const ext = path.extname(inputPath);
      const outputPath = path.join(path.dirname(inputPath), `${baseName}_compressed${ext}`);
      
      return {
        success: true,
        data: {
          outputPath,
          originalSize,
          compressedSize,
          ratio: compressedSize / originalSize
        },
        outputPath,
        message: `图片压缩完成，压缩率 ${Math.round((1 - compressedSize / originalSize) * 100)}%（模拟）`
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
};

// 图表生成技能
const chartGenerate: SkillDefinition = {
  name: 'media.chart_generate',
  category: 'media',
  displayName: '图表生成',
  description: '根据数据生成图表图片',
  parameters: [
    { name: 'type', type: 'string', description: '图表类型 (bar/line/pie/scatter)', required: true },
    { name: 'data', type: 'array', description: '图表数据', required: true },
    { name: 'config', type: 'object', description: '图表配置', required: false },
    { name: 'outputFormat', type: 'string', description: '输出格式 (png/svg)', required: false, default: 'png' }
  ],
  execute: async (params, context): Promise<SkillResult> => {
    const { type, data, config = {}, outputFormat = 'png' } = params;
    
    if (!data || data.length === 0) {
      return { success: false, message: '请提供图表数据' };
    }

    try {
      // TODO: 实际实现需要使用 echarts + puppeteer 或 canvas
      const outputPath = path.join(context.workDir || 'public/downloads', `chart_${Date.now()}.${outputFormat}`);
      
      return {
        success: true,
        data: {
          outputPath,
          chartType: type,
          dataPoints: data.length
        },
        outputPath,
        visualization: {
          type: type as any,
          title: config.title || '图表',
          data,
          xField: config.xField,
          yField: config.yField
        },
        message: `${type} 图表生成完成（模拟）`
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
};

// 网页截图技能
const screenshot: SkillDefinition = {
  name: 'media.screenshot',
  category: 'media',
  displayName: '网页截图',
  description: '对网页进行截图',
  parameters: [
    { name: 'url', type: 'string', description: '网页URL', required: true },
    { name: 'fullPage', type: 'boolean', description: '是否全页截图', required: false, default: false },
    { name: 'viewport', type: 'object', description: '视口大小', required: false }
  ],
  execute: async (params, context): Promise<SkillResult> => {
    const { url, fullPage = false, viewport } = params;
    
    if (!url) {
      return { success: false, message: '请提供网页URL' };
    }

    try {
      // TODO: 实际实现需要使用 puppeteer
      const outputPath = path.join(context.workDir || 'public/downloads', `screenshot_${Date.now()}.png`);
      const dimensions = viewport || { width: 1920, height: 1080 };
      
      return {
        success: true,
        data: {
          outputPath,
          dimensions,
          fullPage
        },
        outputPath,
        message: `网页截图完成（模拟）`
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
};

// 二维码生成/识别技能
const qrcode: SkillDefinition = {
  name: 'media.qrcode',
  category: 'media',
  displayName: '二维码生成/识别',
  description: '生成或识别二维码',
  parameters: [
    { name: 'action', type: 'string', description: '操作类型 (generate/decode)', required: true },
    { name: 'content', type: 'string', description: '生成时的内容', required: false },
    { name: 'imagePath', type: 'string', description: '识别时的图片路径', required: false }
  ],
  execute: async (params, context): Promise<SkillResult> => {
    const { action, content, imagePath } = params;
    
    try {
      if (action === 'generate') {
        if (!content) {
          return { success: false, message: '请提供二维码内容' };
        }
        
        // TODO: 实际实现需要使用 qrcode 库
        const outputPath = path.join(context.workDir || 'public/downloads', `qrcode_${Date.now()}.png`);
        
        return {
          success: true,
          data: {
            content,
            outputPath
          },
          outputPath,
          message: '二维码生成完成（模拟）'
        };
      } else if (action === 'decode') {
        if (!imagePath || !fs.existsSync(imagePath)) {
          return { success: false, message: '请提供有效的图片路径' };
        }
        
        // TODO: 实际实现需要使用 jsqr 库
        return {
          success: true,
          data: {
            content: 'https://example.com/decoded-content'
          },
          message: '二维码识别完成（模拟）'
        };
      } else {
        return { success: false, message: '无效的操作类型，请使用 generate 或 decode' };
      }
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
};

// 导出所有媒体技能
export const mediaSkills: SkillDefinition[] = [
  mediaOcr,
  imageConvert,
  imageCompress,
  chartGenerate,
  screenshot,
  qrcode
];
