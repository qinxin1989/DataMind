# 效率工具模块

提供 SQL 格式化、数据转换、正则助手等开发效率工具，帮助开发者提高工作效率。

## 功能特性

### 1. SQL 格式化
- 支持多种 SQL 方言（MySQL、PostgreSQL、SQLite、标准 SQL）
- 自动美化和规范 SQL 语句
- 支持关键字大写选项
- 自定义缩进格式

### 2. 数据转换
- 支持多种数据格式互转：
  - JSON ↔ CSV
  - JSON ↔ Excel
  - JSON ↔ XML
  - JSON ↔ YAML
  - CSV ↔ Excel
- 美化输出选项
- 自定义分隔符

### 3. 正则助手
- 可视化正则表达式测试
- 实时匹配结果展示
- 支持全局匹配、忽略大小写、多行模式
- 显示匹配位置和分组信息

### 4. 模板管理
- 保存常用的 SQL、正则、代码片段
- 按类型分类管理
- 支持标签和搜索
- 快速复用模板

## 安装

模块会自动创建以下数据表：

- `efficiency_templates`: 用户模板表

## API 接口

### SQL 格式化

```typescript
POST /api/modules/efficiency-tools/sql/format

Request:
{
  "sql": "select * from users where id=1",
  "language": "mysql",
  "uppercase": false,
  "indent": "  ",
  "linesBetweenQueries": 1
}

Response:
{
  "success": true,
  "formatted": "SELECT\n  *\nFROM\n  users\nWHERE\n  id = 1"
}
```

### 数据转换

```typescript
POST /api/modules/efficiency-tools/data/convert

Request:
{
  "data": "{\"name\":\"John\",\"age\":30}",
  "sourceFormat": "json",
  "targetFormat": "csv",
  "options": {
    "pretty": true,
    "headers": true
  }
}

Response:
{
  "success": true,
  "converted": "name,age\nJohn,30"
}
```

### 正则测试

```typescript
POST /api/modules/efficiency-tools/regex/test

Request:
{
  "pattern": "\\d{3}-\\d{4}",
  "text": "电话: 123-4567 和 890-1234",
  "flags": "g"
}

Response:
{
  "success": true,
  "matches": [
    {
      "match": "123-4567",
      "index": 4,
      "groups": []
    },
    {
      "match": "890-1234",
      "index": 15,
      "groups": []
    }
  ]
}
```

### 模板管理

#### 创建模板

```typescript
POST /api/modules/efficiency-tools/templates

Request:
{
  "type": "sql",
  "name": "查询用户",
  "content": "SELECT * FROM users WHERE id = ?",
  "description": "根据ID查询用户",
  "tags": ["sql", "user"]
}

Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "user-id",
    "type": "sql",
    "name": "查询用户",
    "content": "SELECT * FROM users WHERE id = ?",
    "description": "根据ID查询用户",
    "tags": ["sql", "user"],
    "createdAt": 1234567890,
    "updatedAt": 1234567890
  }
}
```

#### 更新模板

```typescript
PUT /api/modules/efficiency-tools/templates/:id

Request:
{
  "name": "更新后的名称",
  "content": "更新后的内容"
}

Response:
{
  "success": true,
  "message": "更新成功"
}
```

#### 删除模板

```typescript
DELETE /api/modules/efficiency-tools/templates/:id

Response:
{
  "success": true,
  "message": "删除成功"
}
```

#### 获取模板

```typescript
GET /api/modules/efficiency-tools/templates/:id

Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "user-id",
    "type": "sql",
    "name": "查询用户",
    "content": "SELECT * FROM users WHERE id = ?",
    "description": "根据ID查询用户",
    "tags": ["sql", "user"],
    "createdAt": 1234567890,
    "updatedAt": 1234567890
  }
}
```

#### 查询模板

```typescript
GET /api/modules/efficiency-tools/templates?page=1&pageSize=20&type=sql&keyword=用户

Response:
{
  "success": true,
  "data": {
    "total": 10,
    "page": 1,
    "pageSize": 20,
    "items": [...]
  }
}
```

## 前端使用

### 导入 API

```typescript
import {
  formatSql,
  convertData,
  testRegex,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getTemplate,
  queryTemplates
} from '@/modules/efficiency-tools/frontend/api';
```

### SQL 格式化示例

```typescript
const result = await formatSql({
  sql: 'select * from users',
  language: 'mysql',
  uppercase: true
});

if (result.success) {
  console.log(result.formatted);
}
```

### 数据转换示例

```typescript
const result = await convertData({
  data: JSON.stringify({ name: 'John', age: 30 }),
  sourceFormat: 'json',
  targetFormat: 'csv',
  options: { pretty: true }
});

if (result.success) {
  console.log(result.converted);
}
```

### 正则测试示例

```typescript
const result = await testRegex({
  pattern: '\\d+',
  text: 'abc 123 def 456',
  flags: 'g'
});

if (result.success) {
  console.log(`找到 ${result.matches?.length} 个匹配`);
}
```

## 配置选项

```json
{
  "enableSqlFormatter": true,
  "enableDataConverter": true,
  "enableRegexHelper": true,
  "enableTemplates": true,
  "maxInputSize": 10485760,
  "defaultSqlLanguage": "mysql",
  "defaultIndent": "  "
}
```

### 配置说明

- `enableSqlFormatter`: 是否启用 SQL 格式化功能
- `enableDataConverter`: 是否启用数据转换功能
- `enableRegexHelper`: 是否启用正则助手功能
- `enableTemplates`: 是否启用模板管理功能
- `maxInputSize`: 最大输入内容大小（字节），默认 10MB
- `defaultSqlLanguage`: SQL 格式化的默认语言
- `defaultIndent`: SQL 格式化的默认缩进

## 权限控制

模块定义了以下权限：

- `efficiency-tools:view`: 查看效率工具页面
- `efficiency-tools:sql-format`: 使用 SQL 格式化功能
- `efficiency-tools:data-convert`: 使用数据转换功能
- `efficiency-tools:regex`: 使用正则助手功能
- `efficiency-tools:template`: 管理模板

## 数据库表结构

### efficiency_templates

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(36) | 主键 |
| user_id | VARCHAR(36) | 用户ID |
| type | VARCHAR(20) | 模板类型 |
| name | VARCHAR(100) | 模板名称 |
| content | TEXT | 模板内容 |
| description | TEXT | 描述 |
| tags | TEXT | 标签（JSON） |
| created_at | BIGINT | 创建时间 |
| updated_at | BIGINT | 更新时间 |

## 生命周期钩子

模块实现了完整的生命周期钩子：

- `beforeInstall`: 安装前检查依赖
- `afterInstall`: 安装后初始化
- `beforeEnable`: 启用前准备
- `afterEnable`: 启用后通知
- `beforeDisable`: 禁用前清理
- `afterDisable`: 禁用后保留数据
- `beforeUninstall`: 卸载前警告
- `afterUninstall`: 卸载后清理数据表

## 依赖

- `sql-formatter`: SQL 格式化库
- `xlsx`: Excel 处理库

## 使用场景

1. **SQL 开发**: 快速格式化和美化 SQL 语句
2. **数据处理**: 在不同数据格式之间快速转换
3. **正则调试**: 可视化测试正则表达式
4. **代码复用**: 保存和管理常用代码片段

## 注意事项

1. 输入内容大小限制为配置的 `maxInputSize`
2. Excel 转换结果以 base64 格式返回
3. 模板数据与用户关联，仅用户本人可见
4. 卸载模块会删除所有模板数据

## 版本历史

### v1.0.0
- 初始版本
- 实现 SQL 格式化功能
- 实现数据转换功能
- 实现正则助手功能
- 实现模板管理功能

## 许可证

MIT
