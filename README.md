# AI数据问答平台

支持多数据源连接的自然语言数据查询平台，可独立部署或嵌入其他系统。

## 功能特性

- 多数据源支持：MySQL、PostgreSQL、CSV/Excel文件、API接口
- 自动识别数据结构
- 自然语言转SQL
- 智能问答与结果解读
- **Agent Skills** - 内置智能技能（统计分析、趋势分析、排名、异常检测等）
- **MCP 工具集成** - 支持外部工具调用扩展AI能力

## Agent 能力

### 内置技能 (Skills)
| 技能 | 说明 |
|------|------|
| data_statistics | 数据统计分析（计数、求和、平均值等） |
| trend_analysis | 时间趋势分析 |
| top_ranking | Top N 排名 |
| data_comparison | 数据对比分析 |
| anomaly_detection | 异常值检测 |
| data_export | 数据导出（JSON/CSV） |

### MCP 工具
| 服务器 | 工具 | 说明 |
|--------|------|------|
| calculator | calculate | 数学表达式计算 |
| calculator | percentage | 百分比计算 |
| datetime | now | 获取当前时间 |
| datetime | date_diff | 日期差值计算 |
| formatter | format_number | 数字格式化 |
| formatter | json_to_table | JSON转Markdown表格 |

### 自动分析 (Auto Analyst)
AI 自主规划分析步骤、执行查询、生成结论，过程中展示执行的 SQL 代码。

**特点：**
- AI 自动规划 3-6 步分析方案
- 每步执行 SQL 并生成摘要（不暴露原始数据）
- 最终输出结论、洞察和建议

### BI 大屏生成 (Dashboard Generator)
AI 自动设计并生成可视化大屏，支持多种图表类型和主题风格。

**支持的图表：**
- card: 指标卡片
- bar: 柱状图
- line: 折线图
- pie: 饼图
- area: 面积图
- gauge: 仪表盘
- table: 数据表格
- radar: 雷达图

**主题风格：** light / dark / tech

## 快速开始

### 1. 核心服务 (Backend)

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 OpenAI API Key 和数据库配置

# 启动服务 (基础模式，直接读取 .env)
npm run dev

# --- 生产模式 (推荐) ---

# 1. 加密敏感配置 (生成 .env.encrypted)
npm run encrypt-env

# 2. 安全模式启动 (从 .env.encrypted 加密文件读取配置)
npm run start:secure
```

> [!TIP]
> 安全模式启动时会提示输入主密码，这样可以避免敏感密钥（如 `FILE_ENCRYPTION_KEY`）以明文形式存在于磁盘上。

### 2. 前端管理后台 (Admin UI)

详见 [admin-ui/README.md](./admin-ui/README.md)

```bash
cd admin-ui
npm install
npm run dev
```

### 3. OCR 服务 (可选)

详见 [ocr-service/README.md](./ocr-service/README.md)

提供图片文字识别能力，支持 GPU/CPU 模式。

```bash
cd ocr-service
pip install -r requirements.txt
python app.py
```

## API接口

### 添加数据源
```bash
# MySQL
curl -X POST http://localhost:3000/api/datasource \
  -H "Content-Type: application/json" \
  -d '{
    "name": "业务数据库",
    "type": "mysql",
    "config": {
      "host": "localhost",
      "port": 3306,
      "user": "root",
      "password": "password",
      "database": "mydb"
    }
  }'

# CSV文件
curl -X POST http://localhost:3000/api/datasource \
  -H "Content-Type: application/json" \
  -d '{
    "name": "销售数据",
    "type": "file",
    "config": {
      "path": "/data/sales.csv",
      "fileType": "csv"
    }
  }'

# API接口
curl -X POST http://localhost:3000/api/datasource \
  -H "Content-Type: application/json" \
  -d '{
    "name": "用户API",
    "type": "api",
    "config": {
      "url": "https://api.example.com/users",
      "method": "GET",
      "headers": {"Authorization": "Bearer xxx"}
    }
  }'
```

### 自然语言问答
```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "datasourceId": "your-datasource-id",
    "question": "最近一个月销售额最高的前10个产品是什么？"
  }'
```

### 获取数据结构
```bash
curl http://localhost:3000/api/datasource/{id}/schema
```

## Agent API

### 获取Agent能力概览
```bash
curl http://localhost:3000/api/agent/capabilities
```

### 获取所有技能
```bash
curl http://localhost:3000/api/agent/skills
```

### 直接调用技能
```bash
curl -X POST http://localhost:3000/api/agent/skills/data_statistics/execute \
  -H "Content-Type: application/json" \
  -d '{
    "datasourceId": "your-datasource-id",
    "params": {
      "table": "orders",
      "field": "amount",
      "groupBy": "category"
    }
  }'
```

### 获取MCP工具列表
```bash
curl http://localhost:3000/api/agent/mcp/tools
```

### 调用MCP工具
```bash
curl -X POST http://localhost:3000/api/agent/mcp/calculator/calculate \
  -H "Content-Type: application/json" \
  -d '{"expression": "100 * 1.15"}'
```

### 自动分析
```bash
# 普通请求（等待完成后返回完整报告）
curl -X POST http://localhost:3000/api/agent/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "datasourceId": "your-datasource-id",
    "topic": "分析公司人员结构，包括部门分布、职级分布、入职时间分布等"
  }'

# SSE流式请求（实时展示分析进度）
curl "http://localhost:3000/api/agent/analyze/stream?datasourceId=xxx&topic=人员结构分析"
```

**返回示例：**
```json
{
  "title": "公司人员结构分析报告",
  "objective": "全面分析公司人员的部门分布、职级结构和入职趋势",
  "steps": [
    {
      "step": 1,
      "description": "统计各部门人数分布",
      "type": "sql",
      "code": "SELECT department, COUNT(*) as count FROM employees GROUP BY department",
      "summary": "共6个部门，技术部人数最多，占比约40%"
    }
  ],
  "conclusion": "公司人员结构整体健康，技术部门占比较高符合科技公司特点...",
  "insights": [
    "技术部门人数占比40%，是公司核心力量",
    "近一年新入职员工占比25%，团队较为年轻"
  ],
  "recommendations": [
    "建议加强中层管理人员培养",
    "关注技术部门人员流失风险"
  ]
}
```

### 生成 BI 大屏
```bash
# 生成大屏配置和预览HTML
curl -X POST http://localhost:3000/api/agent/dashboard \
  -H "Content-Type: application/json" \
  -d '{
    "datasourceId": "your-datasource-id",
    "topic": "公司人员结构大屏",
    "theme": "dark"
  }'

# 直接预览大屏（浏览器打开）
http://localhost:3000/api/agent/dashboard/preview?datasourceId=xxx&topic=人员结构大屏&theme=tech
```

**返回结构：**
```json
{
  "dashboard": {
    "id": "dashboard_xxx",
    "title": "公司人员结构大屏",
    "description": "实时展示公司人员分布和趋势",
    "theme": "dark",
    "gridCols": 12,
    "charts": [
      {
        "id": "chart_1",
        "type": "card",
        "title": "员工总数",
        "sql": "SELECT COUNT(*) as value FROM employees",
        "config": { "valueField": "value", "suffix": "人" },
        "gridPosition": { "x": 0, "y": 0, "w": 3, "h": 1 },
        "data": [{ "value": 256 }]
      },
      {
        "id": "chart_2",
        "type": "pie",
        "title": "部门分布",
        "sql": "SELECT department, COUNT(*) as count FROM employees GROUP BY department",
        "config": { "labelField": "department", "valueField": "count" },
        "gridPosition": { "x": 0, "y": 1, "w": 6, "h": 2 },
        "data": [...]
      }
    ]
  },
  "previewHtml": "<!DOCTYPE html>..."
}
```

## 嵌入其他平台

可通过iframe或API调用方式集成：

```html
<!-- iframe嵌入 -->
<iframe src="http://your-server:3000" width="100%" height="600"></iframe>
```

```javascript
// API调用
const response = await fetch('http://your-server:3000/api/ask', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ datasourceId: 'xxx', question: '查询问题' })
});
const result = await response.json();
```
