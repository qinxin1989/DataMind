# AI爬虫助手模块

AI驱动的智能爬虫助手，支持网页分析、选择器生成、预览抓取、模板管理。

## 功能特性

### 核心功能

1. **智能对话分析**
   - 支持多URL并发分析（最大3并发）
   - 自动提取URL并生成爬虫模板
   - 上下文对话，支持选择器修正

2. **网页分析**
   - 动态引擎优先（支持JS渲染）
   - 降级到静态抓取
   - HTML智能清理（保留核心结构）

3. **AI选择器识别**
   - 使用OpenAI API分析网页结构
   - 自动生成CSS选择器
   - 识别部门/组织信息

4. **预览抓取**
   - 使用Python引擎
   - 支持动态渲染
   - 分页数据支持

5. **模板管理**
   - 保存/获取/更新/删除模板
   - 用户隔离
   - 字段配置

6. **选择器验证**
   - 实时验证CSS选择器
   - 返回匹配元素数量
   - 错误诊断

7. **AI诊断**
   - 失败原因分析
   - 修复建议
   - 推荐采集策略

8. **对话历史**
   - 保存对话记录
   - 消息管理
   - 历史查询

## 技术架构

### 后端服务

- **service.ts**: 核心业务逻辑
  - 对话处理（processChat）
  - 网页分析（analyzeWebpage）
  - HTML获取和清理
  - AI选择器识别
  - 预览抓取
  - 模板管理

- **routes.ts**: API路由定义
  - 18个API端点
  - 权限控制
  - 错误处理

- **types.ts**: TypeScript类型定义
  - 请求/响应类型
  - 业务实体类型

- **index.ts**: 模块入口
  - 8个生命周期钩子
  - 依赖检查
  - 路由注册

### 数据库表

1. **crawler_templates**: 爬虫模板
   - id, user_id, name, url
   - department, data_type
   - container_selector
   - created_at, updated_at

2. **crawler_template_fields**: 模板字段
   - id, template_id
   - field_name, field_selector

3. **crawler_assistant_conversations**: 对话记录
   - id, user_id, title
   - created_at, updated_at

4. **crawler_assistant_messages**: 对话消息
   - id, conversation_id
   - role, type, content
   - created_at

## API端点

### 爬虫分析

- `POST /ai/crawler/analyze` - 分析网页并生成选择器
- `POST /ai/crawler/chat` - 智能对话（支持流式输出）
- `POST /ai/crawler/preview` - 预览抓取效果
- `POST /ai/crawler/diagnose` - AI失败诊断
- `POST /ai/crawler/test` - 测试爬虫模板
- `GET /ai/crawler/proxy` - 网页预览代理
- `POST /ai/crawler/validate-selector` - 验证CSS选择器

### 模板管理

- `POST /ai/crawler/template` - 保存模板
- `GET /ai/crawler/templates` - 获取模板列表
- `GET /ai/crawler/templates/:id` - 获取单个模板
- `PUT /ai/crawler/templates/:id` - 更新模板
- `DELETE /ai/crawler/templates/:id` - 删除模板

### 对话历史

- `GET /ai/crawler-conversations-latest` - 获取最新对话
- `GET /ai/crawler-conversations` - 获取对话列表
- `GET /ai/crawler-conversations/:id` - 获取对话详情
- `POST /ai/crawler-conversations` - 创建新对话
- `PUT /ai/crawler-conversations/:id` - 更新对话
- `DELETE /ai/crawler-conversations/:id` - 删除对话

## 依赖关系

### 模块依赖

- **ai-config**: AI配置管理模块（必需）
  - 获取AI服务配置
  - API Key管理
  - 优先级排序

### 外部依赖

- **axios**: HTTP请求
- **cheerio**: HTML解析
- **openai**: OpenAI API客户端
- **Python环境**: 预览抓取引擎

## 配置选项

```json
{
  "maxConcurrency": 3,           // 最大并发数
  "htmlCleanLimit": 40000,       // HTML清理长度限制
  "previewTimeout": 60000,       // 预览超时时间（毫秒）
  "enableDynamicEngine": true,   // 启用动态引擎
  "pythonPath": "",              // Python路径
  "conversationHistoryLimit": 50, // 对话历史数量限制
  "aiTemperature": 0.1,          // AI温度参数
  "enableAIDiagnosis": true      // 启用AI诊断
}
```

## 使用示例

### 1. 分析网页

```typescript
POST /api/admin/ai/crawler/analyze
{
  "url": "https://example.com/news",
  "description": "提取新闻列表"
}
```

### 2. 智能对话

```typescript
POST /api/admin/ai/crawler/chat
{
  "messages": [
    { "role": "user", "content": "分析这个网页 https://example.com" }
  ],
  "stream": true  // 启用流式输出
}
```

### 3. 预览抓取

```typescript
POST /api/admin/ai/crawler/preview
{
  "url": "https://example.com/news",
  "selectors": {
    "container": "tr",
    "fields": {
      "标题": "td:nth-child(2) a",
      "链接": "td:nth-child(2) a::attr(href)",
      "日期": "td:nth-child(3)"
    }
  },
  "page": 1,
  "pageSize": 10
}
```

### 4. 保存模板

```typescript
POST /api/admin/ai/crawler/template
{
  "name": "新闻列表模板",
  "url": "https://example.com/news",
  "department": "新闻中心",
  "selectors": {
    "container": "tr",
    "fields": {
      "标题": "td:nth-child(2) a",
      "链接": "td:nth-child(2) a::attr(href)"
    }
  }
}
```

## 生命周期钩子

### beforeInstall
- 检查ai-config模块依赖

### afterInstall
- 验证数据库表

### beforeUninstall
- 检查依赖此模块的其他模块

### afterUninstall
- 保留用户数据

### beforeEnable
- 检查ai-config模块状态
- 检查Python环境

### afterEnable
- 注册路由

### beforeDisable
- 清理正在进行的任务

### afterDisable
- 自动移除路由

## 技术亮点

1. **并发控制**: 3并发限流，兼顾速度与稳定性
2. **智能降级**: 动态引擎失败自动降级到静态抓取
3. **HTML清理**: 极简清理，保留核心结构，减少Token消耗
4. **AI分析**: 使用OpenAI API智能识别选择器
5. **预览优化**: 使用动态引擎获取完整HTML
6. **错误诊断**: AI驱动的失败原因分析
7. **流式输出**: 支持SSE流式返回结果
8. **用户隔离**: 模板和对话按用户隔离

## 注意事项

1. **Python环境**: 预览功能需要Python环境和相关依赖
2. **AI配置**: 必须先配置AI服务才能使用
3. **网络访问**: 需要访问目标网站和AI服务
4. **超时设置**: 根据网络情况调整超时时间
5. **并发限制**: 避免过高并发导致目标网站封禁
6. **数据保留**: 卸载模块不会删除用户数据

## 测试

运行测试：
```bash
npx vitest run tests/modules/ai-crawler-assistant/service.test.ts
```

## 版本历史

- **1.0.0** (2024-02-01)
  - 初始版本
  - 支持智能对话分析
  - 支持网页分析和选择器生成
  - 支持预览抓取
  - 支持模板管理
  - 支持对话历史

## 许可证

MIT
