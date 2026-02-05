# OCR 识别服务模块

## 模块概述

光学字符识别（OCR）服务，支持图片和 PDF 文档的文字提取。

## 功能特性

### 1. 识别能力
- 单张图片识别
- 文件识别
- 批量识别（PDF 多页）
- 多语言支持（中文、英文）

### 2. 支持格式
- 图片：JPG、JPEG、PNG、GIF、BMP
- 文档：PDF

## 目录结构

```
ocr-service/
├── module.json           # 模块配置
├── README.md             # 说明文档
├── backend/
│   ├── index.ts          # 模块入口
│   ├── routes.ts         # API 路由
│   ├── types.ts          # 类型定义
│   └── ocrService.ts     # OCR 服务客户端
└── frontend/
    └── views/            # Vue 组件
```

## API 接口

| 方法 | 路径 | 描述 |
|-----|------|------|
| GET | /ocr/health | 健康检查 |
| GET | /ocr/config | 获取 OCR 配置 |
| POST | /ocr/recognize | 识别单张图片 |
| POST | /ocr/recognize/file | 识别文件 |
| POST | /ocr/recognize/batch | 批量识别 |

## 使用示例

```typescript
import { initOCRModule } from './modules/ocr-service/backend';

// 初始化模块
const ocrModule = initOCRModule({
  serviceUrl: 'http://localhost:5100'
});

// 使用路由
app.use('/api/ocr', ocrModule.routes);

// 直接使用服务
const result = await ocrModule.service.recognizeFile('/path/to/image.png');
console.log(result.text);
```

## 请求示例

### 识别 Base64 图片
```json
POST /api/ocr/recognize
{
  "image": "data:image/png;base64,iVBORw0KGgoAAAANS..."
}
```

### 识别文件
```json
POST /api/ocr/recognize/file
{
  "filePath": "/uploads/document.png"
}
```

### 批量识别
```json
POST /api/ocr/recognize/batch
{
  "images": [
    "base64_image_1...",
    "base64_image_2..."
  ]
}
```

## 依赖服务

本模块需要 PaddleOCR 服务运行在后端：

```bash
# 启动 PaddleOCR 服务
python ocr_server.py --port 5100
```

或使用 Docker：
```bash
docker run -p 5100:5100 paddlepaddle/paddle:latest
```
