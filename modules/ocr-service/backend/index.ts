/**
 * OCR 服务模块入口
 */

import { createOCRRoutes } from './routes';
import { ocrService } from './ocrService';

export interface OCRModuleOptions {
    serviceUrl?: string;
}

export function initOCRModule(options: OCRModuleOptions = {}) {
    // 设置服务 URL
    if (options.serviceUrl) {
        process.env.OCR_SERVICE_URL = options.serviceUrl;
    }

    return {
        routes: createOCRRoutes(),
        name: 'ocr-service',
        version: '1.0.0',

        // 提供服务实例
        service: ocrService
    };
}

// 导出所有类型和服务
export * from './types';
export { ocrService } from './ocrService';
