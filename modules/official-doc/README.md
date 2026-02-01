# 公文写作模块 (official-doc)

## 概述

公文写作模块提供 AI 辅助的公文写作功能，支持工作报告、通知公告、会议纪要、计划方案等多种公文类型，帮助用户快速生成规范的公文内容。

## 功能特性

### 1. 公文生成
- 支持 4 种公文类型：
  - 工作报告
  - 通知公告
  - 会议纪要
  - 计划方案
- 支持 3 种文风：
  - 严谨正式
  - 简明扼要
  - 热情洋溢
- AI 智能生成，自动降级到模板生成
- 实时生成，快速响应

### 2. 模板管理
- 创建自定义模板
- 模板分类管理
- 支持系统模板和用户模板
- 模板公开/私有设置
- 模板搜索和过滤

### 3. 历史记录
- 自动保存生成历史
- 查看历史记录
- 重用历史内容
- 删除历史记录
- 自动清理过期历史

### 4. 导出功能
- 复制到剪贴板
- 保存为模板
- 支持 Word/PDF 导出（规划中）

## 安装

模块会自动创建以下数据表：

- `official_doc_templates`: 公文模板表
- `official_doc_history`: 生成历史表

## 配置

模块配置文件位于 `config/default.json`:

```json
{
  "enableAI": true,
  "aiModel": "gpt-3.5-turbo",
  "maxPointsLength": 5000,
  "maxHistoryDays": 90,
  "enableExport": true,
  "enableTemplates": true
}
```

### 配置说明

- `enableAI`: 是否启用 AI 生成功能
- `aiModel`: AI 模型名称
- `maxPointsLength`: 核心要点最大长度（字符）
- `maxHistoryDays`: 历史记录保留天数
- `enableExport`: 是否启用导出功能
- `enableTemplates`: 是否启用模板功能

## API 接口

### 1. 生成公文

**POST** `/api/modules/official-doc/generate`

请求参数:
```json
{
  "type": "report",
  "style": "formal",
  "points": "核心要点内容...",
  "templateId": "可选的模板ID"
}
```

响应:
```json
{
  "success": true,
  "content": "生成的公文内容...",
  "historyId": "uuid"
}
```

### 2. 创建模板

**POST** `/api/modules/official-doc/templates`

请求参数:
```json
{
  "name": "模板名称",
  "type": "report",
  "content": "模板内容，使用 {{points}} 表示要点位置",
  "style": "formal",
  "description": "模板描述",
  "isPublic": false
}
```

响应:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "模板名称",
    ...
  }
}
```

### 3. 更新模板

**PUT** `/api/modules/official-doc/templates/:id`

请求参数:
```json
{
  "name": "更新后的名称",
  "content": "更新后的内容"
}
```

### 4. 删除模板

**DELETE** `/api/modules/official-doc/templates/:id`

### 5. 获取模板

**GET** `/api/modules/official-doc/templates/:id`

### 6. 查询模板

**GET** `/api/modules/official-doc/templates`

查询参数:
- `page`: 页码（默认: 1）
- `pageSize`: 每页数量（默认: 20）
- `type`: 公文类型过滤
- `isSystem`: 是否系统模板
- `isPublic`: 是否公开模板
- `keyword`: 关键字搜索

### 7. 获取历史记录

**GET** `/api/modules/official-doc/history`

查询参数:
- `page`: 页码（默认: 1）
- `pageSize`: 每页数量（默认: 20）
- `type`: 公文类型过滤
- `status`: 状态过滤
- `startDate`: 开始时间（时间戳）
- `endDate`: 结束时间（时间戳）

### 8. 删除历史记录

**DELETE** `/api/modules/official-doc/history/:id`

### 9. 清理过期历史（管理员）

**POST** `/api/modules/official-doc/cleanup`

## 数据库表

### official_doc_templates

公文模板表:

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(36) | 主键 |
| user_id | VARCHAR(36) | 用户ID（系统模板为NULL） |
| name | VARCHAR(100) | 模板名称 |
| type | VARCHAR(20) | 公文类型 |
| content | TEXT | 模板内容 |
| style | VARCHAR(20) | 文风 |
| is_system | TINYINT | 是否系统模板 |
| is_public | TINYINT | 是否公开 |
| description | TEXT | 描述 |
| created_at | BIGINT | 创建时间 |
| updated_at | BIGINT | 更新时间 |

### official_doc_history

生成历史表:

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(36) | 主键 |
| user_id | VARCHAR(36) | 用户ID |
| template_id | VARCHAR(36) | 模板ID（可选） |
| type | VARCHAR(20) | 公文类型 |
| style | VARCHAR(20) | 文风 |
| points | TEXT | 核心要点 |
| result | TEXT | 生成结果 |
| status | VARCHAR(20) | 状态 |
| error_message | TEXT | 错误信息 |
| created_at | BIGINT | 创建时间 |

## 权限

模块定义了以下权限:

- `official-doc:view` - 查看公文写作页面
- `official-doc:generate` - 生成公文
- `official-doc:template` - 管理模板
- `official-doc:history` - 查看历史
- `official-doc:export` - 导出公文

## 生命周期钩子

模块实现了完整的生命周期钩子:

- `beforeInstall` - 安装前检查依赖
- `afterInstall` - 安装后创建表和初始化数据
- `beforeEnable` - 启用前检查数据库
- `afterEnable` - 启用后初始化服务
- `beforeDisable` - 禁用前检查正在进行的任务
- `afterDisable` - 禁用后保留数据
- `beforeUninstall` - 卸载前警告数据删除
- `afterUninstall` - 卸载后删除表

## 前端使用

### 导入 API

```typescript
import {
  generateDoc,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getTemplate,
  queryTemplates,
  getHistory,
  deleteHistory
} from '@/modules/official-doc/frontend/api';
```

### 生成公文示例

```typescript
const result = await generateDoc({
  type: 'report',
  style: 'formal',
  points: '本月完成了以下工作...'
});

if (result.success) {
  console.log(result.content);
}
```

### 创建模板示例

```typescript
const template = await createTemplate({
  name: '月度报告模板',
  type: 'report',
  content: '月度工作报告\n\n{{points}}\n\n总结：...',
  style: 'formal',
  description: '用于月度工作汇报',
  isPublic: false
});
```

### 查询历史示例

```typescript
const history = await getHistory({
  userId: 'current-user-id',
  page: 1,
  pageSize: 20,
  type: 'report'
});

console.log(`共 ${history.data.total} 条记录`);
```

## 后端使用

```typescript
import { OfficialDocService } from './modules/official-doc/backend/service';

const service = new OfficialDocService(db, {
  enableAI: true,
  maxPointsLength: 5000
});

// 设置 AI 服务
service.setAIConfigService(aiConfigService);

// 生成公文
const result = await service.generateDoc({
  type: 'report',
  style: 'formal',
  points: '核心要点...'
}, userId);
```

## AI 集成

模块支持与 AI 配置服务集成：

1. 通过 `setAIConfigService` 方法设置 AI 服务
2. AI 服务需要实现 `generate` 方法
3. 如果 AI 生成失败，自动降级到模板生成
4. 可通过配置禁用 AI 功能

## 模板变量

模板内容支持以下变量：

- `{{points}}` - 核心要点
- `{{date}}` - 当前日期
- `{{time}}` - 当前时间

## 使用场景

1. **日常办公**: 快速生成工作报告、通知公告
2. **会议管理**: 自动生成会议纪要
3. **项目管理**: 生成项目计划和方案
4. **行政管理**: 规范化公文写作流程

## 故障排查

### 1. AI 生成失败

**问题**: AI 生成失败，返回模板内容  
**解决**:
- 检查 AI 配置服务是否正确设置
- 检查 AI 服务是否可用
- 查看错误日志获取详细信息
- 确认 `enableAI` 配置为 true

### 2. 模板不显示

**问题**: 自定义模板列表为空  
**解决**:
- 检查 `enableTemplates` 配置是否为 true
- 检查数据库表是否正确创建
- 检查用户权限
- 确认模板是否属于当前用户或公开

### 3. 历史记录丢失

**问题**: 历史记录突然消失  
**解决**:
- 检查 `maxHistoryDays` 配置
- 确认是否执行了清理任务
- 检查数据库表是否完整

## 性能优化

1. **历史清理**: 定期清理过期历史记录
2. **模板缓存**: 缓存常用系统模板
3. **异步生成**: 大批量生成使用异步队列
4. **分页加载**: 历史和模板列表使用分页

## 安全注意事项

1. **权限控制**: 严格的权限检查
2. **输入验证**: 验证输入长度和格式
3. **SQL 注入防护**: 使用参数化查询
4. **XSS 防护**: 前端输出转义
5. **数据隔离**: 用户数据严格隔离

## 更新日志

### v1.0.0 (2026-02-01)
- 初始版本
- 支持 4 种公文类型
- 支持 3 种文风
- AI 智能生成
- 模板管理功能
- 历史记录功能
- 完整的生命周期钩子
- 完整的测试覆盖

## 许可证

MIT

## 作者

System

## 支持

如有问题，请联系系统管理员或查看文档。
