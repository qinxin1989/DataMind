# MCP Servers

Model Context Protocol (MCP) 服务器集合，提供各种工具能力。

## 目录结构

```
mcp-servers/
├── README.md              # 本文件
├── ocr-server/            # OCR 图片识别服务
│   ├── index.ts           # 服务入口
│   ├── package.json
│   ├── tsconfig.json
│   ├── README.md
│   └── mcp-config-example.json
│
└── skills-server/         # Skills 技能服务
    ├── index.ts           # 服务入口
    ├── package.json
    ├── tsconfig.json
    ├── README.md
    └── mcp-config-example.json
```

## OCR Server

提供图片文字识别功能，依赖 `ocr-service` Python 服务。

### 工具列表
- `ocr_recognize_image` - 识别图片中的文字
- `ocr_check_status` - 检查 OCR 服务状态

### 配置
```json
{
  "mcpServers": {
    "ocr": {
      "command": "node",
      "args": ["path/to/mcp-servers/ocr-server/dist/index.js"],
      "env": {
        "OCR_SERVICE_URL": "http://localhost:5100"
      }
    }
  }
}
```

## Skills Server

暴露所有 Agent Skills 为 MCP 工具，支持数据处理、文档转换、媒体处理、报告生成等。

### 工具分类

**数据处理 (data_*)**
- `data_query` - 数据查询
- `data_analyze` - 数据分析
- `data_summarize` - 数据摘要
- `data_join` - 关联查询
- `data_clean` - 数据清洗

**文档处理 (document_*)**
- `document_pdf_to_word` - PDF 转 Word
- `document_word_to_pdf` - Word 转 PDF
- `document_merge` - 文档合并
- `document_extract_text` - 文本提取
- `document_extract_tables` - 表格提取
- `document_split` - 文档拆分

**媒体处理 (media_*)**
- `media_ocr` - OCR 识别
- `media_image_convert` - 图片格式转换
- `media_image_compress` - 图片压缩
- `media_chart_generate` - 图表生成
- `media_screenshot` - 网页截图
- `media_qrcode` - 二维码生成/识别

**报告生成 (report_*)**
- `report_ppt` - PPT 生成
- `report_dashboard` - 数据大屏
- `report_summary` - 数据摘要报告
- `report_excel` - Excel 报表
- `report_insight` - 智能洞察
- `report_compare` - 对比分析报告

### 配置
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

## 安装和构建

```bash
# OCR Server
cd mcp-servers/ocr-server
npm install
npm run build

# Skills Server
cd mcp-servers/skills-server
npm install
npm run build
```

## 依赖服务

- **OCR Server**: 需要 `ocr-service` Python 服务运行在 localhost:5100
- **Skills Server**: 需要主后端服务运行在 localhost:3000
