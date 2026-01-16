# OCR MCP 服务器配置指南

## 概述

OCR MCP 服务器允许 AI 助手通过 MCP (Model Context Protocol) 直接调用 OCR 服务进行图片文字识别。

## 前置条件

1. **OCR 服务已启动**
   - 确保 OCR 服务运行在 `http://localhost:5100`
   - 启动方式：`cd ocr-service && python app.py`
   - 或使用 Docker：`cd ocr-service && docker-compose up -d`

2. **Node.js 环境**
   - Node.js 18+ 已安装
   - npm 已安装

## 安装步骤

### 1. 安装依赖

```bash
cd mcp-servers/ocr-server
npm install
```

### 2. 配置 MCP

在 Kiro 中配置 MCP 服务器。有两种方式：

#### 方式 A：通过 Kiro UI 配置

1. 打开 Kiro
2. 按 `Ctrl+Shift+P` 打开命令面板
3. 搜索 "MCP" 并选择 "Open MCP Settings"
4. 添加以下配置：

```json
{
  "mcpServers": {
    "ocr": {
      "command": "node",
      "args": [
        "--loader",
        "ts-node/esm",
        "F:/Project/ai-data-platform/ai-data-platform/mcp-servers/ocr-server/index.ts"
      ],
      "env": {
        "OCR_SERVICE_URL": "http://localhost:5100"
      },
      "disabled": false,
      "autoApprove": [
        "ocr_check_status",
        "ocr_recognize_image"
      ]
    }
  }
}
```

**注意：** 请将路径 `F:/Project/ai-data-platform/ai-data-platform/` 替换为你的实际项目路径。

#### 方式 B：手动编辑配置文件

编辑 `.kiro/settings/mcp.json` 文件（如果不存在则创建）：

```json
{
  "mcpServers": {
    "ocr": {
      "command": "node",
      "args": [
        "--loader",
        "ts-node/esm",
        "mcp-servers/ocr-server/index.ts"
      ],
      "env": {
        "OCR_SERVICE_URL": "http://localhost:5100"
      },
      "disabled": false,
      "autoApprove": [
        "ocr_check_status",
        "ocr_recognize_image"
      ]
    }
  }
}
```

### 3. 重启 Kiro

配置完成后，重启 Kiro 以加载 MCP 服务器。

## 验证安装

### 1. 检查 MCP 服务器状态

在 Kiro 中，你可以查看 MCP 服务器列表，确认 OCR 服务器已加载。

### 2. 测试 OCR 功能

在 AI 对话中输入：

```
请检查 OCR 服务状态
```

AI 应该会调用 `ocr_check_status` 工具并返回服务状态。

### 3. 测试图片识别

准备一张包含文字的图片，然后：

```
请帮我识别这张图片中的文字：[粘贴图片或提供文件路径]
```

## 使用示例

### 示例 1：检查服务状态

**用户：** 检查 OCR 服务是否可用

**AI 响应：**
```
OCR服务正常运行 (GPU模式)
```

### 示例 2：识别图片文字（base64）

**用户：** 请识别这张图片中的文字：[图片base64]

**AI 响应：**
```
识别成功！共识别出 15 行文字：

1. 公安部门事编的人口数据主要包括以下信息：
2. 姓名：字符型，长度不超过50个汉字
3. 公民身份号码：18位字符，国家法定唯一标识
...
```

### 示例 3：识别图片文字（文件路径）

**用户：** 请识别文件 C:/Users/test/document.png 中的文字

**AI 响应：**
```
识别成功！共识别出 8 行文字：

1. 数据来源主要为公安部门
2. 部分来自卫生部门
...
```

## 可用工具

### 1. ocr_check_status

检查 OCR 服务是否可用。

**使用场景：**
- 在识别图片前检查服务状态
- 排查 OCR 功能问题

### 2. ocr_recognize_image

识别图片中的文字。

**支持的输入格式：**
- Base64 编码的图片
- 本地文件路径

**支持的图片格式：**
- JPG/JPEG
- PNG
- BMP
- GIF
- TIFF

## 配置选项

### 环境变量

- `OCR_SERVICE_URL`: OCR 服务地址
  - 默认值：`http://localhost:5100`
  - 如果 OCR 服务运行在其他端口，请修改此值

### 自动批准

`autoApprove` 列表中的工具会自动执行，无需用户确认：

```json
"autoApprove": [
  "ocr_check_status",
  "ocr_recognize_image"
]
```

如果你希望每次调用都需要确认，可以移除此配置。

## 故障排除

### 问题 1：MCP 服务器无法启动

**症状：** Kiro 提示 OCR MCP 服务器启动失败

**解决方案：**
1. 检查 Node.js 版本：`node --version`（需要 18+）
2. 检查路径是否正确
3. 确保已安装依赖：`cd mcp-servers/ocr-server && npm install`
4. 查看 Kiro 日志获取详细错误信息

### 问题 2：OCR 服务不可用

**症状：** 调用 `ocr_check_status` 返回服务不可用

**解决方案：**
1. 启动 OCR 服务：`cd ocr-service && python app.py`
2. 检查端口是否正确（默认 5100）
3. 访问 `http://localhost:5100/health` 确认服务运行

### 问题 3：识别失败

**症状：** 调用 `ocr_recognize_image` 返回错误

**可能原因：**
1. 图片格式不支持
2. 图片文件不存在（文件路径模式）
3. Base64 编码格式错误
4. 图片文件过大（超过 10MB）

**解决方案：**
1. 确认图片格式为常见格式（JPG、PNG等）
2. 检查文件路径是否正确
3. 确保 Base64 编码完整
4. 压缩大图片后再识别

### 问题 4：权限错误

**症状：** 无法读取文件

**解决方案：**
1. 确保 Kiro 有权限访问指定路径
2. 使用绝对路径而非相对路径
3. 检查文件是否被其他程序占用

## 性能优化

### 1. 使用 GPU 加速

如果有 NVIDIA GPU，OCR 服务会自动使用 GPU 加速，识别速度提升 3-5 倍。

### 2. 批量识别

如果需要识别多张图片，建议逐张调用而非一次性传入多张，以获得更好的错误处理。

### 3. 图片预处理

- 确保图片清晰
- 文字不要太小（建议至少 12px）
- 避免图片倾斜或变形

## 安全注意事项

1. **文件路径访问**
   - MCP 服务器可以访问本地文件系统
   - 建议只在可信环境中使用
   - 不要将敏感文件路径暴露给不可信的 AI 模型

2. **Base64 数据**
   - Base64 编码的图片会占用较多内存
   - 建议单张图片不超过 10MB

3. **OCR 服务安全**
   - OCR 服务默认只监听本地（localhost）
   - 如需远程访问，请配置防火墙和认证

## 更新日志

### v1.0.0 (2026-01-16)
- 初始版本发布
- 支持 base64 和文件路径两种输入方式
- 支持中英文混合识别
- 提供服务状态检查功能

## 相关文档

- [OCR 服务文档](ocr-service/README.md)
- [OCR 功能使用指南](OCR_SETUP_GUIDE.md)
- [MCP 协议文档](https://modelcontextprotocol.io/)

## 技术支持

如有问题，请查看：
1. Kiro 日志
2. OCR 服务日志
3. MCP 服务器日志（stderr 输出）
