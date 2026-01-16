# 报告生成技能 (Report Skills)

## 概述
报告生成技能用于生成各种格式的数据报告、演示文稿和可视化大屏。

## 技能列表

### 1. report.ppt - PPT生成
**描述**: 根据数据和主题生成PPT演示文稿
**参数**:
- `datasourceId` (string, required): 数据源ID
- `topic` (string, required): 报告主题
- `template` (string, optional): 模板名称
- `slides` (number, optional): 幻灯片数量，默认10
- `style` (string, optional): 风格 (business/tech/simple)

**返回**:
```json
{
  "success": true,
  "outputPath": "/downloads/report.pptx",
  "slideCount": 10,
  "sections": ["概述", "数据分析", "结论"]
}
```

### 2. report.dashboard - 数据大屏
**描述**: 生成数据可视化大屏
**参数**:
- `datasourceId` (string, required): 数据源ID
- `topic` (string, required): 大屏主题
- `theme` (string, optional): 主题 (dark/light)
- `layout` (string, optional): 布局 (auto/grid/flow)
- `charts` (array, optional): 指定图表配置

**返回**:
```json
{
  "success": true,
  "previewUrl": "/dashboard/preview/xxx",
  "config": {...},
  "charts": [...]
}
```

### 3. report.summary - 数据摘要报告
**描述**: 生成数据摘要文档
**参数**:
- `datasourceId` (string, required): 数据源ID
- `topic` (string, optional): 摘要主题
- `format` (string, optional): 输出格式 (markdown/html/pdf)
- `sections` (string[], optional): 包含的章节

**返回**:
```json
{
  "success": true,
  "content": "# 数据摘要报告\n...",
  "outputPath": "/downloads/summary.pdf",
  "wordCount": 2000
}
```

### 4. report.excel - Excel报表
**描述**: 生成Excel数据报表
**参数**:
- `datasourceId` (string, required): 数据源ID
- `queries` (array, required): 查询配置列表
- `template` (string, optional): Excel模板路径
- `charts` (boolean, optional): 是否包含图表

**返回**:
```json
{
  "success": true,
  "outputPath": "/downloads/report.xlsx",
  "sheets": ["数据概览", "详细数据", "图表"],
  "rowCount": 1000
}
```

### 5. report.insight - 智能洞察
**描述**: 自动发现数据中的关键洞察
**参数**:
- `datasourceId` (string, required): 数据源ID
- `focus` (string, optional): 关注点
- `depth` (string, optional): 分析深度 (quick/deep)

**返回**:
```json
{
  "success": true,
  "insights": [
    { "type": "trend", "description": "销售额持续增长", "confidence": 0.9 },
    { "type": "anomaly", "description": "3月数据异常", "confidence": 0.85 }
  ],
  "recommendations": ["建议1", "建议2"]
}
```

### 6. report.compare - 对比分析报告
**描述**: 生成多维度对比分析报告
**参数**:
- `datasourceId` (string, required): 数据源ID
- `dimensions` (string[], required): 对比维度
- `metrics` (string[], required): 对比指标
- `format` (string, optional): 输出格式

**返回**:
```json
{
  "success": true,
  "comparisons": [...],
  "summary": "对比分析总结",
  "outputPath": "/downloads/compare.pdf"
}
```

## MCP 调用示例

```json
{
  "tool": "report_generate",
  "arguments": {
    "skill": "report.ppt",
    "datasourceId": "ds-001",
    "topic": "2024年度销售分析",
    "style": "business"
  }
}
```

## 依赖服务
- PptxGenJS (PPT生成)
- ECharts (图表渲染)
- Puppeteer (大屏截图)
- ExcelJS (Excel生成)
