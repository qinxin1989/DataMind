# 媒体处理技能 (Media Skills)

## 概述
媒体处理技能用于图片识别、格式转换、图表生成等操作。

## 技能列表

### 1. media.ocr - 图片文字识别
**描述**: 使用OCR识别图片中的文字
**参数**:
- `imagePath` (string, required): 图片路径或Base64
- `language` (string, optional): 识别语言，默认 'ch' (中文)
- `outputFormat` (string, optional): 输出格式 (text/json/markdown)

**返回**:
```json
{
  "success": true,
  "text": "识别的文字内容",
  "blocks": [
    { "text": "文字块", "confidence": 0.95, "position": {...} }
  ],
  "confidence": 0.92
}
```

### 2. media.image_convert - 图片格式转换
**描述**: 转换图片格式
**参数**:
- `inputPath` (string, required): 输入图片路径
- `outputFormat` (string, required): 目标格式 (png/jpg/webp/gif)
- `quality` (number, optional): 质量 0-100，默认85
- `resize` (object, optional): 调整尺寸 { width, height }

**返回**:
```json
{
  "success": true,
  "outputPath": "/path/to/output.png",
  "size": 102400,
  "dimensions": { "width": 800, "height": 600 }
}
```

### 3. media.image_compress - 图片压缩
**描述**: 压缩图片文件大小
**参数**:
- `inputPath` (string, required): 输入图片路径
- `targetSize` (number, optional): 目标大小(KB)
- `quality` (number, optional): 质量 0-100

**返回**:
```json
{
  "success": true,
  "outputPath": "/path/to/compressed.jpg",
  "originalSize": 500000,
  "compressedSize": 100000,
  "ratio": 0.2
}
```

### 4. media.chart_generate - 图表生成
**描述**: 根据数据生成图表图片
**参数**:
- `type` (string, required): 图表类型 (bar/line/pie/scatter)
- `data` (array, required): 图表数据
- `config` (object, optional): 图表配置
- `outputFormat` (string, optional): 输出格式 (png/svg)

**返回**:
```json
{
  "success": true,
  "outputPath": "/path/to/chart.png",
  "base64": "data:image/png;base64,..."
}
```

### 5. media.screenshot - 网页截图
**描述**: 对网页进行截图
**参数**:
- `url` (string, required): 网页URL
- `fullPage` (boolean, optional): 是否全页截图
- `viewport` (object, optional): 视口大小

**返回**:
```json
{
  "success": true,
  "outputPath": "/path/to/screenshot.png",
  "dimensions": { "width": 1920, "height": 1080 }
}
```

### 6. media.qrcode - 二维码生成/识别
**描述**: 生成或识别二维码
**参数**:
- `action` (string, required): 操作类型 (generate/decode)
- `content` (string): 生成时的内容
- `imagePath` (string): 识别时的图片路径

**返回**:
```json
{
  "success": true,
  "content": "二维码内容",
  "outputPath": "/path/to/qrcode.png"
}
```

## MCP 调用示例

```json
{
  "tool": "media_process",
  "arguments": {
    "skill": "media.ocr",
    "imagePath": "/uploads/document.png",
    "language": "ch"
  }
}
```

## 依赖服务
- PaddleOCR (OCR识别)
- Sharp (图片处理)
- ECharts (图表生成)
- Puppeteer (网页截图)
