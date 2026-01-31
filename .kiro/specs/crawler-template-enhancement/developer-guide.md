# 采集模板配置增强 - 开发者文档

## 项目架构

### 技术栈

**前端**
- Vue 3 + TypeScript
- Ant Design Vue (UI组件库)
- Composition API (状态管理)
- Vite (构建工具)
- Vitest (测试框架)

**后端**
- Node.js + Express + TypeScript
- MySQL (数据库)
- cheerio (HTML解析)
- axios (HTTP客户端)
- OpenAI API (AI服务)

### 目录结构

```
.
├── admin-ui/src/
│   ├── views/ai/
│   │   └── crawler-template-config.vue          # 主页面
│   ├── components/crawler/                      # 采集器组件
│   │   ├── ConfigForm.vue                       # 配置表单
│   │   ├── PaginationConfig.vue                 # 分页配置
│   │   ├── SelectorValidator.vue                # 选择器验证
│   │   ├── WebpagePreview.vue                   # 网页预览
│   │   ├── SelectorVisualization.vue            # 选择器可视化
│   │   ├── DataPreviewTable.vue                 # 数据预览表格
│   │   ├── PreviewPanel.vue                     # 预览面板容器
│   │   ├── AIAnalysisPanel.vue                  # AI分析面板
│   │   └── DiagnosisPanel.vue                   # 诊断面板
│   ├── utils/
│   │   └── elementPicker.ts                     # 元素选择器工具
│   └── api/
│       └── ai.ts                                # AI API接口
├── src/admin/modules/ai/
│   └── routes.ts                                # 后端API路由
└── tests/admin/                                 # 单元测试
    ├── crawlerTemplateMigration.test.ts
    ├── selectorValidation.test.ts
    ├── dataPreview.test.ts
    ├── aiDiagnosis.test.ts
    └── templateTest.test.ts
```

---

## 核心组件说明

### 1. crawler-template-config.vue (主页面)

**职责**：
- 管理模板列表和编辑视图的切换
- 协调各个子组件的通信
- 处理保存、测试、删除等操作
- 管理键盘快捷键

**关键状态**：
```typescript
const editMode = ref(false)              // 编辑模式开关
const formState = ref({...})             // 表单数据
const previewData = ref([])              // 预览数据
const leftPanelCollapsed = ref(false)    // 左面板折叠状态
const rightPanelCollapsed = ref(false)   // 右面板折叠状态
```

**关键方法**：
- `handleSaveConfig()` - 保存模板配置
- `handleTestConfig()` - 测试模板配置
- `handlePreview()` - 预览采集数据
- `handleKeyDown()` - 键盘快捷键处理

### 2. ConfigForm.vue (配置表单)

**职责**：
- 渲染配置表单
- 管理表单数据的双向绑定
- 集成AI分析功能
- 集成分页配置

**Props**：
```typescript
modelValue: {
  name: string
  url: string
  department: string
  dataType: string
  containerSelector: string
  fields: Array<{ name: string, selector: string }>
  paginationEnabled: boolean
  paginationNextSelector: string
  paginationMaxPages: number
}
loading: boolean
```

**Events**：
- `update:modelValue` - 表单数据变化
- `ai-analyze` - 触发AI分析

### 3. PreviewPanel.vue (预览面板)

**职责**：
- 管理三个预览标签页
- 协调子组件（WebpagePreview、SelectorVisualization、DataPreviewTable）
- 提供标签页切换方法

**Props**：
```typescript
url: string
containerSelector: string
fields: Array<{ name: string, selector: string }>
previewData: any[]
previewLoading: boolean
previewError: string
```

**Events**：
- `selector-selected` - 选择器被选中
- `apply-strategy` - 应用推荐策略

**公开方法**：
```typescript
switchToTab(tabKey: string) // 切换到指定标签页
```

### 4. WebpagePreview.vue (网页预览)

**职责**：
- 使用iframe加载目标网页
- 集成元素选择器功能
- 处理iframe通信

**关键功能**：
- 元素选择器的启用/停用
- 鼠标悬停高亮
- 点击选择元素
- CSS选择器生成

### 5. DataPreviewTable.vue (数据预览)

**职责**：
- 展示采集到的数据
- 检测采集失败
- 集成AI诊断功能

**关键功能**：
- 动态生成表格列
- 失败检测和提示
- AI诊断按钮显示
- 应用推荐策略

---

## API接口文档

### 1. 选择器验证

**接口**: `POST /api/admin/ai/crawler/validate-selector`

**请求参数**:
```typescript
{
  url: string      // 目标URL
  selector: string // CSS选择器
}
```

**响应**:
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

### 2. 数据预览

**接口**: `POST /api/admin/ai/crawler/preview`

**请求参数**:
```typescript
{
  url: string
  selectors: {
    container: string
    fields: { [key: string]: string }
  }
  limit?: number  // 默认10
}
```

**响应**:
```typescript
{
  success: boolean
  data: {
    data: any[]     // 采集到的数据
    total: number   // 总数据条数
    limit: number   // 限制条数
  }
}
```

### 3. AI失败诊断

**接口**: `POST /api/admin/ai/crawler/diagnose`

**请求参数**:
```typescript
{
  url: string
  selectors: {
    container: string
    fields: { [key: string]: string }
  }
  error?: string
}
```

**响应**:
```typescript
{
  success: boolean
  data: {
    reason: string              // 失败原因
    issues: string[]            // 问题列表
    suggestions: string[]       // 修复建议
    recommendedStrategy: {      // 推荐策略
      waitForSelector?: string
      scrollToBottom?: boolean
      waitTime?: number
    }
  }
}
```

### 4. 模板测试

**接口**: `POST /api/admin/ai/crawler/test`

**请求参数**:
```typescript
{
  url: string
  selectors: {
    container: string
    fields: { [key: string]: string }
  }
  paginationConfig?: {
    enabled: boolean
    maxPages: number
    nextPageSelector: string
  }
}
```

**响应**:
```typescript
{
  success: boolean
  data: {
    success: boolean
    data: any[]
    count: number
    message: string
  }
}
```

### 5. AI智能分析

**接口**: `POST /api/admin/ai/crawler/analyze`

**请求参数**:
```typescript
{
  url: string
  description?: string
}
```

**响应**:
```typescript
{
  success: boolean
  data: {
    fields: Array<{
      name: string
      selector: string
      confidence: number  // 0-1之间
    }>
  }
}
```

---

## 数据库表结构

### crawler_templates 表

```sql
CREATE TABLE crawler_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  department VARCHAR(255),
  data_type VARCHAR(255),
  url TEXT NOT NULL,
  container_selector TEXT NOT NULL,
  fields JSON NOT NULL,
  pagination_enabled BOOLEAN DEFAULT FALSE,
  pagination_next_selector TEXT,
  pagination_max_pages INT DEFAULT 50,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**字段说明**：
- `id` - 主键
- `name` - 模板名称
- `department` - 归属部门
- `data_type` - 数据类型
- `url` - 目标URL
- `container_selector` - 容器选择器
- `fields` - 字段配置（JSON格式）
- `pagination_enabled` - 是否启用分页
- `pagination_next_selector` - 下一页选择器
- `pagination_max_pages` - 最大页数

---

## 开发指南

### 本地开发环境搭建

1. **安装依赖**
```bash
npm install
```

2. **启动开发服务器**
```bash
# 前端
cd admin-ui
npm run dev

# 后端
npm run dev
```

3. **运行测试**
```bash
npm run test
```

### 添加新功能

#### 1. 添加新的API接口

在 `src/admin/modules/ai/routes.ts` 中添加路由：

```typescript
router.post('/new-endpoint', async (req, res) => {
  try {
    const { param1, param2 } = req.body
    
    // 业务逻辑
    const result = await someService(param1, param2)
    
    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})
```

在 `admin-ui/src/api/ai.ts` 中添加API方法：

```typescript
export const aiApi = {
  // ... 其他方法
  
  newMethod: async (param1: string, param2: number) => {
    const res = await request.post('/api/admin/ai/new-endpoint', {
      param1,
      param2
    })
    return res.data
  }
}
```

#### 2. 添加新的组件

在 `admin-ui/src/components/crawler/` 目录下创建新组件：

```vue
<template>
  <div class="new-component">
    <!-- 组件内容 -->
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// Props定义
interface Props {
  prop1: string
  prop2?: number
}

const props = defineProps<Props>()

// Emits定义
const emit = defineEmits<{
  'event-name': [value: string]
}>()

// 组件逻辑
</script>

<style scoped>
.new-component {
  /* 样式 */
}
</style>
```

#### 3. 编写单元测试

在 `tests/admin/` 目录下创建测试文件：

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import app from '../../src/app'

describe('New Feature Tests', () => {
  beforeEach(() => {
    // 测试前准备
  })

  afterEach(() => {
    // 测试后清理
  })

  it('should do something', async () => {
    const response = await request(app)
      .post('/api/admin/ai/new-endpoint')
      .send({ param1: 'value1', param2: 123 })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
  })
})
```

### 代码规范

1. **TypeScript类型定义**
   - 所有函数参数和返回值都要有类型定义
   - 使用interface定义复杂对象类型
   - 避免使用any类型

2. **Vue组件规范**
   - 使用Composition API
   - Props和Emits要有明确的类型定义
   - 组件要有清晰的职责划分

3. **命名规范**
   - 组件名：PascalCase（如ConfigForm.vue）
   - 函数名：camelCase（如handleSaveConfig）
   - 常量名：UPPER_SNAKE_CASE（如MAX_PAGES）

4. **注释规范**
   - 复杂逻辑要添加注释
   - API接口要有JSDoc注释
   - 组件要有功能说明注释

---

## 测试指南

### 运行测试

```bash
# 运行所有测试
npm run test

# 运行特定测试文件
npx vitest run tests/admin/selectorValidation.test.ts

# 监听模式
npx vitest watch
```

### 测试覆盖率

当前测试覆盖情况：
- 数据库迁移测试：✅
- 选择器验证测试：✅
- 数据预览测试：✅
- AI诊断测试：✅
- 模板测试测试：✅

总计：116个测试用例，100%通过率

### 编写测试用例

测试用例应该覆盖：
1. 正常场景
2. 边界条件
3. 错误处理
4. 异步操作

示例：
```typescript
describe('Selector Validation', () => {
  it('should validate valid selector', async () => {
    // 测试有效选择器
  })

  it('should reject invalid selector', async () => {
    // 测试无效选择器
  })

  it('should handle empty selector', async () => {
    // 测试空选择器
  })
})
```

---

## 部署指南

### 构建生产版本

```bash
# 构建前端
cd admin-ui
npm run build

# 构建后端
npm run build
```

### 环境变量配置

创建 `.env.production` 文件：

```env
# 数据库配置
DB_HOST=your-db-host
DB_PORT=3306
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=your-db-name

# OpenAI配置
OPENAI_API_KEY=your-openai-api-key
OPENAI_BASE_URL=https://api.openai.com/v1

# 服务器配置
PORT=3000
NODE_ENV=production
```

### 数据库迁移

运行数据库迁移脚本：

```bash
# 执行迁移
npm run migrate

# 或手动执行SQL
mysql -u username -p database_name < migrations/add_pagination_fields.sql
```

### Docker部署（可选）

创建 `Dockerfile`：

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

构建和运行：

```bash
docker build -t crawler-template-config .
docker run -p 3000:3000 --env-file .env.production crawler-template-config
```

---

## 故障排查

### 常见问题

**1. 数据预览失败**
- 检查目标URL是否可访问
- 检查选择器是否正确
- 查看浏览器控制台错误信息
- 检查后端日志

**2. AI功能不工作**
- 检查OpenAI API密钥是否配置
- 检查网络连接
- 查看API调用日志

**3. 元素选择器无法使用**
- 检查iframe是否加载成功
- 检查目标网页是否允许iframe嵌入
- 查看浏览器控制台错误

**4. 测试失败**
- 检查数据库连接
- 检查测试数据是否正确
- 查看测试日志

### 日志查看

```bash
# 查看应用日志
tail -f logs/app.log

# 查看错误日志
tail -f logs/error.log
```

---

## 性能优化建议

1. **前端优化**
   - 使用虚拟滚动处理大量数据
   - 图片懒加载
   - 组件按需加载

2. **后端优化**
   - 添加Redis缓存
   - 数据库查询优化
   - API响应压缩

3. **网络优化**
   - 启用HTTP/2
   - 使用CDN加速静态资源
   - 启用Gzip压缩

---

## 贡献指南

1. Fork项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

---

## 许可证

本项目采用 MIT 许可证。

---

## 联系方式

如有问题或建议，请联系开发团队。
