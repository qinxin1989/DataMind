# 爬虫管理模块

## 概述

爬虫管理模块提供网页数据抓取的完整管理功能，包括模板管理、定时任务管理和采集结果管理。

## 功能特性

### 1. 模板管理
- ✅ 创建和保存爬虫模板
- ✅ 查看模板列表
- ✅ 删除模板
- ✅ 模板包含容器选择器和字段选择器
- ✅ 支持分页配置

### 2. 定时任务管理
- ✅ 查看定时任务列表
- ✅ 启动/暂停任务
- ✅ 手动执行任务
- ✅ 支持多种执行频率（每分钟、每小时、每天）

### 3. 采集结果管理
- ✅ 查看采集记录列表
- ✅ 查看采集明细数据
- ✅ 删除采集记录
- ✅ 导出采集数据（Excel）
- ✅ 按部门和数据类型筛选

### 4. 技能执行
- ✅ 手动执行爬虫技能
- ✅ 支持使用模板或自动分析
- ✅ 实时返回采集结果

## 技术架构

### 后端服务
- **service.ts**: 核心业务逻辑
  - 模板CRUD操作
  - 任务管理
  - 结果管理
  - 技能执行
  
- **routes.ts**: API路由定义
  - 9个RESTful API端点
  
- **types.ts**: TypeScript类型定义
  - 模板、任务、结果类型
  - 请求/响应类型

### 数据库表
- **crawler_templates**: 爬虫模板
- **crawler_template_fields**: 模板字段
- **crawler_tasks**: 定时任务
- **crawler_results**: 采集结果批次
- **crawler_result_rows**: 采集结果行
- **crawler_result_items**: 采集结果字段值（EAV模型）

### 前端组件
- **views/CrawlerList.vue**: 爬虫管理主页面
  - 模板列表
  - 任务列表
  - 结果列表
  - 明细查看

## API端点

### 模板管理
- `GET /api/skills/crawler/templates` - 获取模板列表
- `POST /api/skills/crawler/templates` - 保存模板
- `DELETE /api/skills/crawler/templates/:id` - 删除模板

### 任务管理
- `GET /api/skills/crawler/tasks` - 获取任务列表
- `POST /api/skills/crawler/tasks/:id/toggle` - 切换任务状态

### 结果管理
- `GET /api/skills/crawler/results` - 获取结果列表
- `GET /api/skills/crawler/results/:id` - 获取结果详情
- `DELETE /api/skills/crawler/results/:id` - 删除结果

### 技能执行
- `POST /api/skills/execute` - 执行爬虫技能

## 依赖关系

### 模块依赖
无直接模块依赖

### 外部依赖
- **Python环境**: 爬虫引擎需要Python运行时
- **数据库**: MySQL 5.7+
- **Node.js**: 14+

## 配置选项

### pythonPath
- 类型: `string`
- 默认值: `""`
- 说明: Python解释器路径

### maxConcurrentTasks
- 类型: `number`
- 默认值: `3`
- 范围: `1-10`
- 说明: 最大并发任务数

### taskTimeout
- 类型: `number`
- 默认值: `300000` (5分钟)
- 最小值: `10000`
- 说明: 任务超时时间（毫秒）

### resultRetentionDays
- 类型: `number`
- 默认值: `30`
- 最小值: `1`
- 说明: 结果保留天数

### enableAutoCleanup
- 类型: `boolean`
- 默认值: `true`
- 说明: 是否启用自动清理

## 使用示例

### 1. 创建爬虫模板
```typescript
const template = {
  name: "政府公告采集",
  url: "https://example.gov.cn/notices",
  department: "办公室",
  dataType: "公告",
  selectors: {
    container: ".notice-list .item",
    fields: {
      "标题": ".title",
      "日期": ".date",
      "链接": "a@href"
    }
  },
  paginationEnabled: true,
  paginationNextSelector: ".pagination .next",
  paginationMaxPages: 10
};

const response = await fetch('/api/skills/crawler/templates', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(template)
});
```

### 2. 执行爬虫任务
```typescript
const result = await fetch('/api/skills/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    skill: 'crawler.extract',
    params: {
      url: 'https://example.gov.cn/notices',
      templateId: 'template-id-here'
    }
  })
});
```

### 3. 查看采集结果
```typescript
// 获取结果列表
const results = await fetch('/api/skills/crawler/results');

// 获取结果详情
const details = await fetch('/api/skills/crawler/results/result-id-here');
```

## 生命周期钩子

### beforeInstall
- 检查数据库表是否存在
- 验证必要的依赖

### afterInstall
- 输出安装成功信息

### beforeUninstall
- 检查模块依赖关系

### afterUninstall
- 提示用户数据已保留

### beforeEnable
- 检查Python环境
- 验证配置

### afterEnable
- 注册API路由
- 输出路由信息

### beforeDisable
- 检查活动任务
- 警告用户影响

### afterDisable
- 移除路由
- 清理资源

## 技术亮点

### 1. EAV数据模型
使用Entity-Attribute-Value模型存储采集结果，支持动态字段：
- 灵活的数据结构
- 无需预定义字段
- 支持任意字段组合

### 2. 权限控制
- 用户隔离：每个用户只能访问自己的数据
- 操作权限：查看、管理、执行三级权限
- 安全验证：所有操作都进行权限检查

### 3. 分页支持
- 自动翻页采集
- 可配置最大页数
- 支持自定义下一页选择器

### 4. 数据导出
- 支持Excel导出
- 跨分页全选
- 保留归属部门信息

### 5. 筛选功能
- 按部门筛选
- 按数据类型筛选
- 实时过滤

## 注意事项

1. **Python环境**
   - 确保已安装Python 3.7+
   - 配置PYTHON_PATH环境变量
   - 安装必要的Python依赖包

2. **数据库性能**
   - EAV模型可能影响查询性能
   - 建议定期清理过期数据
   - 考虑添加适当的索引

3. **并发控制**
   - 避免同时执行过多任务
   - 合理配置maxConcurrentTasks
   - 监控系统资源使用

4. **数据安全**
   - 用户数据完全隔离
   - 删除操作不可恢复
   - 建议定期备份重要数据

5. **任务调度**
   - 定时任务需要单独的调度器
   - 当前版本仅支持手动执行
   - 未来版本将支持自动调度

## 开发指南

### 添加新的API端点
1. 在`service.ts`中添加业务逻辑
2. 在`routes.ts`中添加路由定义
3. 在`module.json`中声明路由
4. 更新类型定义

### 扩展数据模型
1. 修改数据库表结构
2. 更新类型定义
3. 修改service层的查询逻辑
4. 更新前端组件

### 添加新的配置项
1. 在`config/schema.json`中定义
2. 在service中读取配置
3. 在README中文档化

## 故障排查

### 问题1: 爬虫执行失败
- 检查Python环境是否正确配置
- 查看Python引擎日志
- 验证选择器是否正确

### 问题2: 数据无法保存
- 检查数据库连接
- 验证用户权限
- 查看错误日志

### 问题3: 任务无法启动
- 检查任务状态
- 验证模板是否存在
- 查看系统资源

## 更新日志

### v1.0.0 (2026-02-01)
- ✅ 初始版本发布
- ✅ 模板管理功能
- ✅ 任务管理功能
- ✅ 结果管理功能
- ✅ 技能执行功能
- ✅ 完整的生命周期钩子
- ✅ 完善的文档

## 许可证

MIT License

## 作者

System

## 贡献

欢迎提交Issue和Pull Request！
