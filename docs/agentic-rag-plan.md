# Agentic 知识库检索实现

## 概述

基于 Agent Skills 的渐进式知识库检索系统，替代传统的向量库 RAG 方案。

## 核心设计

### 检索流程

```
用户问题
    ↓
1. 定位领域
   - 分析问题关键词
   - 读取根目录 data_structure.md
   - 定位相关文件夹
    ↓
2. 定位文件
   - 读取领域 data_structure.md
   - 使用 grep 搜索关键词
   - 筛选相关文件
    ↓
3. 定位内容
   - Markdown/文本：读取相关段落
   - PDF：调用解析脚本
   - Excel：读取相关表/行/列
    ↓
4. 生成回答
   - 基于检索内容生成答案
    ↓
5. 重试机制（最多 5 次）
   - 如果未找到答案，切换关键词重试
```

### 设计原则

1. **渐进式检索**: 少读但读准，优先查最可能的文件
2. **保持简单可控**: 用户只需指定知识库位置
3. **分层索引**: 每个目录有 data_structure.md 描述内容

## 知识库目录结构

```
knowledge/
├── data_structure.md          # 根目录索引
├── 技术文档/
│   ├── data_structure.md      # 领域索引
│   ├── API接口文档.md
│   ├── 系统架构说明.pdf
│   └── 系统架构说明.txt       # PDF 预处理文本
├── 业务知识/
│   ├── data_structure.md
│   ├── 产品说明书.docx
│   └── 销售数据分析.xlsx
└── 常见问题/
    ├── data_structure.md
    └── FAQ.md
```

## data_structure.md 格式

```markdown
# 技术文档

本目录包含系统技术相关文档。

## 文件列表

| 文件名 | 用途描述 | 适用场景 |
|--------|---------|---------|
| API接口文档.md | 所有 API 的定义和使用说明 | 查询 API 参数、返回值、调用方式 |
| 系统架构说明.pdf | 系统整体架构图和模块说明 | 了解系统设计、模块关系 |
```

## 实现位置

代码已实现在 `modules/rag-service/backend/agenticRetriever.ts`

### 核心类

```typescript
class AgenticRetriever {
  constructor(knowledgePath: string, maxRetries: number = 5)
  
  // 主检索入口
  async retrieve(query: string): Promise<RetrieveResult>
  
  // 提取关键词
  private extractKeywords(query: string): string[]
  
  // 定位领域
  private async locateDomain(query: string, keywords: string[]): Promise<DirectoryIndex[]>
  
  // Grep 搜索
  private async grepSearch(searchPath: string, keywords: string[]): Promise<Array<...>>
  
  // 读取文件内容
  private async readFileContent(filePath: string, keywords: string[]): Promise<string | null>
  
  // 生成替代关键词（重试时使用）
  private generateAlternativeKeywords(keywords: string[], retryCount: number): string[]
}
```

## 使用方式

### 后端 API

```typescript
// 使用 Agentic 模式问答
POST /api/rag/query
{
  "question": "如何使用知识库？",
  "mode": "agentic"  // 使用 Agentic 检索
}

// 或使用向量检索
POST /api/rag/query
{
  "question": "如何使用知识库？",
  "mode": "vector"   // 使用向量检索
}
```

### 代码调用

```typescript
import { initRagModule } from './modules/rag-service/backend';

const ragModule = initRagModule({ db: pool, aiConfigs: [] });

// 使用服务
const service = ragModule.createService(userId);
const result = await service.query({
  question: '如何配置系统？',
  mode: 'agentic'
});
```

## 优缺点对比

### 优势
- ✅ 不需要预建向量索引
- ✅ 更轻量，适合个人知识库
- ✅ 检索更智能，AI 参与决策
- ✅ 支持多种文件格式

### 劣势
- ⚠️ 首次检索 PDF 等格式需要转换
- ⚠️ Token 消耗可能更大
- ⚠️ 多轮检索后 AI 可能遗忘

## 后续优化

1. **预处理优化**: 上传时自动将 PDF/Word 转为文本
2. **缓存机制**: 缓存常用查询结果
3. **混合模式**: 结合向量和 Agentic 的优势
4. **自动索引**: 自动生成 data_structure.md
