# AI智能问答模块

## 概述

AI智能问答模块是一个功能强大的AI驱动的数据分析和问答系统，提供自然语言到SQL转换、知识库管理、RAG检索、文章生成等多种功能。

## 功能特性

### 核心功能

1. **自然语言问答 (NL to SQL)**
   - 将自然语言问题转换为SQL查询
   - 支持多轮对话上下文
   - 智能意图识别
   - 数据脱敏保护

2. **数据源管理**
   - 支持多种数据库类型（MySQL、PostgreSQL、SQLite等）
   - 数据源连接测试
   - 数据源权限控制
   - 数据源分类管理

3. **Schema 分析**
   - 自动分析数据库结构
   - AI生成表和字段的中文名称
   - 生成常见问题建议
   - 支持手动编辑和优化

4. **会话管理**
   - 保存对话历史
   - 会话列表和详情查看
   - 会话删除和清理

5. **Agent 技能和工具**
   - 内置多种数据分析技能
   - 支持MCP工具集成
   - 技能动态调用
   - 工具能力查询

6. **自动分析**
   - 主题式数据分析
   - 自动生成分析报告
   - 数据质量检查
   - 可视化大屏生成

7. **RAG 知识库**
   - 文档上传和管理
   - 向量检索
   - 混合问答（数据+知识）
   - 知识库分类管理
   - Schema导入知识库

8. **知识图谱**
   - 自动构建实体关系图
   - 子图查询
   - 图谱可视化

9. **文章生成**
   - AI生成文章大纲
   - 分章节生成内容
   - 异步任务系统
   - 任务状态跟踪

## 技术架构

### 后端

- **Service层**: `backend/service.ts`
  - AIQAService: 核心服务类，封装所有业务逻辑
  - 数据源管理、Schema分析、AI问答、RAG检索等
  - 使用MySQL存储配置和数据

- **Routes层**: `backend/routes.ts`
  - 40+ 个API端点
  - 权限验证
  - 文件上传处理
  - 错误处理

- **Types层**: `backend/types.ts`
  - TypeScript类型定义
  - 请求/响应接口
  - 数据模型定义

### 前端

- **Views**: `frontend/views/`
  - QAManagement.vue: 智能问答界面
  - KnowledgeBase.vue: 知识库管理界面

- **API**: `frontend/api/index.ts`
  - API调用封装
  - 类型安全

## API端点

### 知识库分类管理

- `GET /api/ai-qa/categories` - 获取所有分类
- `POST /api/ai-qa/categories` - 创建分类
- `PUT /api/ai-qa/categories/:id` - 更新分类
- `DELETE /api/ai-qa/categories/:id` - 删除分类

### 数据源管理

- `GET /api/ai-qa/datasources` - 获取数据源列表
- `GET /api/ai-qa/datasources/:id` - 获取数据源详情
- `POST /api/ai-qa/datasources` - 创建数据源
- `PUT /api/ai-qa/datasources/:id` - 更新数据源
- `DELETE /api/ai-qa/datasources/:id` - 删除数据源
- `POST /api/ai-qa/datasources/test` - 测试连接
- `GET /api/ai-qa/datasources/:id/test` - 测试现有连接

### Schema 分析

- `GET /api/ai-qa/datasources/:id/schema` - 获取Schema
- `GET /api/ai-qa/datasources/:id/schema/analyze` - 分析Schema
- `PUT /api/ai-qa/datasources/:id/schema/table/:tableName` - 更新表分析
- `PUT /api/ai-qa/datasources/:id/schema/table/:tableName/column/:columnName` - 更新字段分析
- `PUT /api/ai-qa/datasources/:id/schema/questions` - 更新建议问题

### AI 问答

- `POST /api/ai-qa/ask` - 提问
- `POST /api/ai-qa/query` - 执行SQL查询

### 会话管理

- `GET /api/ai-qa/chat/sessions/:datasourceId` - 获取会话列表
- `GET /api/ai-qa/chat/session/:id` - 获取会话详情
- `DELETE /api/ai-qa/chat/session/:id` - 删除会话

### Agent 技能和工具

- `GET /api/ai-qa/agent/skills` - 获取技能列表
- `POST /api/ai-qa/agent/skills/:name/execute` - 执行技能
- `GET /api/ai-qa/agent/mcp/tools` - 获取MCP工具
- `POST /api/ai-qa/agent/mcp/:server/:tool` - 调用MCP工具
- `GET /api/ai-qa/agent/capabilities` - 获取能力列表

### 自动分析

- `POST /api/ai-qa/agent/analyze` - 自动分析
- `GET /api/ai-qa/agent/analyze/stream` - 流式分析
- `POST /api/ai-qa/agent/dashboard` - 生成大屏
- `GET /api/ai-qa/agent/dashboard/preview` - 预览大屏
- `POST /api/ai-qa/agent/quality` - 数据质量检查

### RAG 知识库

- `GET /api/ai-qa/rag/stats` - 获取统计信息
- `GET /api/ai-qa/rag/search` - 搜索知识库
- `GET /api/ai-qa/rag/documents` - 获取文档列表
- `GET /api/ai-qa/rag/documents/:id` - 获取文档详情
- `POST /api/ai-qa/rag/documents` - 添加文档
- `DELETE /api/ai-qa/rag/documents/:id` - 删除文档
- `POST /api/ai-qa/rag/upload` - 上传文件
- `POST /api/ai-qa/rag/ask` - RAG问答
- `POST /api/ai-qa/rag/outline` - 生成大纲
- `POST /api/ai-qa/rag/section` - 生成章节
- `POST /api/ai-qa/rag/tasks/submit` - 提交文章任务
- `GET /api/ai-qa/rag/tasks/:id` - 获取任务状态
- `GET /api/ai-qa/rag/graph` - 获取知识图谱
- `POST /api/ai-qa/rag/graph/query` - 查询子图
- `POST /api/ai-qa/rag/import-schema` - 导入Schema到知识库

## 权限

- `ai-qa:view` - 查看AI问答
- `ai-qa:ask` - 使用AI问答
- `ai-qa:knowledge:view` - 查看知识库
- `ai-qa:knowledge:manage` - 管理知识库
- `ai-qa:datasource:manage` - 管理数据源
- `ai-qa:category:manage` - 管理知识库分类

## 数据库

### 表结构

```sql
-- 知识库分类表
CREATE TABLE knowledge_categories (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_name (name),
  FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
);

-- 知识库文档表
CREATE TABLE knowledge_documents (
  id VARCHAR(36) PRIMARY KEY,
  knowledge_base_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  type VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content LONGTEXT NOT NULL,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_knowledge_base (knowledge_base_id),
  INDEX idx_user (user_id),
  INDEX idx_type (type),
  FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
);

-- 知识库分块表
CREATE TABLE knowledge_chunks (
  id VARCHAR(36) PRIMARY KEY,
  document_id VARCHAR(36) NOT NULL,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding JSON NOT NULL,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_document (document_id),
  INDEX idx_chunk_index (chunk_index),
  FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
);
```

## 使用示例

### 创建数据源

```typescript
import { aiQAApi } from '@/modules/ai-qa/frontend/api';

const datasource = await aiQAApi.createDataSource({
  name: 'Sales DB',
  type: 'mysql',
  config: {
    host: 'localhost',
    port: 3306,
    database: 'sales',
    user: 'root',
    password: 'password'
  }
});
```

### AI 问答

```typescript
const response = await aiQAApi.ask({
  datasourceId: 'ds-123',
  question: '销售额最高的前10个产品是什么？',
  sessionId: 'session-456' // 可选，用于多轮对话
});

console.log(response.answer); // AI的回答
console.log(response.sql); // 生成的SQL
console.log(response.data); // 查询结果
```

### 添加知识库文档

```typescript
const doc = await aiQAApi.addDocument({
  title: '产品使用手册',
  content: '这是产品的详细使用说明...',
  type: 'manual',
  tags: ['产品', '手册'],
  categoryId: 'cat-123'
});
```

### RAG 问答

```typescript
const result = await aiQAApi.ragAsk({
  question: '如何使用数据分析功能？',
  categoryId: 'cat-123' // 可选，限定搜索范围
});

console.log(result.answer); // AI的回答
console.log(result.sources); // 引用的文档来源
console.log(result.confidence); // 置信度
```

### 生成文章

```typescript
// 1. 生成大纲
const outline = await aiQAApi.generateOutline({
  topic: '数据分析最佳实践',
  categoryId: 'cat-123'
});

// 2. 提交生成任务
const taskId = await aiQAApi.submitArticleTask({
  topic: '数据分析最佳实践',
  outline: outline,
  categoryId: 'cat-123'
});

// 3. 查询任务状态
const task = await aiQAApi.getArticleTask(taskId);
console.log(task.status); // pending, generating, completed, failed
console.log(task.content); // 生成的文章内容
```

## 生命周期钩子

模块实现了完整的生命周期钩子：

- `beforeInstall` - 检查依赖模块（ai-config）
- `afterInstall` - 初始化数据库表
- `beforeEnable` - 检查AI配置
- `afterEnable` - 记录启用信息
- `beforeDisable` - 检查活跃会话
- `afterDisable` - 记录禁用信息
- `beforeUninstall` - 警告数据删除
- `afterUninstall` - 清理数据库表

## 测试

运行测试：

```bash
npx vitest run tests/modules/ai-qa/service.test.ts
```

## 依赖

### 模块依赖

- `ai-config` (^1.0.0) - AI配置管理模块

### npm 依赖

- `uuid` - 生成唯一ID
- `mysql2` - 数据库连接
- `multer` - 文件上传
- `openai` - AI API调用

## 配置

### 配置项

模块支持以下配置项（在 `config/schema.json` 中定义）：

#### RAG 配置

- `rag.chunkSize`: 文档分块大小（默认500字符）
- `rag.chunkOverlap`: 分块重叠大小（默认50字符）
- `rag.topK`: 检索返回的文档数量（默认3）
- `rag.similarityThreshold`: 相似度阈值（默认0.6）

#### 问答配置

- `qa.maxHistoryMessages`: 会话历史最大消息数（默认10）
- `qa.timeout`: 问答超时时间（默认30秒）
- `qa.enableDataMasking`: 是否启用数据脱敏（默认true）

#### 文章生成配置

- `article.maxConcurrentTasks`: 最大并发任务数（默认2）
- `article.maxStoredTasks`: 最大存储任务数（默认50）
- `article.taskTimeout`: 任务超时时间（默认10分钟）

#### 上传配置

- `upload.maxFileSize`: 最大文件大小（默认20MB）
- `upload.allowedExtensions`: 允许的文件扩展名

### 修改配置

```typescript
import { configManager } from '@/module-system/core/ConfigManager';

await configManager.updateConfig('ai-qa', {
  rag: {
    chunkSize: 800,
    topK: 5
  }
});
```

## 注意事项

1. **依赖要求**
   - 必须先安装并启用 `ai-config` 模块
   - 需要配置至少一个激活的AI服务

2. **数据安全**
   - 默认启用数据脱敏
   - 敏感数据会自动脱敏处理
   - 支持权限控制

3. **性能优化**
   - RAG检索使用向量索引
   - 数据源连接使用连接池
   - 支持缓存机制

4. **文件上传**
   - 支持多种文件格式
   - 自动提取文本内容
   - PDF需要额外的解析库

5. **异步任务**
   - 文章生成使用异步任务
   - 任务有超时限制
   - 支持任务状态查询

## 故障排查

### 问题：AI问答返回错误

**解决方案**：
1. 检查AI配置是否正确
2. 检查数据源连接是否正常
3. 查看错误日志获取详细信息

### 问题：RAG检索结果不准确

**解决方案**：
1. 调整相似度阈值
2. 增加topK值
3. 优化文档分块大小
4. 检查embedding模型配置

### 问题：文件上传失败

**解决方案**：
1. 检查文件大小是否超限
2. 检查文件格式是否支持
3. 检查上传目录权限
4. 查看服务器日志

## 版本历史

- v1.0.0 - 初始版本
  - 自然语言问答
  - 数据源管理
  - Schema分析
  - RAG知识库
  - 知识图谱
  - 文章生成
  - 40+ API端点
  - 完整的生命周期钩子

## 贡献

欢迎提交问题和改进建议！

## 许可证

MIT
