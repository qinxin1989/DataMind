/**
 * OCR 服务路由
 * 直接导出 router，与模块加载器兼容
 */

import { Router, Request, Response } from 'express';
import { ocrService } from './ocrService';
import type { OCRConfig } from './types';

const router = Router();

/**
 * GET /health - 健康检查
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const available = await ocrService.isAvailable();
    res.json({
      success: true,
      data: {
        status: available ? 'ok' : 'unavailable',
        available
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /config - 获取 OCR 配置
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    const config: OCRConfig = {
      enabled: true,
      serviceUrl: process.env.OCR_SERVICE_URL || 'http://localhost:5100',
      supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'pdf'],
      maxFileSize: '10MB',
      languages: ['zh-CN', 'en'],
      provider: 'paddleocr'
    };
    res.json({ success: true, data: config });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /recognize - 识别单张图片
 */
router.post('/recognize', async (req: Request, res: Response) => {
  try {
    const { image, imageUrl } = req.body;

    if (!image && !imageUrl) {
      return res.status(400).json({ error: '请提供图片数据或URL' });
    }

    let imageBase64 = image;

    if (imageUrl && !image) {
      return res.status(400).json({ error: '暂不支持 URL 识别' });
    }

    const startTime = Date.now();
    const result = await ocrService.recognize(imageBase64);
    const processingTime = Date.now() - startTime;

    res.json({
      success: result.success,
      data: {
        ...result,
        processingTime
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /recognize/file - 识别文件
 */
router.post('/recognize/file', async (req: Request, res: Response) => {
  try {
    const { filePath } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: '请提供文件路径' });
    }

    const startTime = Date.now();
    const result = await ocrService.recognizeFile(filePath);
    const processingTime = Date.now() - startTime;

    res.json({
      success: result.success,
      data: {
        ...result,
        processingTime
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /recognize/batch - 批量识别
 */
router.post('/recognize/batch', async (req: Request, res: Response) => {
  try {
    const { images } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: '请提供图片数组' });
    }

    const startTime = Date.now();
    const result = await ocrService.recognizeBatch(images);
    const processingTime = Date.now() - startTime;

    res.json({
      success: result.success,
      data: {
        ...result,
        processingTime
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 默认导出 router
export default router;

// 命名导出
export { router };

// 工厂函数（向后兼容）
export function createOCRRoutes() {
  return router;
}