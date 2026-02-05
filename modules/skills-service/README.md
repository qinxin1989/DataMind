# AI 技能服务模块

## 模块概述

AI Agent 技能注册与执行服务，提供数据分析、文档处理、媒体生成、报告生成等能力。

## 功能特性

### 1. 技能分类
- **data**: 数据分析技能（查询、统计、可视化）
- **document**: 文档处理技能（生成、转换、OCR）
- **media**: 媒体处理技能（图片、视频生成）
- **report**: 报告生成技能（分析报告、图表报告）
- **crawler**: 爬虫技能（网页采集、数据提取）

### 2. 核心能力
- 技能注册与发现
- 参数验证
- 异步执行
- 结果可视化
- MCP 工具集成

## 目录结构

```
skills-service/
├── module.json           # 模块配置
├── README.md             # 说明文档
├── backend/
│   ├── index.ts          # 模块入口
│   ├── routes.ts         # API 路由
│   ├── service.ts        # 业务逻辑
│   ├── types.ts          # 类型定义
│   ├── registry.ts       # 技能注册中心
│   ├── data/             # 数据技能
│   ├── document/         # 文档技能
│   ├── media/            # 媒体技能
│   └── report/           # 报告技能
└── frontend/
    └── views/            # Vue 组件
```

## API 接口

| 方法 | 路径 | 描述 |
|-----|------|------|
| GET | /skills | 获取技能列表 |
| GET | /skills/categories | 获取技能分类 |
| GET | /skills/capabilities | 获取 Agent 能力 |
| GET | /skills/stats | 获取技能统计 |
| GET | /skills/descriptions | 获取技能描述（供 AI） |
| GET | /skills/mcp-tools | 获取 MCP 工具定义 |
| GET | /skills/:name | 获取技能详情 |
| POST | /skills/:name/execute | 执行技能 |

## 使用示例

```typescript
import { initSkillsModule, skillsService } from './modules/skills-service/backend';

// 初始化模块
const skillsModule = initSkillsModule({ autoRegister: true });

// 使用路由
app.use('/api/skills', skillsModule.routes);

// 执行技能
const result = await skillsService.executeSkill('data.query', {
  sql: 'SELECT * FROM users LIMIT 10'
}, {
  dataSource: myDataSource,
  userId: 'user-123'
});
```

## 注册自定义技能

```typescript
import { skillsService } from './modules/skills-service/backend';

skillsService.registerSkill({
  name: 'custom.mySkill',
  category: 'custom',
  displayName: '我的技能',
  description: '自定义技能示例',
  parameters: [
    { name: 'input', type: 'string', description: '输入', required: true }
  ],
  execute: async (params, context) => {
    return {
      success: true,
      data: { result: `处理: ${params.input}` }
    };
  }
});
```
