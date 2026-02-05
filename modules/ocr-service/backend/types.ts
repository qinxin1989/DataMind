/**
 * OCR 服务类型定义
 */

// OCR 识别结果
export interface OCRResult {
    success: boolean;
    text: string;
    lines?: string[];
    error?: string;
    confidence?: number;
    language?: string;
    processingTime?: number;
}

// OCR 批量识别结果
export interface OCRBatchResult {
    success: boolean;
    text: string;
    pages?: Array<{
        page: number;
        text: string;
        lines?: string[];
    }>;
    error?: string;
}

// OCR 配置
export interface OCRConfig {
    enabled: boolean;
    serviceUrl: string;
    supportedFormats: string[];
    maxFileSize: string;
    languages: string[];
    provider: 'paddleocr' | 'tesseract' | 'baidu' | 'aliyun';
}

// OCR 识别请求
export interface OCRRecognizeRequest {
    image?: string;      // Base64 编码的图片
    imageUrl?: string;   // 图片 URL
    language?: string;   // 识别语言
}

// OCR 文件识别请求
export interface OCRFileRecognizeRequest {
    filePath: string;
    language?: string;
}

// OCR 批量识别请求
export interface OCRBatchRecognizeRequest {
    images: string[];    // Base64 编码的图片数组
    language?: string;
}
