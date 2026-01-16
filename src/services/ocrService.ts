/**
 * OCR 服务客户端
 * 调用 PaddleOCR 服务进行图片文字识别
 */

import fetch from 'node-fetch';
import * as fs from 'fs';

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:5100';

export interface OCRResult {
  success: boolean;
  text: string;
  lines?: string[];
  error?: string;
}

export interface OCRBatchResult {
  success: boolean;
  text: string;
  pages?: { page: number; text: string; lines?: string[] }[];
  error?: string;
}

class OCRService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = OCR_SERVICE_URL;
  }

  /**
   * 检查 OCR 服务是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { timeout: 3000 } as any);
      const data = await res.json() as any;
      return data.status === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * 识别单张图片
   */
  async recognize(imageBase64: string): Promise<OCRResult> {
    try {
      const res = await fetch(`${this.baseUrl}/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 }),
      });

      const data = await res.json() as any;
      return {
        success: data.success,
        text: data.text || '',
        lines: data.lines,
        error: data.error,
      };
    } catch (error: any) {
      return {
        success: false,
        text: '',
        error: `OCR 服务调用失败: ${error.message}`,
      };
    }
  }

  /**
   * 识别图片文件
   */
  async recognizeFile(filePath: string): Promise<OCRResult> {
    try {
      const imageBuffer = fs.readFileSync(filePath);
      const imageBase64 = imageBuffer.toString('base64');
      return this.recognize(imageBase64);
    } catch (error: any) {
      return {
        success: false,
        text: '',
        error: `读取文件失败: ${error.message}`,
      };
    }
  }

  /**
   * 批量识别（用于 PDF 多页）
   */
  async recognizeBatch(imagesBase64: string[]): Promise<OCRBatchResult> {
    try {
      const res = await fetch(`${this.baseUrl}/ocr/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: imagesBase64 }),
      });

      const data = await res.json() as any;
      return {
        success: data.success,
        text: data.text || '',
        pages: data.pages,
        error: data.error,
      };
    } catch (error: any) {
      return {
        success: false,
        text: '',
        error: `OCR 批量识别失败: ${error.message}`,
      };
    }
  }
}

export const ocrService = new OCRService();
