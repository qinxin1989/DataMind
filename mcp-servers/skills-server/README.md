# Skills MCP Server

Agent Skills 的 MCP 服务器，提供数据处理、文档转换、媒体处理、报告生成等技能。

## 功能

### 数据处理技能 (data)
- `data_query` - 根据自然语言问题查询数据源
- `data_analyze` - 对数据源进行综合分析
- `data_summarize` - 生成数据源概要
- `data_join` - 跨表关联查询
- `data_clean` - 数据质量检测和清洗

### 文档处理技能 (document)
- `document_pdf_to_word` - PDF 转 Word
- `document_word_to_pdf` - Word 转 PDF
- `document_merge` - 文档合并
- `document_extract_text` - 文本提取
- `document_extract_tables` - 表格提取
- `document_split` - 文档拆分

### 媒体处理技能 (media)
- `media_ocr` - 图片文字识别
- `media_image_convert` - 图片格式转换
- `media_image_compress` - 图片压缩
- `media_chart_generate` - 图表生成
- `media_screenshot` - 网页截图
- `media_qrcode` - 二维码生成/识别

### 报告生成技能 (report)
- `report_ppt` - PPT 生成
- `report_dashboard` - 数据大屏
- `report_summary` - 数据摘要报告
- `report_excel` - Excel 报表
- `report_insight` - 智能洞察
- `report_compare` - 对比分析报告

## 安装

```bash
cd mcp-servers/skills-server
npm install
npm run build
```

## 配置

在 Kiro 或其他 MCP 客户端中添加配置：

```json
{
  "mcpServers": {
    "skills": {
      "command": "node",
      "args": ["path/to/mcp-servers/skills-server/dist/index.js"],
      "env": {
        "BACKEND_URL": "http://localhost:3000"
      }
    }
  }
}
```

## 环境变量

- `BACKEND_URL` - 后端服务地址，默认 `http://localhost:3000`

## 使用示例

### 生成 PPT
```json
{
  "tool": "report_ppt",
  "arguments": {
    "datasourceId": "ds-001",
    "topic": "2024年度销售分析",
    "style": "business",
    "slides": 10
  }
}
```

### OCR 识别
```json
{
  "tool": "media_ocr",
  "arguments": {
    "imagePath": "/path/to/image.png",
    "language": "ch"
  }
}
```

### 数据分析
```json
{
  "tool": "data_analyze",
  "arguments": {
    "datasourceId": "ds-001",
    "topic": "销售趋势分析",
    "depth": "deep"
  }
}
```

## 开发

```bash
# 开发模式运行
npm run dev

# 构建
npm run build

# 运行
npm start
```
