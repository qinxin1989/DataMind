# OCR 图片识别功能指南

## 功能概述

OCR（光学字符识别）功能可以将图片中的文字提取出来，支持中英文混合识别。

## 功能特点

- ✅ 支持多种图片格式（JPG、PNG、BMP、GIF、TIFF）
- ✅ 中英文混合识别
- ✅ 拖拽上传支持
- ✅ 实时预览
- ✅ 一键复制/下载结果
- ✅ 识别历史记录

## 使用方式

### 方式一：管理后台

1. 登录管理后台
2. 进入 **AI服务 > OCR识别**
3. 上传图片（拖拽或点击）
4. 点击"开始识别"
5. 查看/复制/下载结果

### 方式二：MCP 工具（Kiro）

在 Kiro 中直接使用：

```
请帮我识别这张图片中的文字：[粘贴图片]
```

或识别文件：

```
请识别文件 C:/images/document.png 中的文字
```

## OCR 服务配置

### 启动服务

**Docker 方式（推荐）：**
```bash
cd ocr-service
docker-compose up -d
```

**本地 Python 方式：**
```bash
cd ocr-service
pip install -r requirements.txt
python app.py
```

### 验证服务

访问 http://localhost:5100/health，返回 `{"status": "ok"}` 表示正常。

### 环境变量

```env
OCR_SERVICE_URL=http://localhost:5100
```

## MCP 服务器配置

在 `.kiro/settings/mcp.json` 中添加：

```json
{
  "mcpServers": {
    "ocr": {
      "command": "node",
      "args": ["--loader", "ts-node/esm", "mcp-servers/ocr-server/index.ts"],
      "env": {
        "OCR_SERVICE_URL": "http://localhost:5100"
      },
      "disabled": false,
      "autoApprove": ["ocr_check_status", "ocr_recognize_image"]
    }
  }
}
```

## 可用工具

| 工具 | 功能 | 参数 |
|------|------|------|
| `ocr_check_status` | 检查服务状态 | 无 |
| `ocr_recognize_image` | 识别图片文字 | `image`: base64或路径, `type`: base64/file |

## 性能指标

- **识别速度**: 1-3秒/张（CPU），0.5-1秒/张（GPU）
- **准确率**: 95%+（清晰图片）
- **文件限制**: 最大 10MB
- **引擎**: PaddleOCR (PP-OCRv4)

## 常见问题

### Q: 识别失败，提示"OCR 服务不可用"
A: 确保 OCR 服务已启动，检查 http://localhost:5100/health

### Q: 识别速度慢
A: CPU 模式较慢，建议使用 GPU 加速或 Docker 方式

### Q: 识别准确率不高
A: 确保图片清晰，文字不要太小，避免倾斜变形
