# OCR MCP Server

一个用于图片文字识别的 MCP (Model Context Protocol) 服务器。

## 功能

- 识别图片中的文字（支持中英文混合）
- 支持 base64 编码和文件路径两种输入方式
- 检查 OCR 服务状态

## 安装

```bash
cd mcp-servers/ocr-server
npm install
```

## 配置

在 Kiro 的 MCP 配置文件中添加：

```json
{
  "mcpServers": {
    "ocr": {
      "command": "node",
      "args": ["--loader", "ts-node/esm", "mcp-servers/ocr-server/index.ts"],
      "env": {
        "OCR_SERVICE_URL": "http://localhost:5100"
      }
    }
  }
}
```

或者使用绝对路径：

```json
{
  "mcpServers": {
    "ocr": {
      "command": "node",
      "args": ["--loader", "ts-node/esm", "F:/Project/ai-data-platform/ai-data-platform/mcp-servers/ocr-server/index.ts"],
      "env": {
        "OCR_SERVICE_URL": "http://localhost:5100"
      }
    }
  }
}
```

## 工具列表

### 1. ocr_recognize_image

识别图片中的文字内容。

**参数：**
- `image` (string, 必需): 图片的 base64 编码或文件路径
- `type` (string, 可选): 输入类型，可选值：`base64` 或 `file`，默认 `base64`

**示例：**

使用 base64：
```json
{
  "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA...",
  "type": "base64"
}
```

使用文件路径：
```json
{
  "image": "C:/Users/test/image.png",
  "type": "file"
}
```

**返回：**
```json
{
  "success": true,
  "text": "识别出的完整文本",
  "lines": ["第一行", "第二行", "..."],
  "count": 10,
  "message": "成功识别 10 行文字"
}
```

### 2. ocr_check_status

检查 OCR 服务是否可用。

**参数：** 无

**返回：**
```json
{
  "available": true,
  "message": "OCR服务正常运行 (GPU模式)"
}
```

## 使用示例

在 AI 对话中，你可以这样使用：

```
请帮我识别这张图片中的文字：[图片的base64编码]
```

或者：

```
请识别文件 C:/Users/test/document.png 中的文字
```

## 环境变量

- `OCR_SERVICE_URL`: OCR 服务地址，默认 `http://localhost:5100`

## 依赖

- OCR 服务必须在运行（默认端口 5100）
- Node.js 18+
- TypeScript

## 故障排除

### OCR 服务不可用

确保 OCR 服务已启动：

```bash
cd ocr-service
python app.py
```

或使用 Docker：

```bash
cd ocr-service
docker-compose up -d
```

### 权限错误

确保 MCP 服务器有权限访问指定的文件路径。

## 开发

```bash
# 安装依赖
npm install

# 启动服务器
npm start

# 构建
npm run build
```
