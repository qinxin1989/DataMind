# 采集模板配置模块

## 概述

采集模板配置模块提供网页采集模板的配置和管理功能，支持AI智能分析、选择器验证、数据预览等高级功能。

## 功能特性

### 1. 模板管理
- ✅ 创建、编辑、删除采集模板
- ✅ 模板列表查看和搜索
- ✅ 模板配置导入导出

### 2. 智能配置
- ✅ AI智能分析网页结构
- ✅ 自动识别容器和字段选择器
- ✅ 选择器验证和优化建议

### 3. 实时预览
- ✅ 网页实时预览
- ✅ 数据采集预览
- ✅ 选择器可视化高亮

### 4. 测试诊断
- ✅ 模板配置测试
- ✅ 采集问题诊断
- ✅ 错误分析和修复建议

### 5. 分页配置
- ✅ 支持分页采集配置
- ✅ 自定义最大页数
- ✅ 下一页选择器配置

## 模块结构

```
modules/crawler-template-config/
├── module.json                 # 模块配置文件
├── README.md                   # 模块文档
├── backend/                    # 后端代码
│   ├── index.ts               # 后端入口
│   ├── types.ts               # 类型定义
│   ├── service.ts             # 业务逻辑
│   ├── routes.ts              # 路由定义
│   └── hooks/                 # 生命周期钩子
│       ├── beforeInstall.ts
│       ├── afterInstall.ts
│       ├── beforeUninstall.ts
│       ├── afterUninstall.ts
│       ├── beforeEnable.ts
│       ├── afterEnable.ts
│       ├── beforeDisable.ts
│       └── afterDisable.ts
└── config/                     # 配置文件
    └── schema.json            # 配置Schema
```

## API接口

### 模板管理

#### 获取模板列表
```
GET /api/crawler/templates
```

#### 获取单个模板
```
GET /api/crawler/templates/:id
```

#### 创建模板
```
POST /api/crawler/templates
Body: {
  name: string;
  department?: string;
  dataType?: string;
  url: string;
  containerSelector: string;
  fields: Array<{
    name: string;
    selector: string;
  }>;
  paginationEnabled?: boolean;
  paginationNextSelector?: string;
  paginationMaxPages?: number;
}
```

#### 更新模板
```
PUT /api/crawler/templates/:id
Body: Partial<CreateTemplateDto>
```

#### 删除模板
```
DELETE /api/crawler/templates/:id
```

### 测试和预览

#### 测试模板
```
POST /api/crawler/templates/test
Body: {
  url: string;
  selectors: {
    container: string;
    fields: Record<string, string>;
  };
  pagination?: {
    enabled: boolean;
    maxPages?: number;
    nextPageSelector?: string;
  };
}
```

#### 预览数据
```
POST /api/crawler/preview
Body: {
  url: string;
  selectors: {
    container: string;
    fields: Record<string, string>;
  };
  limit?: number;
}
```

#### 验证选择器
```
POST /api/crawler/validate-selector
Body: {
  url: string;
  selector: string;
}
```

### AI功能

#### AI智能分析
```
POST /api/crawler/ai-analyze
Body: {
  url: string;
  dataType?: string;
}
```

#### 诊断采集问题
```
POST /api/crawler/diagnose
Body: {
  url: string;
  containerSelector: string;
  fields: Array<{
    name: string;
    selector: string;
  }>;
}
```

## 权限说明

| 权限代码 | 权限名称 | 说明 |
|---------|---------|------|
| `crawler_template_view` | 查看采集模板 | 查看模板列表和详情 |
| `crawler_template_create` | 创建采集模板 | 创建新的采集模板 |
| `crawler_template_edit` | 编辑采集模板 | 编辑现有采集模板 |
| `crawler_template_delete` | 删除采集模板 | 删除采集模板 |
| `crawler_template_test` | 测试采集模板 | 测试模板配置 |

## 配置选项

| 配置项 | 类型 | 默认值 | 说明 |
|-------|------|--------|------|
| `maxTemplates` | number | 100 | 最大模板数量 |
| `defaultMaxPages` | number | 50 | 默认最大采集页数 |
| `previewLimit` | number | 10 | 预览数据条数限制 |
| `enableAIAnalysis` | boolean | true | 是否启用AI智能分析 |
| `enableSelectorValidation` | boolean | true | 是否启用选择器验证 |

## 依赖要求

### 数据库表
- `crawler_templates` - 采集模板表

### 外部服务
- Python爬虫服务 (http://localhost:5000)
  - 用于网页采集、AI分析、选择器验证等功能
  - 如果服务不可用，部分功能将受限

## 使用指南

### 1. 创建采集模板

1. 点击"新增模板"按钮
2. 填写模板基本信息（名称、部门、数据类型）
3. 输入目标URL
4. 配置容器选择器和字段选择器
5. （可选）启用分页配置
6. 点击"测试配置"验证模板
7. 点击"保存模板"

### 2. 使用AI智能分析

1. 在编辑模式下输入目标URL
2. 点击"AI智能分析"按钮
3. 系统自动识别网页结构
4. 自动填充容器选择器和字段选择器
5. 预览采集结果
6. 根据需要调整配置

### 3. 选择器验证

1. 在配置表单中输入选择器
2. 系统自动验证选择器有效性
3. 显示匹配元素数量和示例
4. 提供优化建议

### 4. 实时预览

1. 配置完成后自动触发预览
2. 在右侧预览面板查看采集结果
3. 支持网页预览和数据预览切换
4. 支持选择器可视化高亮

### 5. 问题诊断

1. 如果采集失败，点击"诊断"按钮
2. 系统分析采集问题
3. 提供详细的错误信息和修复建议
4. 一键应用推荐策略

## 快捷键

| 快捷键 | 功能 |
|-------|------|
| `Ctrl+S` | 保存模板 |
| `Ctrl+T` | 测试配置 |
| `Esc` | 返回列表/关闭弹窗 |

## 最佳实践

### 1. 选择器编写
- 优先使用CSS选择器
- 避免使用过于具体的选择器（如包含索引）
- 使用语义化的class名称
- 测试选择器的稳定性

### 2. 分页配置
- 合理设置最大页数，避免过度采集
- 验证下一页选择器的准确性
- 考虑网站的反爬虫策略

### 3. 性能优化
- 限制预览数据量
- 使用缓存减少重复请求
- 合理设置采集间隔

### 4. 错误处理
- 使用诊断功能分析问题
- 查看详细的错误日志
- 根据建议调整配置

## 故障排查

### 问题1：无法采集数据
**可能原因：**
- 选择器配置错误
- 网页结构变化
- 网站反爬虫限制

**解决方案：**
1. 使用"验证选择器"功能检查选择器
2. 使用"AI智能分析"重新识别结构
3. 使用"诊断"功能获取详细错误信息

### 问题2：AI分析失败
**可能原因：**
- Python爬虫服务未启动
- 网络连接问题
- 目标网站无法访问

**解决方案：**
1. 检查Python爬虫服务状态
2. 验证网络连接
3. 尝试手动配置选择器

### 问题3：预览数据不准确
**可能原因：**
- 容器选择器范围过大或过小
- 字段选择器不准确
- 网页动态加载内容

**解决方案：**
1. 调整容器选择器范围
2. 使用选择器可视化功能定位元素
3. 考虑使用等待策略处理动态内容

## 更新日志

### v1.0.0 (2026-02-01)
- ✅ 初始版本发布
- ✅ 支持模板CRUD操作
- ✅ 支持AI智能分析
- ✅ 支持选择器验证
- ✅ 支持实时预览
- ✅ 支持问题诊断
- ✅ 支持分页配置

## 技术支持

如有问题或建议，请联系技术支持团队。

## 许可证

内部使用，保留所有权利。
