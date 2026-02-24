---
name: imageOcr
description: 图片文字识别（OCR）
version: 1.0.0
adapter: auto_legacy
actions:
  - name: ocrImage
    description: 识别图片中的文字内容
---

优先使用 OpenAI Vision API，后备 tesseract.js。支持 png/jpg/bmp/webp。
