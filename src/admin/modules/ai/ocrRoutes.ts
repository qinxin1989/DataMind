import { Router } from 'express';
import { ocrService } from '../../../services/ocrService';

const router = Router();

/**
 * 检查 OCR 服务状态
 */
router.get('/status', async (req, res) => {
  try {
    const available = await ocrService.isAvailable();
    res.json({
      success: true,
      available,
      message: available ? 'OCR 服务正常' : 'OCR 服务不可用',
    });
  } catch (error: any) {
    res.json({
      success: false,
      available: false,
      message: error.message,
    });
  }
});

/**
 * 识别图片
 */
router.post('/recognize', async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({
        success: false,
        error: '请提供图片数据',
      });
    }

    // 检查服务是否可用
    const available = await ocrService.isAvailable();
    if (!available) {
      return res.status(503).json({
        success: false,
        error: 'OCR 服务不可用，请确保 OCR 服务已启动',
      });
    }

    // 识别图片
    const result = await ocrService.recognize(image);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 批量识别图片
 */
router.post('/recognize-batch', async (req, res) => {
  try {
    const { images } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请提供图片列表',
      });
    }

    // 检查服务是否可用
    const available = await ocrService.isAvailable();
    if (!available) {
      return res.status(503).json({
        success: false,
        error: 'OCR 服务不可用，请确保 OCR 服务已启动',
      });
    }

    // 批量识别
    const result = await ocrService.recognizeBatch(images);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
