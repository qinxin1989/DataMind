# Task 2 实现总结：选择器验证API

## 完成时间
2025-01-31

## 任务描述
实现 POST /api/admin/ai/crawler/validate-selector 路由，用于验证CSS选择器是否有效并返回匹配元素数量。

## 实现内容

### 1. API端点实现
- **路由**: `POST /api/admin/ai/crawler/validate-selector`
- **位置**: `src/admin/modules/ai/routes.ts`
- **权限**: 需要 `ai:view` 权限

### 2. 功能特性

#### 请求参数
```typescript
{
  url: string,      // 目标网页URL
  selector: string  // CSS选择器
}
```

#### 响应格式
```typescript
{
  success: boolean,
  data: {
    valid: boolean,      // 选择器是否有效（是否匹配到元素）
    matchCount: number,  // 匹配到的元素数量
    message: string      // 描述性消息
  },
  timestamp: number
}
```

### 3. 错误处理

实现了完善的错误处理机制：

1. **参数验证**
   - 检查必需参数（url, selector）
   - 验证URL格式（必须以http://或https://开头）
   - 验证选择器不为空

2. **网络错误处理**
   - 超时错误（408）
   - 404错误（网页不存在）
   - 403错误（访问被拒绝）
   - 其他网络错误

3. **选择器语法错误**
   - 捕获cheerio解析错误
   - 返回具体的语法错误信息

### 4. 技术实现

#### 使用的库
- **axios**: 获取网页HTML内容
- **cheerio**: 解析HTML并验证CSS选择器

#### 关键代码逻辑
```typescript
// 1. 参数验证
if (!url || !selector) {
  return res.status(400).json(error('VALID_PARAM_MISSING', '缺少必要参数'));
}

// 2. 获取网页HTML
const response = await axios.get(url, {
  headers: { 'User-Agent': '...' },
  timeout: 15000,
  maxRedirects: 5
});

// 3. 使用cheerio验证选择器
const $ = cheerio.load(htmlContent);
const elements = $(selector);
const matchCount = elements.length;

// 4. 返回结果
res.json(success({
  valid: matchCount > 0,
  matchCount,
  message: matchCount > 0 ? `找到 ${matchCount} 个匹配元素` : '未找到匹配元素'
}));
```

### 5. 改进点

相比初始实现，增强了以下方面：

1. **更详细的参数验证**
   - URL格式验证
   - 选择器空值检查
   - 更清晰的错误消息

2. **更完善的错误处理**
   - 区分不同类型的网络错误
   - 捕获选择器语法错误
   - 提供具体的错误信息

3. **更长的超时时间**
   - 从10秒增加到15秒
   - 更好地处理慢速网站

4. **更好的日志记录**
   - 记录关键错误信息
   - 便于调试和问题排查

## 测试

创建了测试文件 `test-validate-selector-api.js`，包含以下测试场景：

1. ✓ 有效的选择器（匹配到元素）
2. ✓ 无效的选择器（不匹配任何元素）
3. ✓ 缺少参数
4. ✓ 无效的URL格式
5. ✓ 空选择器
6. ✓ 复杂的选择器

## 验证结果

- ✅ 代码编译成功（`npm run build`）
- ✅ TypeScript类型检查通过
- ✅ 满足需求 7.1（实时验证选择器）
- ✅ 满足需求 7.2（显示匹配元素数量）

## 使用示例

### 前端调用示例
```typescript
const response = await axios.post('/api/admin/ai/crawler/validate-selector', {
  url: 'https://example.com',
  selector: 'h1.title'
});

if (response.data.success) {
  const { valid, matchCount, message } = response.data.data;
  console.log(`选择器${valid ? '有效' : '无效'}: ${message}`);
}
```

### 响应示例
```json
{
  "success": true,
  "data": {
    "valid": true,
    "matchCount": 3,
    "message": "找到 3 个匹配元素"
  },
  "timestamp": 1706745600000
}
```

## 下一步

任务2.1已完成。可以继续执行：
- 任务2.2: 编写选择器验证单元测试（可选）
- 任务3: 增强数据预览API

## 相关文件

- `src/admin/modules/ai/routes.ts` - API路由实现
- `test-validate-selector-api.js` - 手动测试脚本
- `.kiro/specs/crawler-template-enhancement/requirements.md` - 需求文档
- `.kiro/specs/crawler-template-enhancement/design.md` - 设计文档
