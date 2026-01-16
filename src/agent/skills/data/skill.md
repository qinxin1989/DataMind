# 数据处理技能 (Data Skills)

## 概述
数据处理技能用于对数据源进行查询、分析、清洗和转换操作。

## 技能列表

### 1. data.query - 数据查询
**描述**: 根据自然语言问题查询数据源
**参数**:
- `datasourceId` (string, required): 数据源ID
- `question` (string, required): 自然语言问题
- `limit` (number, optional): 返回行数限制，默认20

**返回**:
```json
{
  "success": true,
  "data": [...],
  "sql": "SELECT ...",
  "rowCount": 10
}
```

### 2. data.analyze - 数据分析
**描述**: 对数据源进行综合分析，生成分析报告
**参数**:
- `datasourceId` (string, required): 数据源ID
- `topic` (string, required): 分析主题
- `depth` (string, optional): 分析深度 (quick/normal/deep)

**返回**:
```json
{
  "title": "分析报告标题",
  "steps": [...],
  "conclusion": "结论",
  "insights": ["发现1", "发现2"],
  "charts": [...]
}
```

### 3. data.summarize - 数据摘要
**描述**: 生成数据源的概要信息
**参数**:
- `datasourceId` (string, required): 数据源ID
- `tables` (string[], optional): 指定表名，默认全部

**返回**:
```json
{
  "tables": [
    { "name": "表名", "rowCount": 1000, "columns": 10 }
  ],
  "totalRows": 5000,
  "summary": "数据概要描述"
}
```

### 4. data.join - 关联查询
**描述**: 跨多个表进行关联查询
**参数**:
- `datasourceId` (string, required): 数据源ID
- `tables` (string[], required): 要关联的表名
- `joinFields` (object, required): 关联字段映射
- `selectFields` (string[], optional): 选择的字段

**返回**:
```json
{
  "success": true,
  "data": [...],
  "sql": "SELECT ... JOIN ...",
  "rowCount": 100
}
```

### 5. data.clean - 数据清洗
**描述**: 检测并清洗数据质量问题
**参数**:
- `datasourceId` (string, required): 数据源ID
- `table` (string, required): 表名
- `rules` (object[], optional): 清洗规则

**返回**:
```json
{
  "issues": [
    { "type": "null_value", "field": "name", "count": 10 },
    { "type": "duplicate", "count": 5 }
  ],
  "suggestions": ["建议1", "建议2"]
}
```

## 使用示例

```typescript
// 查询数据
const result = await skillRegistry.execute('data.query', {
  datasourceId: 'ds-001',
  question: '查询销售额最高的10个产品'
});

// 分析数据
const report = await skillRegistry.execute('data.analyze', {
  datasourceId: 'ds-001',
  topic: '销售趋势分析',
  depth: 'normal'
});
```
