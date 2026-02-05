# RAG 知识库服务模块

## 模块概述

RAG (Retrieval-Augmented Generation) 知识库服务，提供智能知识检索和问答能力。

## 功能特性

### 1. 知识存储
- 支持多种文档类型：文档、数据源、网页、笔记
- 自动文档分块和向量化
- 知识分类管理

### 2. 检索模式
- **向量检索 (Vector)**: 基于嵌入向量的语义相似度检索
- **Agentic 检索**: 渐进式检索，使用 grep 和目录索引
- **混合检索 (Hybrid)**: 结合向量和 Agentic 的优势

### 3. 知识图谱
- 自动提取文档中的实体和关系
- 支持图谱查询和可视化

## 目录结构

```
rag-service/
├── module.json           # 模块配置
├── README.md             # 说明文档
├── backend/
│   ├── index.ts          # 模块入口
│   ├── routes.ts         # API 路由
│   ├── service.ts        # 业务逻辑
│   ├── types.ts          # 类型定义
│   ├── ragEngine.ts      # RAG 引擎核心
│   ├── agenticRetriever.ts   # Agentic 检索器
│   ├── knowledgeBase.ts  # 知识库管理
│   ├── knowledgeGraph.ts # 知识图谱
│   ├── vectorStore.ts    # 向量存储
│   ├── embeddingService.ts   # 嵌入服务
│   ├── documentProcessor.ts  # 文档处理
│   ├── hooks/            # 生命周期钩子
│   └── migrations/       # 数据库迁移
├── config/
│   ├── schema.json       # 配置 Schema
│   └── default.json      # 默认配置
└── frontend/
    ├── index.ts          # 前端入口
    ├── routes.ts         # 前端路由
    └── views/            # Vue 组件
```

## API 接口

| 方法 | 路径 | 描述 |
|-----|------|------|
| GET | /rag/stats | 获取知识库统计 |
| GET | /rag/documents | 获取文档列表 |
| POST | /rag/documents | 上传文档 |
| DELETE | /rag/documents/:id | 删除文档 |
| POST | /rag/query | 知识问答 |
| POST | /rag/search | 搜索知识 |
| GET | /rag/categories | 获取分类列表 |
| POST | /rag/categories | 创建分类 |

## 使用示例

```typescript
import { initRagModule } from './modules/rag-service/backend';

// 初始化模块
const ragModule = initRagModule({
  db: pool,
  aiConfigs: [{ apiKey: '...', baseUrl: '...', model: 'qwen-plus' }]
});

// 使用路由
app.use('/api/rag', ragModule.routes);

// 创建服务实例
const service = ragModule.createService(userId);
const result = await service.query({
  question: '如何使用知识库？',
  mode: 'agentic'
});
```

## Agentic 检索说明

### 目录结构要求
```
knowledge/
├── data_structure.md     # 根目录索引
├── 技术文档/
│   ├── data_structure.md # 领域索引
│   └── *.md              # 知识文件
└── 业务知识/
    └── ...
```

### data_structure.md 格式
```markdown
# 领域名称

| 文件名 | 用途描述 | 关键词 |
|--------|---------|--------|
| API.md | API 接口文档 | api,接口,请求 |
```
