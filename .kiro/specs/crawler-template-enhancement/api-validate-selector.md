# API文档：选择器验证接口

## 接口信息

- **接口名称**: 验证CSS选择器
- **接口路径**: `POST /api/admin/ai/crawler/validate-selector`
- **权限要求**: `ai:view`
- **实现位置**: `src/admin/modules/ai/routes.ts`

## 功能说明

验证给定的CSS选择器在指定网页上是否有效，并返回匹配到的元素数量。该接口用于实时验证用户输入的选择器，帮助用户快速调试和优化爬虫配置。

## 请求参数

### Body参数（JSON格式）

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| url | string | 是 | 目标网页的完整URL，必须以http://或https://开头 |
| selector | string | 是 | 要验证的CSS选择器，不能为空 |

### 请求示例

```json
{
  "url": "https://www.example.com",
  "selector": "div.content > h1"
}
```

## 响应格式

### 成功响应

```json
{
  "success": true,
  "data": {
    "valid": true,
    "matchCount": 5,
    "message": "找到 5 个匹配元素"
  },
  "timestamp": 1706745600000
}
```

### 响应字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 请求是否成功 |
| data.valid | boolean | 选择器是否有效（是否匹配到至少一个元素） |
| data.matchCount | number | 匹配到的元素数量 |
| data.message | string | 描述性消息 |
| timestamp | number | 响应时间戳 |

## 错误响应

### 1. 参数缺失（400）

```json
{
  "success": false,
  "error": {
    "code": "VALID_PARAM_MISSING",
    "message": "缺少必要参数：url 和 selector"
  },
  "timestamp": 1706745600000
}
```

### 2. URL格式错误（400）

```json
{
  "success": false,
  "error": {
    "code": "VALID_PARAM_INVALID",
    "message": "URL格式不正确，必须以http://或https://开头"
  },
  "timestamp": 1706745600000
}
```

### 3. 选择器为空（400）

```json
{
  "success": false,
  "error": {
    "code": "VALID_PARAM_INVALID",
    "message": "选择器不能为空"
  },
  "timestamp": 1706745600000
}
```

### 4. 选择器语法错误（400）

```json
{
  "success": false,
  "error": {
    "code": "INVALID_SELECTOR",
    "message": "选择器语法错误: Unexpected token..."
  },
  "timestamp": 1706745600000
}
```

### 5. 请求超时（408）

```json
{
  "success": false,
  "error": {
    "code": "TIMEOUT_ERROR",
    "message": "请求超时，请检查网址是否可访问"
  },
  "timestamp": 1706745600000
}
```

### 6. 网页不存在（404）

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "网页不存在（404）"
  },
  "timestamp": 1706745600000
}
```

### 7. 访问被拒绝（403）

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "网页拒绝访问（403）"
  },
  "timestamp": 1706745600000
}
```

### 8. 获取网页失败（500）

```json
{
  "success": false,
  "error": {
    "code": "FETCH_ERROR",
    "message": "获取网页失败: Connection refused"
  },
  "timestamp": 1706745600000
}
```

### 9. 系统错误（500）

```json
{
  "success": false,
  "error": {
    "code": "SYS_INTERNAL_ERROR",
    "message": "系统错误: ..."
  },
  "timestamp": 1706745600000
}
```

## 使用场景

### 场景1：实时验证用户输入的选择器

用户在配置爬虫模板时，输入选择器后，前端可以调用此接口实时验证选择器是否有效。

```typescript
// 防抖函数，避免频繁请求
const validateSelector = debounce(async (url: string, selector: string) => {
  try {
    const response = await axios.post('/api/admin/ai/crawler/validate-selector', {
      url,
      selector
    });
    
    if (response.data.success) {
      const { valid, matchCount, message } = response.data.data;
      
      if (valid) {
        showSuccess(`✓ ${message}`);
      } else {
        showWarning(`⚠ ${message}`);
      }
    }
  } catch (error) {
    showError('验证失败');
  }
}, 300);
```

### 场景2：批量验证多个选择器

在保存模板前，可以批量验证所有选择器是否有效。

```typescript
async function validateAllSelectors(url: string, selectors: Record<string, string>) {
  const results = await Promise.all(
    Object.entries(selectors).map(async ([field, selector]) => {
      const response = await axios.post('/api/admin/ai/crawler/validate-selector', {
        url,
        selector
      });
      
      return {
        field,
        selector,
        valid: response.data.data.valid,
        matchCount: response.data.data.matchCount
      };
    })
  );
  
  const invalidSelectors = results.filter(r => !r.valid);
  
  if (invalidSelectors.length > 0) {
    console.warn('以下选择器无效:', invalidSelectors);
  }
  
  return results;
}
```

### 场景3：选择器优化建议

根据匹配元素数量，给出优化建议。

```typescript
async function getSelectorSuggestion(url: string, selector: string) {
  const response = await axios.post('/api/admin/ai/crawler/validate-selector', {
    url,
    selector
  });
  
  const { valid, matchCount } = response.data.data;
  
  if (!valid) {
    return '选择器无效，请检查语法';
  }
  
  if (matchCount === 1) {
    return '✓ 选择器精确匹配一个元素';
  }
  
  if (matchCount > 100) {
    return `⚠ 匹配了 ${matchCount} 个元素，建议使用更精确的选择器`;
  }
  
  return `✓ 匹配了 ${matchCount} 个元素`;
}
```

## 技术实现

### 依赖库

- **axios**: 用于获取网页HTML内容
- **cheerio**: 用于解析HTML并验证CSS选择器

### 实现流程

1. **参数验证**
   - 检查url和selector参数是否存在
   - 验证URL格式
   - 验证选择器不为空

2. **获取网页内容**
   - 使用axios发送GET请求
   - 设置User-Agent模拟浏览器
   - 设置15秒超时
   - 最多重定向5次

3. **解析HTML**
   - 使用cheerio加载HTML
   - 执行CSS选择器查询
   - 统计匹配元素数量

4. **返回结果**
   - 返回验证结果和匹配数量
   - 提供描述性消息

### 性能考虑

- **超时设置**: 15秒超时，避免长时间等待
- **防抖建议**: 前端应使用防抖（300ms），避免频繁请求
- **缓存建议**: 可以考虑缓存相同URL的HTML内容（未实现）

## 注意事项

1. **跨域问题**: 该接口在服务端执行，不受浏览器同源策略限制
2. **性能影响**: 每次验证都会重新获取网页，建议前端使用防抖
3. **网络依赖**: 需要目标网站可访问，否则会返回错误
4. **选择器限制**: 仅支持标准CSS选择器，不支持XPath
5. **动态内容**: 对于JavaScript动态生成的内容，可能无法正确验证

## 相关需求

- **需求 7.1**: WHEN 用户输入或修改选择器 THEN THE System SHALL 实时验证选择器
- **需求 7.2**: THE System SHALL 显示选择器匹配的元素数量

## 相关接口

- `POST /api/admin/ai/crawler/preview` - 数据预览接口
- `POST /api/admin/ai/crawler/diagnose` - AI失败诊断接口
- `POST /api/admin/ai/crawler/analyze` - AI智能分析接口
