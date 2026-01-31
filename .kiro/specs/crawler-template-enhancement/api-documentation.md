# 采集模板配置增强 - API文档

## 概述

本文档详细描述了采集模板配置增强功能的所有API接口。

**基础URL**: `/api/admin/ai/crawler`

**认证方式**: 需要管理员权限

---

## 接口列表

### 1. 选择器验证

验证CSS选择器是否有效，并返回匹配元素数量。

**接口地址**: `POST /validate-selector`

**请求头**:
```
Content-Type: application/json
Authorization: Bearer <token>
```

**请求参数**:
```typescript
{
  url: string      // 目标网页URL（必填）
  selector: string // CSS选择器（必填）
}
```

**请求示例**:
```json
{
  "url": "https://example.com/list",
  "selector": "ul.list > li"
}
```

**响应参数**:
```typescript
{
  success: boolean
  data: {
    valid: boolean      // 选择器是否有效
    matchCount: number  // 匹配元素数量
    message: string     // 验证消息
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "matchCount": 15,
    "message": "选择器有效，匹配到15个元素"
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "message": "无效的选择器语法"
}
```

**状态码**:
- `200` - 成功
- `400` - 请求参数错误
- `500` - 服务器错误

---

### 2. 数据预览

预览采集数据，返回指定数量的数据条目。

**接口地址**: `POST /preview`

**请求头**:
```
Content-Type: application/json
Authorization: Bearer <token>
```

**请求参数**:
```typescript
{
  url: string           // 目标网页URL（必填）
  selectors: {          // 选择器配置（必填）
    container: string   // 容器选择器
    fields: {           // 字段选择器映射
      [fieldName: string]: string
    }
  }
  limit?: number        // 返回数据条数限制（可选，默认10）
}
```

**请求示例**:
```json
{
  "url": "https://example.com/list",
  "selectors": {
    "container": "ul.list > li",
    "fields": {
      "标题": "h3.title",
      "链接": "a::attr(href)",
      "日期": "span.date"
    }
  },
  "limit": 10
}
```

**响应参数**:
```typescript
{
  success: boolean
  data: {
    data: Array<{       // 采集到的数据
      [fieldName: string]: string
    }>
    total: number       // 总数据条数
    limit: number       // 限制条数
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "标题": "示例标题1",
        "链接": "https://example.com/article/1",
        "日期": "2024-01-01"
      },
      {
        "标题": "示例标题2",
        "链接": "https://example.com/article/2",
        "日期": "2024-01-02"
      }
    ],
    "total": 15,
    "limit": 10
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "message": "无法访问目标URL"
}
```

**状态码**:
- `200` - 成功
- `400` - 请求参数错误
- `500` - 服务器错误

---

### 3. AI失败诊断

当采集失败时，使用AI分析失败原因并提供修复建议。

**接口地址**: `POST /diagnose`

**请求头**:
```
Content-Type: application/json
Authorization: Bearer <token>
```

**请求参数**:
```typescript
{
  url: string           // 目标网页URL（必填）
  selectors: {          // 选择器配置（必填）
    container: string
    fields: {
      [fieldName: string]: string
    }
  }
  error?: string        // 错误信息（可选）
}
```

**请求示例**:
```json
{
  "url": "https://example.com/list",
  "selectors": {
    "container": "ul.list > li",
    "fields": {
      "标题": "h3.title"
    }
  },
  "error": "未采集到数据"
}
```

**响应参数**:
```typescript
{
  success: boolean
  data: {
    reason: string              // 失败原因分析
    issues: string[]            // 具体问题列表
    suggestions: string[]       // 修复建议列表
    recommendedStrategy: {      // 推荐的采集策略
      waitForSelector?: string  // 等待选择器
      scrollToBottom?: boolean  // 是否滚动到底部
      waitTime?: number         // 等待时间（毫秒）
    }
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "reason": "网页使用JavaScript动态加载内容",
    "issues": [
      "容器选择器无法匹配任何元素",
      "网页可能需要等待JavaScript执行"
    ],
    "suggestions": [
      "使用更具体的选择器",
      "等待页面完全加载后再采集",
      "考虑使用无头浏览器"
    ],
    "recommendedStrategy": {
      "waitForSelector": "ul.list",
      "scrollToBottom": true,
      "waitTime": 2000
    }
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "message": "AI服务暂时不可用"
}
```

**状态码**:
- `200` - 成功
- `400` - 请求参数错误
- `500` - 服务器错误
- `503` - AI服务不可用

---

### 4. 模板测试

测试完整的采集模板配置，包括分页功能。

**接口地址**: `POST /test`

**请求头**:
```
Content-Type: application/json
Authorization: Bearer <token>
```

**请求参数**:
```typescript
{
  url: string           // 目标网页URL（必填）
  selectors: {          // 选择器配置（必填）
    container: string
    fields: {
      [fieldName: string]: string
    }
  }
  paginationConfig?: {  // 分页配置（可选）
    enabled: boolean    // 是否启用分页
    maxPages: number    // 最大页数
    nextPageSelector: string  // 下一页选择器
  }
}
```

**请求示例**:
```json
{
  "url": "https://example.com/list",
  "selectors": {
    "container": "ul.list > li",
    "fields": {
      "标题": "h3.title",
      "链接": "a::attr(href)"
    }
  },
  "paginationConfig": {
    "enabled": true,
    "maxPages": 3,
    "nextPageSelector": "a.next-page"
  }
}
```

**响应参数**:
```typescript
{
  success: boolean
  data: {
    success: boolean    // 测试是否成功
    data: Array<{       // 采集到的数据
      [fieldName: string]: string
    }>
    count: number       // 数据条数
    message: string     // 测试结果消息
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "data": [
      {
        "标题": "示例标题1",
        "链接": "https://example.com/article/1"
      }
    ],
    "count": 45,
    "message": "成功采集3页，共45条数据"
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "message": "采集失败：无法找到下一页按钮"
}
```

**状态码**:
- `200` - 成功
- `400` - 请求参数错误
- `500` - 服务器错误

---

### 5. AI智能分析

使用AI自动分析网页结构，推荐字段和选择器。

**接口地址**: `POST /analyze`

**请求头**:
```
Content-Type: application/json
Authorization: Bearer <token>
```

**请求参数**:
```typescript
{
  url: string           // 目标网页URL（必填）
  description?: string  // 网页描述（可选）
}
```

**请求示例**:
```json
{
  "url": "https://example.com/list",
  "description": "政策文件列表页"
}
```

**响应参数**:
```typescript
{
  success: boolean
  data: {
    fields: Array<{
      name: string        // 字段名称
      selector: string    // 推荐的选择器
      confidence: number  // 置信度（0-1之间）
    }>
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "fields": [
      {
        "name": "标题",
        "selector": "h3.article-title",
        "confidence": 0.95
      },
      {
        "name": "发布日期",
        "selector": "span.publish-date",
        "confidence": 0.88
      },
      {
        "name": "链接",
        "selector": "a.article-link::attr(href)",
        "confidence": 0.92
      }
    ]
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "message": "AI分析失败：无法识别网页结构"
}
```

**状态码**:
- `200` - 成功
- `400` - 请求参数错误
- `500` - 服务器错误
- `503` - AI服务不可用

---

### 6. 获取模板列表

获取所有采集模板的列表。

**接口地址**: `GET /templates`

**请求头**:
```
Authorization: Bearer <token>
```

**请求参数**: 无

**响应参数**:
```typescript
{
  success: boolean
  data: Array<{
    id: number
    name: string
    department: string
    data_type: string
    url: string
    container_selector: string
    fields: Array<{
      name: string
      selector: string
    }>
    pagination_enabled: boolean
    pagination_next_selector: string
    pagination_max_pages: number
    created_at: string
    updated_at: string
  }>
}
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "国家数据局政策文件",
      "department": "数据管理部",
      "data_type": "政策文件",
      "url": "https://example.com/list",
      "container_selector": "ul.list > li",
      "fields": [
        {
          "name": "标题",
          "selector": "h3.title"
        }
      ],
      "pagination_enabled": true,
      "pagination_next_selector": "a.next",
      "pagination_max_pages": 50,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**状态码**:
- `200` - 成功
- `401` - 未授权
- `500` - 服务器错误

---

### 7. 创建模板

创建新的采集模板。

**接口地址**: `POST /templates`

**请求头**:
```
Content-Type: application/json
Authorization: Bearer <token>
```

**请求参数**:
```typescript
{
  name: string                  // 模板名称（必填）
  department?: string           // 归属部门（可选）
  dataType?: string             // 数据类型（可选）
  url: string                   // 目标URL（必填）
  containerSelector: string     // 容器选择器（必填）
  fields: Array<{               // 字段配置（必填）
    name: string
    selector: string
  }>
  paginationEnabled?: boolean   // 是否启用分页（可选）
  paginationNextSelector?: string  // 下一页选择器（可选）
  paginationMaxPages?: number   // 最大页数（可选）
}
```

**请求示例**:
```json
{
  "name": "示例模板",
  "department": "数据管理部",
  "dataType": "政策文件",
  "url": "https://example.com/list",
  "containerSelector": "ul.list > li",
  "fields": [
    {
      "name": "标题",
      "selector": "h3.title"
    }
  ],
  "paginationEnabled": true,
  "paginationNextSelector": "a.next",
  "paginationMaxPages": 50
}
```

**响应参数**:
```typescript
{
  success: boolean
  data: {
    id: number
    // ... 其他字段同获取模板列表
  }
}
```

**状态码**:
- `201` - 创建成功
- `400` - 请求参数错误
- `401` - 未授权
- `500` - 服务器错误

---

### 8. 更新模板

更新现有的采集模板。

**接口地址**: `PUT /templates/:id`

**请求头**:
```
Content-Type: application/json
Authorization: Bearer <token>
```

**URL参数**:
- `id` - 模板ID

**请求参数**: 同创建模板

**响应参数**: 同创建模板

**状态码**:
- `200` - 更新成功
- `400` - 请求参数错误
- `401` - 未授权
- `404` - 模板不存在
- `500` - 服务器错误

---

### 9. 删除模板

删除指定的采集模板。

**接口地址**: `DELETE /templates/:id`

**请求头**:
```
Authorization: Bearer <token>
```

**URL参数**:
- `id` - 模板ID

**响应参数**:
```typescript
{
  success: boolean
  message: string
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "模板删除成功"
}
```

**状态码**:
- `200` - 删除成功
- `401` - 未授权
- `404` - 模板不存在
- `500` - 服务器错误

---

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | 未授权，需要登录 |
| 403 | 权限不足 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
| 503 | 服务暂时不可用（如AI服务） |

---

## 选择器语法说明

### 基本CSS选择器

- `element` - 元素选择器
- `.class` - 类选择器
- `#id` - ID选择器
- `element.class` - 组合选择器
- `element > child` - 直接子元素
- `element descendant` - 后代元素

### 特殊语法

- `::attr(属性名)` - 获取元素属性
  - 例如：`a::attr(href)` 获取链接地址
  - 例如：`img::attr(src)` 获取图片地址

- `::text` - 获取文本内容（默认行为）
  - 例如：`.title::text` 获取标题文本

### 示例

```
标题: h3.article-title
链接: a.article-link::attr(href)
图片: img.thumbnail::attr(src)
日期: span.publish-date::text
```

---

## 速率限制

- 每个IP每分钟最多100次请求
- AI相关接口每分钟最多10次请求
- 超过限制将返回429状态码

---

## 版本历史

### v1.0.0 (2024-01-01)
- 初始版本发布
- 支持基本的采集模板配置
- 支持AI智能分析和失败诊断
- 支持分页采集

---

## 联系方式

如有问题或建议，请联系API支持团队。
