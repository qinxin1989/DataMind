# AI配置管理模块

## 概述

AI配置管理模块提供了完整的AI服务配置管理功能，支持多提供商、API Key加密存储、优先级管理等特性。

## 功能特性

### 核心功能

1. **多提供商支持**
   - 云服务：SiliconFlow、通义千问、智谱AI、OpenAI、Azure OpenAI、DeepSeek
   - 本地部署：Qwen3-32B、Ollama、Text Generation WebUI、LM Studio、vLLM、Xinference、FastChat
   - 自定义提供商

2. **配置管理**
   - 创建、更新、删除AI配置
   - 设置默认配置
   - 启用/禁用配置
   - 拖拽调整优先级

3. **安全特性**
   - API Key加密存储
   - API Key验证功能
   - 权限控制

4. **高级功能**
   - 多模型支持（对话模型 + Embedding模型）
   - 优先级排序（AI调用时按优先级尝试）
   - 配置验证

## 技术架构

### 后端

- **Service层**：`backend/service.ts`
  - AIConfigService：配置CRUD、加密解密、验证等
  - 使用MySQL存储配置数据
  - API Key使用AES加密

- **Routes层**：`backend/routes.ts`
  - 8个API端点
  - 权限验证
  - 错误处理

- **Types层**：`backend/types.ts`
  - TypeScript类型定义
  - 请求/响应接口

### 前端

- **Views**：`frontend/views/ConfigList.vue`
  - 配置列表展示
  - 拖拽排序
  - 配置表单
  - API Key验证

- **API**：`frontend/api/index.ts`
  - API调用封装
  - 类型安全

## API端点

### 配置管理

- `GET /api/ai/configs` - 获取所有配置
- `GET /api/ai/configs/:id` - 获取单个配置
- `POST /api/ai/configs` - 创建配置
- `PUT /api/ai/configs/:id` - 更新配置
- `DELETE /api/ai/configs/:id` - 删除配置
- `PUT /api/ai/configs/:id/default` - 设置默认配置
- `PUT /api/ai/configs/priorities` - 更新优先级
- `POST /api/ai/configs/validate` - 验证API Key

## 权限

- `ai:view` - 查看AI配置
- `ai:config` - 管理AI配置（创建、更新、删除）

## 数据库

### 表结构

```sql
CREATE TABLE sys_ai_configs (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  embedding_model VARCHAR(100),
  api_key TEXT,
  base_url VARCHAR(255),
  is_default BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'active',
  priority INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## 使用示例

### 创建配置

```typescript
import { aiConfigApi } from '@/modules/ai-config/frontend/api';

const config = await aiConfigApi.createConfig({
  name: 'SiliconFlow',
  provider: 'siliconflow',
  model: 'Qwen/Qwen3-32B',
  embeddingModel: 'BAAI/bge-large-zh-v1.5',
  apiKey: 'sk-xxx',
  baseUrl: 'https://api.siliconflow.cn/v1',
  isDefault: true,
  status: 'active'
});
```

### 验证API Key

```typescript
const result = await aiConfigApi.validateApiKey(
  'siliconflow',
  'sk-xxx',
  'https://api.siliconflow.cn/v1',
  undefined,
  'Qwen/Qwen3-32B'
);

if (result.data.valid) {
  console.log('API Key有效');
}
```

### 更新优先级

```typescript
await aiConfigApi.updatePriorities([
  { id: 'config-1', priority: 1 },
  { id: 'config-2', priority: 2 },
  { id: 'config-3', priority: 3 }
]);
```

## 生命周期钩子

模块实现了完整的生命周期钩子：

- `beforeInstall` - 检查数据库表
- `afterInstall` - 记录安装信息
- `beforeUninstall` - 警告数据影响
- `afterUninstall` - 清理完成
- `beforeEnable` - 准备启用
- `afterEnable` - 启用完成
- `beforeDisable` - 警告禁用影响
- `afterDisable` - 禁用完成

## 测试

运行测试：

```bash
npx vitest run tests/modules/ai-config/service.test.ts
```

## 依赖

- `uuid` - 生成唯一ID
- `mysql2` - 数据库连接
- `openai` - API Key验证
- `crypto` - API Key加密

## 注意事项

1. **API Key安全**
   - API Key在数据库中加密存储
   - 前端展示时只显示部分字符
   - 更新时空字符串表示不修改

2. **默认配置**
   - 系统只能有一个默认配置
   - 设置新默认时自动取消其他默认

3. **优先级**
   - AI调用时按优先级顺序尝试
   - 默认配置优先级最高
   - 支持拖拽调整

4. **配置验证**
   - 验证会实际调用AI API
   - 超时时间15秒
   - 支持多种错误类型识别

## 版本历史

- v1.0.0 - 初始版本
  - 基础配置管理
  - 多提供商支持
  - API Key加密
  - 优先级管理
  - 配置验证
