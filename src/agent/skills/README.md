# Agent Skills 系统

本目录包含 AI Agent 的各种技能定义和实现。

## 目录结构

```
skills/
├── README.md           # 本文件
├── index.ts            # 技能系统入口
├── registry.ts         # 技能注册中心
├── data/              # 数据处理技能
│   ├── skill.md       # 技能定义文档
│   └── index.ts       # 实现
├── document/          # 文档处理技能
│   ├── skill.md
│   └── index.ts
├── media/             # 媒体处理技能
│   ├── skill.md
│   └── index.ts
└── report/            # 报告生成技能
    ├── skill.md
    └── index.ts
```

## 技能类型

### 1. 数据处理 (data)
- `data.query` - 数据查询与分析
- `data.analyze` - 综合数据分析
- `data.summarize` - 数据摘要
- `data.join` - 跨表关联查询
- `data.clean` - 数据清洗与转换

### 2. 文档处理 (document)
- `document.pdf_to_word` - PDF 转 Word
- `document.word_to_pdf` - Word 转 PDF
- `document.merge` - 文档合并
- `document.extract_text` - 文本提取
- `document.extract_tables` - 表格提取
- `document.split` - 文档拆分

### 3. 媒体处理 (media)
- `media.ocr` - OCR 图片识别
- `media.image_convert` - 图片格式转换
- `media.image_compress` - 图片压缩
- `media.chart_generate` - 图表生成
- `media.screenshot` - 网页截图
- `media.qrcode` - 二维码生成/识别

### 4. 报告生成 (report)
- `report.ppt` - PPT 生成
- `report.dashboard` - 数据大屏
- `report.summary` - 数据摘要报告
- `report.excel` - Excel 报表
- `report.insight` - 智能洞察
- `report.compare` - 对比分析报告

## 使用方式

### 1. 通过 Agent 调用
```typescript
import { skillsRegistry } from './agent/skills';

const result = await skillsRegistry.execute('data.query', {
  datasourceId: 'xxx',
  question: '查询销售数据'
}, context);
```

### 2. 通过 REST API 调用
```bash
# 列出所有技能
GET /api/skills

# 执行技能
POST /api/skills/execute
{
  "skill": "report.ppt",
  "params": {
    "datasourceId": "xxx",
    "topic": "销售分析"
  }
}
```

### 3. 通过 MCP 服务器调用
```json
{
  "tool": "report_ppt",
  "arguments": {
    "datasourceId": "xxx",
    "topic": "销售分析",
    "style": "business"
  }
}
```

## MCP 服务器配置

Skills MCP Server 位于 `mcp-servers/skills-server/`，配置方式：

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

## 添加新技能

1. 在对应类型目录下的 `skill.md` 中定义技能规格
2. 在 `index.ts` 中实现技能逻辑
3. 技能会自动注册到 `skillsRegistry`
4. MCP Server 会自动暴露新技能

### 技能定义示例

```typescript
const mySkill: SkillDefinition = {
  name: 'category.skill_name',
  category: 'category',
  displayName: '技能显示名',
  description: '技能描述',
  parameters: [
    { name: 'param1', type: 'string', description: '参数1', required: true },
    { name: 'param2', type: 'number', description: '参数2', required: false, default: 10 }
  ],
  execute: async (params, context) => {
    // 实现逻辑
    return {
      success: true,
      data: { ... },
      message: '执行成功'
    };
  }
};
```

## 依赖服务

- OCR: PaddleOCR (localhost:5100)
- 图片处理: Sharp
- PDF 处理: pdf-lib, pdf-parse
- Word 处理: mammoth, docx
- PPT 生成: pptxgenjs
- 图表: ECharts
- 截图: Puppeteer
