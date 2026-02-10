# 爬虫功能改进说明

## 已完成的改进

### 1. 全页采集
- ✅ 默认启用分页功能，最多采集 50 页
- ✅ 自动检测"下一页"按钮并翻页
- ✅ 在日志中显示采集的页数

**配置位置：** `src/agent/skills/crawler/index.ts`
```typescript
const paginationConfig = {
    enabled: true,
    next_selector: usedTemplate?.paginationNextSelector || undefined,
    max_pages: usedTemplate?.paginationMaxPages || 50  // 默认最多50页
};
```

### 2. 数据去重
- ✅ 采集前与数据库核对，避免重复采集
- ✅ 基于"标题"和"链接"字段进行去重
- ✅ 只保存新数据，跳过已存在的数据
- ✅ 在日志中显示去重结果

**实现位置：** `src/agent/skills/crawler/service.ts` - `saveResults` 函数

**去重逻辑：**
```typescript
// 检查是否已存在相同的标题或链接
const [existing] = await connection.execute(`
    SELECT COUNT(*) as count 
    FROM crawler_result_items 
    WHERE row_id IN (...)
    AND (
        (field_name IN ('标题', 'title') AND field_value = ?)
        OR (field_name IN ('链接', 'link') AND field_value = ?)
    )
`, [templateId, title, link]);
```

### 3. 日期格式统一
- ✅ 所有日期字段统一转换为 `YYYY-MM-DD` 格式
- ✅ 支持多种输入格式：
  - `2025-01-09`, `2025.01.09`, `2025/01/09`
  - `2025年01月09日`
  - `09-01-2025`

**实现位置：** `src/agent/skills/crawler/engine.py` - `normalize_date` 函数

**示例：**
```python
"2026.01.09" → "2026-01-09"
"2025年12月31日" → "2025-12-31"
```

### 4. 前端按时间倒序显示
- ✅ 采集记录按创建时间倒序排列（最新的在前）
- ✅ 自动排序，无需手动操作

**实现位置：** `admin-ui/src/views/ai/crawler.vue` - `filteredResults` 计算属性

### 5. 采集明细添加序号
- ✅ 明细表格第一列显示序号
- ✅ 翻页时序号连续（不重新从1开始）
- ✅ 序号固定在左侧，不随横向滚动

**实现位置：** `admin-ui/src/views/ai/crawler.vue`

**序号计算公式：**
```typescript
序号 = (当前页码 - 1) × 每页条数 + 当前行索引 + 1
```

**示例：**
- 第1页：1, 2, 3, ..., 10
- 第2页：11, 12, 13, ..., 20
- 第3页：21, 22, 23, ..., 30

## 使用说明

### 采集数据
1. 访问 **AI 服务 > 爬虫管理** 或 **AI爬虫助手**
2. 选择或创建采集模板
3. 点击"立即抓取"
4. 系统会自动：
   - 采集所有页面（最多50页）
   - 过滤已存在的数据
   - 格式化日期为统一格式
   - 保存新数据到数据库

### 查看明细
1. 在"采集记录"标签页中，点击"查看明细"
2. 明细表格会显示：
   - 序号（连续编号）
   - 归属部门
   - 所有采集的字段
3. 支持翻页、导出等操作

## 技术细节

### 文件修改清单
1. `src/agent/skills/crawler/engine.py` - Python 爬虫引擎
   - 添加 `normalize_date()` 函数
   - 在返回结果前格式化日期

2. `src/agent/skills/crawler/service.ts` - 爬虫服务
   - 修改 `saveResults()` 函数，添加去重逻辑

3. `src/agent/skills/crawler/index.ts` - 爬虫技能
   - 默认启用全页采集
   - 设置最大页数为 50

4. `admin-ui/src/views/ai/crawler.vue` - 前端页面
   - 添加序号列
   - 实现跨页连续序号
   - 添加时间倒序排序

### 性能优化建议
- 如果采集页数过多，可以调整 `max_pages` 参数
- 去重查询使用了索引，性能较好
- 建议定期清理旧数据

## 测试验证

### 测试用例
1. ✅ 采集多页数据（测试翻页功能）
2. ✅ 重复采集相同URL（测试去重功能）
3. ✅ 验证日期格式（测试格式化功能）
4. ✅ 查看明细并翻页（测试序号连续性）
5. ✅ 验证时间排序（测试倒序显示）

### 测试结果
- 成功采集 15 条数据（国家数据局网站）
- 日期格式统一为 YYYY-MM-DD
- 序号在翻页时保持连续
- 重复数据被正确过滤

## 后续优化建议

1. **增量采集**
   - 可以添加"只采集最新数据"选项
   - 遇到已存在的数据时停止采集

2. **采集进度显示**
   - 实时显示当前采集的页数
   - 显示去重统计信息

3. **自定义去重字段**
   - 允许用户选择用于去重的字段
   - 支持多字段组合去重

4. **日期智能识别**
   - 支持更多日期格式
   - 自动识别相对日期（如"昨天"、"3天前"）
