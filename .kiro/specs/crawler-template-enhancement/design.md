# 设计文档：采集模板配置增强

## 概述

本设计文档描述了采集模板配置页面的增强功能，将网页预览、选择器可视化和数据预览功能整合到配置页面中，并添加智能元素选择和AI辅助分析功能。该设计旨在提升用户配置爬虫模板的体验，使配置过程更加直观和高效。

## 架构

### 整体架构

系统采用前后端分离架构：

```
前端 (Vue 3 + TypeScript)
├── 配置表单区域 (左侧)
│   ├── 基本信息表单
│   ├── 选择器配置表单
│   └── 分页配置表单
└── 预览面板区域 (右侧)
    ├── 网页预览标签页
    ├── 选择器可视化标签页
    └── 数据预览标签页

后端 (Node.js + Express)
├── 网页代理服务
├── 选择器验证服务
├── AI分析服务
└── 数据预览服务
```

### 页面布局

采用左右分栏布局：
- 左侧：配置表单区域（40%宽度）
- 右侧：预览面板区域（60%宽度）

## 组件和接口

### 前端组件

#### 1. CrawlerTemplateConfig (主组件)

**职责**：
- 管理整个页面的状态
- 协调配置表单和预览面板的交互
- 处理保存、测试等主要操作

**状态**：
```typescript
interface TemplateConfig {
  id?: string
  name: string
  url: string
  department: string
  dataType: string
  containerSelector: string
  fields: FieldConfig[]
  pagination: PaginationConfig
}

interface FieldConfig {
  id: string
  name: string
  selector: string
}

interface PaginationConfig {
  enabled: boolean
  maxPages: number
  urlPattern?: string
  nextPageSelector?: string
}
```

#### 2. ConfigForm (配置表单组件)

**职责**：
- 渲染配置表单
- 处理表单输入和验证
- 支持动态添加/删除字段

**Props**：
```typescript
interface ConfigFormProps {
  modelValue: TemplateConfig
  loading: boolean
}

interface ConfigFormEmits {
  'update:modelValue': (value: TemplateConfig) => void
  'test': () => void
  'save': () => void
  'aiAnalyze': () => void
}
```

#### 3. PreviewPanel (预览面板组件)

**职责**：
- 管理三个预览标签页
- 显示网页预览、选择器可视化、数据预览

**Props**：
```typescript
interface PreviewPanelProps {
  url: string
  selectors: Record<string, string>
  previewData: any[]
  activeTab: 'webpage' | 'selectors' | 'data'
}

interface PreviewPanelEmits {
  'update:activeTab': (tab: string) => void
  'elementSelected': (selector: string) => void
}
```

#### 4. WebpagePreview (网页预览组件)

**职责**：
- 在iframe中显示目标网页
- 实现元素选择器功能
- 高亮显示匹配的元素

**状态**：
```typescript
interface WebpagePreviewState {
  iframeLoaded: boolean
  pickerEnabled: boolean
  hoveredElement: HTMLElement | null
  selectedElement: HTMLElement | null
}
```

**方法**：
```typescript
// 启用元素选择器
enablePicker(): void

// 停用元素选择器
disablePicker(): void

// 生成CSS选择器
generateSelector(element: HTMLElement): string

// 高亮元素
highlightElement(element: HTMLElement): void
```

#### 5. SelectorValidator (选择器验证组件)

**职责**：
- 实时验证选择器
- 显示匹配元素数量
- 显示验证错误

**Props**：
```typescript
interface SelectorValidatorProps {
  selector: string
  url: string
}

interface ValidationResult {
  valid: boolean
  matchCount: number
  error?: string
}
```

#### 6. DataPreviewTable (数据预览表格组件)

**职责**：
- 显示采集到的数据
- 支持分页
- 默认显示10条数据

**Props**：
```typescript
interface DataPreviewTableProps {
  data: any[]
  columns: string[]
  pageSize: number // 默认10
  total: number
}
```

#### 7. AIAnalysisPanel (AI分析面板组件)

**职责**：
- 显示AI分析结果
- 显示推荐的字段和选择器
- 显示失败原因和建议

**Props**：
```typescript
interface AIAnalysisResult {
  type: 'recommendation' | 'diagnosis'
  fields?: RecommendedField[]
  diagnosis?: DiagnosisResult
}

interface RecommendedField {
  name: string
  selector: string
  confidence: number
}

interface DiagnosisResult {
  reason: string
  suggestions: string[]
  recommendedStrategy: StrategyConfig
}
```

### 后端API接口

#### 1. 网页代理接口

```typescript
GET /api/admin/ai/crawler/proxy
Query: { url: string }
Response: HTML content
```

**功能**：代理加载目标网页，解决跨域问题

#### 2. 选择器验证接口

```typescript
POST /api/admin/ai/crawler/validate-selector
Body: {
  url: string
  selector: string
}
Response: {
  valid: boolean
  matchCount: number
  error?: string
}
```

**功能**：验证选择器是否有效，返回匹配元素数量

#### 3. AI智能分析接口

```typescript
POST /api/admin/ai/crawler/analyze
Body: {
  url: string
  description?: string
}
Response: {
  fields: RecommendedField[]
  containerSelector: string
  confidence: number
}
```

**功能**：AI分析网页结构，推荐采集字段和选择器

#### 4. 数据预览接口

```typescript
POST /api/admin/ai/crawler/preview
Body: {
  url: string
  selectors: {
    container: string
    fields: Record<string, string>
  }
  limit?: number // 默认10
}
Response: {
  data: any[]
  total: number
}
```

**功能**：使用配置的选择器预览采集数据

#### 5. AI失败诊断接口

```typescript
POST /api/admin/ai/crawler/diagnose
Body: {
  url: string
  selectors: Record<string, string>
  error: string
}
Response: {
  reason: string
  suggestions: string[]
  recommendedStrategy: StrategyConfig
}
```

**功能**：分析采集失败原因，提供修复建议

#### 6. 模板保存接口

```typescript
POST /api/admin/ai/crawler/templates
Body: TemplateConfig
Response: {
  id: string
  message: string
}
```

**功能**：保存爬虫模板配置

#### 7. 模板测试接口

```typescript
POST /api/admin/ai/crawler/test
Body: TemplateConfig
Response: {
  success: boolean
  data?: any[]
  error?: string
}
```

**功能**：测试模板配置是否正确

## 数据模型

### 数据库表结构

#### crawler_templates (已存在，需扩展)

```sql
ALTER TABLE crawler_templates 
ADD COLUMN pagination_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN max_pages INT DEFAULT 1,
ADD COLUMN url_pattern VARCHAR(500),
ADD COLUMN next_page_selector VARCHAR(255);
```

### 前端数据模型

```typescript
// 模板配置
interface TemplateConfig {
  id?: string
  name: string
  url: string
  department: string
  dataType: string
  containerSelector: string
  fields: FieldConfig[]
  pagination: PaginationConfig
  createdAt?: Date
  updatedAt?: Date
}

// 字段配置
interface FieldConfig {
  id: string
  name: string
  selector: string
}

// 分页配置
interface PaginationConfig {
  enabled: boolean
  maxPages: number
  urlPattern?: string
  nextPageSelector?: string
}

// AI推荐字段
interface RecommendedField {
  name: string
  selector: string
  confidence: number
  sampleValue?: string
}

// 选择器验证结果
interface ValidationResult {
  valid: boolean
  matchCount: number
  error?: string
  warning?: string
}

// AI诊断结果
interface DiagnosisResult {
  reason: string
  suggestions: string[]
  recommendedStrategy: {
    useHeadless?: boolean
    waitForSelector?: string
    scrollToBottom?: boolean
    customScript?: string
  }
}
```

## 正确性属性

*属性是关于系统应该做什么的正式陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### 属性 1: 配置表单数据绑定

*对于任何*模板配置对象，当用户修改表单字段时，配置对象应该实时更新为新值

**验证: 需求 1.4, 8.3, 8.4**

### 属性 2: 数据预览默认条数

*对于任何*预览请求，当未指定limit参数时，系统应该返回最多10条数据

**验证: 需求 2.1**

### 属性 3: 元素选择器生成唯一性

*对于任何*DOM元素，生成的CSS选择器应该能够唯一定位该元素

**验证: 需求 3.3**

### 属性 4: 选择器验证一致性

*对于任何*有效的CSS选择器，验证接口返回的匹配数量应该与实际DOM中匹配的元素数量一致

**验证: 需求 7.1, 7.2**

### 属性 5: AI推荐字段完整性

*对于任何*AI分析结果，每个推荐字段应该包含名称、选择器和置信度三个属性

**验证: 需求 4.2, 4.3**

### 属性 6: 保存后自动预览

*对于任何*成功保存的模板配置，系统应该自动触发数据预览并切换到数据预览标签页

**验证: 需求 5.1, 5.5**

### 属性 7: 失败时显示AI分析按钮

*对于任何*返回空结果或错误的预览请求，系统应该显示AI分析按钮

**验证: 需求 6.1**

### 属性 8: 字段动态添加删除

*对于任何*字段列表，添加字段应该增加列表长度，删除字段应该减少列表长度

**验证: 需求 8.3, 8.5**

### 属性 9: 分页配置条件显示

*对于任何*分页配置状态，当启用分页为true时，分页配置选项应该可见；当为false时应该隐藏

**验证: 需求 9.2**

### 属性 10: 测试不影响保存状态

*对于任何*模板配置，执行测试操作后，配置表单应该保持可编辑状态

**验证: 需求 10.5**

## 错误处理

### 前端错误处理

1. **网络错误**
   - 显示友好的错误提示
   - 提供重试按钮
   - 记录错误日志

2. **表单验证错误**
   - 实时显示验证错误
   - 高亮错误字段
   - 阻止提交无效数据

3. **iframe加载错误**
   - 显示加载失败提示
   - 提供刷新按钮
   - 检查URL有效性

4. **选择器错误**
   - 显示选择器语法错误
   - 提示修正建议
   - 显示匹配元素数量

### 后端错误处理

1. **网页加载失败**
   - 返回详细错误信息
   - 区分网络错误和404错误
   - 提供重试机制

2. **选择器执行错误**
   - 捕获CSS选择器语法错误
   - 返回友好的错误消息
   - 记录错误日志

3. **AI服务错误**
   - 处理AI服务超时
   - 提供降级方案
   - 返回默认推荐

4. **数据库错误**
   - 事务回滚
   - 返回通用错误消息
   - 记录详细错误日志

## 测试策略

### 单元测试

**前端单元测试**：
- 测试组件渲染
- 测试数据绑定
- 测试事件处理
- 测试选择器生成逻辑

**后端单元测试**：
- 测试API路由
- 测试选择器验证逻辑
- 测试数据转换
- 测试错误处理

### 集成测试

1. **表单与预览联动测试**
   - 测试配置变更后预览更新
   - 测试保存后自动预览
   - 测试AI分析结果应用

2. **元素选择器测试**
   - 测试点击元素生成选择器
   - 测试选择器填充到表单
   - 测试选择器验证

3. **数据预览测试**
   - 测试默认10条数据
   - 测试分页功能
   - 测试数据格式化

### 端到端测试

1. **完整配置流程**
   - 输入URL → AI分析 → 应用推荐 → 预览数据 → 保存模板

2. **手动配置流程**
   - 输入URL → 启用元素选择器 → 点击元素 → 预览数据 → 调整选择器 → 保存

3. **失败诊断流程**
   - 配置错误选择器 → 预览失败 → AI诊断 → 应用建议 → 重新预览

### 性能测试

1. **网页加载性能**
   - 测试不同大小网页的加载时间
   - 目标：3秒内完成加载

2. **数据预览性能**
   - 测试不同数据量的预览响应时间
   - 目标：2秒内返回结果

3. **AI分析性能**
   - 测试AI分析响应时间
   - 目标：5秒内返回结果

4. **实时验证性能**
   - 测试选择器验证响应时间
   - 目标：100ms内返回结果

## 实现注意事项

### 前端实现

1. **iframe跨域处理**
   - 使用后端代理服务加载网页
   - 注入JavaScript到iframe实现元素选择
   - 处理iframe通信

2. **防抖和节流**
   - 选择器验证使用防抖（300ms）
   - 滚动事件使用节流（100ms）

3. **状态管理**
   - 使用Vue 3 Composition API
   - 合理拆分组件状态
   - 避免prop drilling

4. **用户体验**
   - 所有异步操作显示加载状态
   - 提供操作反馈
   - 支持键盘快捷键

### 后端实现

1. **网页代理**
   - 处理各种编码格式
   - 注入元素选择器脚本
   - 缓存代理结果

2. **选择器验证**
   - 使用cheerio解析HTML
   - 支持复杂CSS选择器
   - 返回详细验证信息

3. **AI集成**
   - 调用现有AI配置
   - 处理AI服务超时
   - 提供降级方案

4. **性能优化**
   - 使用连接池
   - 缓存常用数据
   - 异步处理耗时操作

## 安全考虑

1. **URL验证**
   - 验证URL格式
   - 防止SSRF攻击
   - 限制可访问的域名

2. **选择器注入**
   - 转义用户输入
   - 验证选择器语法
   - 防止XSS攻击

3. **权限控制**
   - 验证用户身份
   - 检查操作权限
   - 记录操作日志

4. **数据保护**
   - 加密敏感配置
   - 限制数据访问
   - 定期备份数据
