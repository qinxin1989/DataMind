# AI统计模块

AI使用统计、对话历史管理和用户统计功能模块。

## 功能特性

### 1. 对话记录管理
- 记录AI对话历史
- 查询对话记录（支持多条件过滤）
- 删除对话记录
- 分页查询

### 2. 使用统计
- 总请求数和Token使用量统计
- 按天统计请求和Token
- Top用户排行
- 按模型统计
- 按用户+模型统计
- 按天+模型统计
- 成本估算

### 3. 用户统计
- 用户总请求数
- 用户总Token使用量
- 平均响应时间

## API端点

### 统计相关
- `GET /ai/stats` - 获取使用统计
- `GET /ai/stats/user/:userId` - 获取用户统计

### 对话历史
- `GET /ai/conversations` - 查询对话历史
- `GET /ai/conversations/:userId/:id` - 获取单个对话
- `DELETE /ai/conversations/:userId/:id` - 删除对话

## 配置项

```json
{
  "statsRetentionDays": 90,           // 统计数据保留天数
  "conversationRetentionDays": 180,   // 对话历史保留天数
  "defaultPageSize": 20,              // 默认分页大小
  "costPerThousandTokens": 0.002,     // 每千Token成本（美元）
  "enableAutoCleanup": true,          // 启用自动清理
  "topUsersLimit": 10                 // Top用户数量
}
```

## 数据库表

- `sys_chat_history` - 对话历史表

## 权限要求

- `ai:view` - 查看AI统计和对话历史
- `ai:config` - 删除对话记录

## 使用示例

### 获取使用统计

```typescript
// 获取最近30天的统计
const stats = await aiStatsService.getUsageStats(
  Date.now() - 30 * 24 * 60 * 60 * 1000,
  Date.now()
);

console.log('总请求数:', stats.totalRequests);
console.log('总Token数:', stats.totalTokens);
console.log('估算成本:', stats.estimatedCost);
console.log('Top用户:', stats.topUsers);
```

### 记录对话

```typescript
const conversation = await aiStatsService.recordConversation({
  userId: 'user-123',
  username: 'John',
  datasourceId: 'ds-456',
  datasourceName: 'Sales DB',
  question: 'What are the top products?',
  answer: 'The top products are...',
  sqlQuery: 'SELECT * FROM products ORDER BY sales DESC LIMIT 10',
  tokensUsed: 150,
  responseTime: 800,
  status: 'success'
});
```

### 查询对话历史

```typescript
const result = await aiStatsService.queryConversations({
  userId: 'user-123',
  keyword: 'sales',
  startTime: Date.now() - 7 * 24 * 60 * 60 * 1000,
  endTime: Date.now(),
  page: 1,
  pageSize: 20
});

console.log('总数:', result.total);
console.log('对话列表:', result.list);
```

### 获取用户统计

```typescript
const userStats = await aiStatsService.getUserStats(
  'user-123',
  Date.now() - 30 * 24 * 60 * 60 * 1000,
  Date.now()
);

console.log('用户请求数:', userStats.totalRequests);
console.log('用户Token数:', userStats.totalTokens);
console.log('平均响应时间:', userStats.avgResponseTime);
```

## 依赖

- `uuid` - 生成唯一ID
- `mysql2` - 数据库连接

## 生命周期钩子

模块实现了完整的8个生命周期钩子：
- `beforeInstall` - 安装前
- `afterInstall` - 安装后
- `beforeUninstall` - 卸载前
- `afterUninstall` - 卸载后
- `beforeEnable` - 启用前
- `afterEnable` - 启用后
- `beforeDisable` - 禁用前
- `afterDisable` - 禁用后

## 测试

运行测试：
```bash
npx vitest run tests/modules/ai-stats/service.test.ts
```

## 版本历史

- v1.0.0 - 初始版本
  - 对话记录管理
  - 使用统计
  - 用户统计
