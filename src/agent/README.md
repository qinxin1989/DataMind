# Agent 模块

AI Agent 核心模块，包含智能问答、技能系统、MCP 工具等功能。

## 目录结构

```
src/agent/
├── README.md              # 本文件
├── index.ts               # Agent 主入口，AIAgent 类
├── analyst.ts             # 自动分析器 (AutoAnalyst)
├── dashboard.ts           # 数据大屏生成器 (DashboardGenerator)
├── qualityInspector.ts    # 数据质量检测器 (QualityInspector)
├── skills.ts              # 旧版技能系统（内置技能）
│
├── skills/                # 新版技能系统（按分类）
│   ├── README.md          # 技能系统说明
│   ├── index.ts           # 技能系统入口
│   ├── registry.ts        # 技能注册中心
│   ├── data/              # 数据处理技能
│   │   ├── skill.md       # 技能定义文档
│   │   └── index.ts       # 实现
│   ├── document/          # 文档处理技能
│   │   ├── skill.md
│   │   └── index.ts
│   ├── media/             # 媒体处理技能
│   │   ├── skill.md
│   │   └── index.ts
│   └── report/            # 报告生成技能
│       ├── skill.md
│       ├── index.ts
│       └── pptGenerator.ts  # PPT 生成器
│
└── mcp/                   # MCP (Model Context Protocol) 模块
    ├── index.ts           # MCP 入口
    ├── registry.ts        # MCP 注册中心
    └── servers/           # 内置 MCP 服务器
        ├── calculator.ts  # 计算工具
        ├── datetime.ts    # 日期时间工具
        ├── formatter.ts   # 数据格式化工具
        ├── textFormatter.ts # 文本编排工具
        └── pptServer.ts   # PPT 生成工具
```

## 核心组件

### 1. AIAgent (index.ts)
主 Agent 类，负责：
- 智能问答（自然语言转 SQL）
- 技能调用
- MCP 工具调用
- 数据分析和可视化

### 2. Skills 系统 (skills/)
按分类组织的技能系统：
- **data**: 数据查询、分析、清洗、关联
- **document**: PDF/Word 转换、文档合并、文本提取
- **media**: OCR、图片处理、图表生成、截图
- **report**: PPT 生成、数据大屏、Excel 报表

### 3. MCP 模块 (mcp/)
Model Context Protocol 工具系统：
- 计算器工具
- 日期时间工具
- 数据格式化工具
- 文本编排工具
- PPT 生成工具

### 4. 专业分析器
- **AutoAnalyst**: 自动数据分析，生成分析报告
- **DashboardGenerator**: 数据大屏生成
- **QualityInspector**: 数据质量检测

## 使用示例

### 智能问答
```typescript
import { AIAgent } from './agent';

const agent = new AIAgent(apiKey, baseURL, model);
const response = await agent.answer(
  '查询销售额最高的10个产品',
  dataSource,
  'mysql',
  history
);
```

### 技能调用
```typescript
import { skillsRegistry } from './agent/skills';

const result = await skillsRegistry.execute('report.ppt', {
  datasourceId: 'xxx',
  topic: '销售分析'
}, context);
```

### MCP 工具调用
```typescript
import { mcpRegistry } from './agent/mcp';

const result = await mcpRegistry.callTool('calculator', 'calculate', {
  expression: '100 * 1.2'
});
```

## 外部 MCP 服务器

位于 `mcp-servers/` 目录：
- `ocr-server/` - OCR 图片识别服务
- `skills-server/` - Skills 技能服务（暴露所有技能为 MCP 工具）
