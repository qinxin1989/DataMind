# Task 20 实施计划：工具模块迁移

## 任务概述

**任务**: Task 20 - 迁移工具模块  
**优先级**: 中  
**预计时间**: 3-4天  
**开始时间**: 2026-02-01  
**状态**: 准备中

## 子任务列表

### 20.1 迁移文件工具模块 ✅
- ✅ 创建 file-tools 模块
- ✅ 迁移文件工具功能
- ✅ 实现8个生命周期钩子
- ✅ 编写测试用例 (16个测试，100%通过)
- **完成时间**: 2026-02-01
- **详情**: 见 task-20.1-completion.md

### 20.2 迁移效率工具模块 ✅
- ✅ 创建 efficiency-tools 模块
- ✅ 迁移效率工具功能
- ✅ 实现8个生命周期钩子
- ✅ 编写测试用例 (35个测试，100%通过)
- **完成时间**: 2026-02-01
- **详情**: 见 task-20.2-completion.md

### 20.3 迁移公文写作模块 ✅
- ✅ 创建 official-doc 模块
- ✅ 迁移公文写作功能
- ✅ 实现8个生命周期钩子
- ✅ 编写测试用例 (31个测试，100%通过)
- **完成时间**: 2026-02-01
- **详情**: 见 task-20.3-completion.md

### 20.4 测试工具模块 ✅
- ✅ 功能测试
- ✅ 集成测试（15个测试，100%通过）
- ✅ 用户体验测试
- **完成时间**: 2026-02-01
- **详情**: 见 task-20.4-completion.md

## 现有代码分析

### 1. 文件工具模块 (file-tools)

#### 前端代码
- **位置**: `admin-ui/src/views/tools/file/index.vue`
- **功能**:
  - PDF 合并
  - 图片压缩
  - 格式转换 (Word/Excel/图片 ↔ PDF)
- **特点**:
  - 文件上传和拖拽
  - 格式选择
  - 批量处理
  - 下载结果

#### 后端代码
- **位置**: `src/admin/modules/tools/fileRoutes.ts`
- **功能**:
  - `/convert` - 文件格式转换
  - `/download/:id/:filename` - 文件下载
- **依赖**:
  - multer - 文件上传
  - pdf-parse - PDF 解析
  - xlsx - Excel 处理
- **特点**:
  - 支持多种格式转换
  - 临时文件管理
  - 中文文件名处理
  - RFC 6266 标准下载

### 2. 效率工具模块 (efficiency-tools)

#### 前端代码
- **位置**: `admin-ui/src/views/tools/efficiency/index.vue`
- **功能**:
  - SQL 格式化
  - 数据转换 (JSON/CSV/Excel)
  - 正则助手
- **特点**:
  - 纯前端实现
  - 使用 sql-formatter 库
  - 实时预览

#### 后端代码
- **状态**: 暂无后端代码（纯前端工具）
- **建议**: 可以添加后端支持以增强功能

### 3. 公文写作模块 (official-doc)

#### 前端代码
- **位置**: `admin-ui/src/views/tools/official-doc/index.vue`
- **功能**:
  - 工作报告生成
  - 通知公告生成
  - 会议纪要生成
  - 计划方案生成
- **特点**:
  - 模板选择
  - 文风选择
  - AI 辅助生成
  - 复制和下载

#### 后端代码
- **状态**: 暂无后端代码（前端模拟）
- **建议**: 需要集成 AI 服务实现真实的公文生成

## 模块设计

### 1. file-tools 模块

```
modules/file-tools/
├── module.json
├── backend/
│   ├── index.ts
│   ├── types.ts
│   ├── service.ts
│   ├── routes.ts
│   ├── hooks/
│   │   ├── beforeInstall.ts
│   │   ├── afterInstall.ts
│   │   ├── beforeEnable.ts
│   │   ├── afterEnable.ts
│   │   ├── beforeDisable.ts
│   │   ├── afterDisable.ts
│   │   ├── beforeUninstall.ts
│   │   └── afterUninstall.ts
│   └── migrations/
│       └── 001_create_file_tools_tables.sql
├── frontend/
│   ├── index.ts
│   ├── routes.ts
│   ├── api/
│   │   └── index.ts
│   └── views/
│       └── FileTools.vue
├── config/
│   ├── schema.json
│   └── default.json
└── README.md
```

#### API 端点
- `POST /api/modules/file-tools/convert` - 文件格式转换
- `GET /api/modules/file-tools/download/:id/:filename` - 文件下载
- `POST /api/modules/file-tools/merge` - PDF 合并
- `POST /api/modules/file-tools/compress` - 图片压缩
- `GET /api/modules/file-tools/history` - 转换历史
- `DELETE /api/modules/file-tools/history/:id` - 删除历史记录

#### 数据库表
```sql
-- 文件转换历史
CREATE TABLE file_conversion_history (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  source_format VARCHAR(20) NOT NULL,
  target_format VARCHAR(20) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  result_filename VARCHAR(255),
  file_size BIGINT,
  status VARCHAR(20) NOT NULL, -- pending, success, failed
  error_message TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
);

CREATE INDEX idx_file_conversion_user ON file_conversion_history(user_id);
CREATE INDEX idx_file_conversion_created ON file_conversion_history(created_at);
```

### 2. efficiency-tools 模块

```
modules/efficiency-tools/
├── module.json
├── backend/
│   ├── index.ts
│   ├── types.ts
│   ├── service.ts
│   ├── routes.ts
│   └── hooks/ (8个钩子)
├── frontend/
│   ├── index.ts
│   ├── routes.ts
│   ├── api/
│   │   └── index.ts
│   └── views/
│       └── EfficiencyTools.vue
├── config/
│   ├── schema.json
│   └── default.json
└── README.md
```

#### API 端点
- `POST /api/modules/efficiency-tools/format-sql` - SQL 格式化
- `POST /api/modules/efficiency-tools/convert-data` - 数据格式转换
- `POST /api/modules/efficiency-tools/test-regex` - 正则表达式测试
- `GET /api/modules/efficiency-tools/templates` - 获取常用模板
- `POST /api/modules/efficiency-tools/save-template` - 保存自定义模板

#### 数据库表
```sql
-- 用户自定义模板
CREATE TABLE efficiency_templates (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type VARCHAR(20) NOT NULL, -- sql, regex, data
  name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
);

CREATE INDEX idx_efficiency_templates_user ON efficiency_templates(user_id);
CREATE INDEX idx_efficiency_templates_type ON efficiency_templates(type);
```

### 3. official-doc 模块

```
modules/official-doc/
├── module.json
├── backend/
│   ├── index.ts
│   ├── types.ts
│   ├── service.ts
│   ├── routes.ts
│   └── hooks/ (8个钩子)
├── frontend/
│   ├── index.ts
│   ├── routes.ts
│   ├── api/
│   │   └── index.ts
│   └── views/
│       └── OfficialDoc.vue
├── config/
│   ├── schema.json
│   └── default.json
└── README.md
```

#### API 端点
- `POST /api/modules/official-doc/generate` - 生成公文
- `GET /api/modules/official-doc/templates` - 获取模板列表
- `GET /api/modules/official-doc/templates/:id` - 获取模板详情
- `POST /api/modules/official-doc/templates` - 创建自定义模板
- `PUT /api/modules/official-doc/templates/:id` - 更新模板
- `DELETE /api/modules/official-doc/templates/:id` - 删除模板
- `GET /api/modules/official-doc/history` - 生成历史
- `POST /api/modules/official-doc/export` - 导出为 Word

#### 数据库表
```sql
-- 公文模板
CREATE TABLE official_doc_templates (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL, -- report, notice, summary, plan
  content TEXT NOT NULL,
  style VARCHAR(20) DEFAULT 'formal', -- formal, concise, enthusiastic
  is_system BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE SET NULL
);

-- 公文生成历史
CREATE TABLE official_doc_history (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  template_id VARCHAR(36),
  type VARCHAR(50) NOT NULL,
  style VARCHAR(20) NOT NULL,
  points TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES official_doc_templates(id) ON DELETE SET NULL
);

CREATE INDEX idx_official_doc_templates_type ON official_doc_templates(type);
CREATE INDEX idx_official_doc_history_user ON official_doc_history(user_id);
CREATE INDEX idx_official_doc_history_created ON official_doc_history(created_at);
```

## 实施步骤

### 阶段 1: 准备工作 (0.5天)

1. **创建模块目录结构**
   ```bash
   mkdir -p modules/file-tools/{backend/{hooks,migrations},frontend/{views,api},config}
   mkdir -p modules/efficiency-tools/{backend/{hooks},frontend/{views,api},config}
   mkdir -p modules/official-doc/{backend/{hooks,migrations},frontend/{views,api},config}
   ```

2. **创建 module.json 文件**
   - 定义模块元数据
   - 声明依赖关系
   - 定义权限和菜单

3. **创建数据库迁移脚本**
   - file-tools: 文件转换历史表
   - efficiency-tools: 用户模板表
   - official-doc: 模板和历史表

### 阶段 2: 迁移 file-tools 模块 (1天)

1. **后端迁移**
   - 创建 types.ts (类型定义)
   - 创建 service.ts (业务逻辑)
   - 创建 routes.ts (API 路由)
   - 实现 8 个生命周期钩子
   - 从 `src/admin/modules/tools/fileRoutes.ts` 迁移代码

2. **前端迁移**
   - 创建 FileTools.vue
   - 从 `admin-ui/src/views/tools/file/index.vue` 迁移代码
   - 创建 API 调用模块
   - 配置路由

3. **测试**
   - 单元测试 (15个测试用例)
   - 集成测试
   - 文件上传测试
   - 格式转换测试

### 阶段 3: 迁移 efficiency-tools 模块 (0.5天)

1. **后端实现**
   - 创建 types.ts
   - 创建 service.ts (SQL 格式化、数据转换、正则测试)
   - 创建 routes.ts
   - 实现 8 个生命周期钩子

2. **前端迁移**
   - 创建 EfficiencyTools.vue
   - 从 `admin-ui/src/views/tools/efficiency/index.vue` 迁移代码
   - 增强功能 (后端支持)
   - 配置路由

3. **测试**
   - 单元测试 (10个测试用例)
   - SQL 格式化测试
   - 数据转换测试

### 阶段 4: 迁移 official-doc 模块 (1天)

1. **后端实现**
   - 创建 types.ts
   - 创建 service.ts (AI 公文生成)
   - 创建 routes.ts
   - 实现 8 个生命周期钩子
   - 集成 AI 配置服务

2. **前端迁移**
   - 创建 OfficialDoc.vue
   - 从 `admin-ui/src/views/tools/official-doc/index.vue` 迁移代码
   - 增强功能 (模板管理、历史记录)
   - 配置路由

3. **测试**
   - 单元测试 (12个测试用例)
   - 公文生成测试
   - 模板管理测试

### 阶段 5: 集成测试和优化 (1天)

1. **集成测试**
   - 测试模块间协作
   - 测试完整工作流
   - 性能测试

2. **文档编写**
   - 编写 README.md
   - API 文档
   - 用户指南

3. **优化**
   - 性能优化
   - 错误处理优化
   - 用户体验优化

## 技术要点

### 1. 文件处理
- 使用 multer 处理文件上传
- 临时文件管理和清理
- 支持大文件处理
- 中文文件名处理

### 2. 格式转换
- PDF 解析: pdf-parse
- Excel 处理: xlsx
- 图片处理: sharp (可选)
- 文档生成: docx (可选)

### 3. AI 集成
- 集成 ai-config 模块
- 使用 AI 服务生成公文
- 支持多种 AI 模型

### 4. 前端优化
- 文件拖拽上传
- 进度显示
- 实时预览
- 响应式设计

## 测试计划

### 单元测试
- file-tools: 15个测试用例
- efficiency-tools: 10个测试用例
- official-doc: 12个测试用例
- **总计**: 37个测试用例

### 集成测试
- 模块安装和启用
- 文件上传和转换流程
- 公文生成流程
- 权限控制

### 性能测试
- 大文件处理性能
- 并发转换性能
- 内存使用

## 依赖关系

### 模块依赖
- file-tools: 无
- efficiency-tools: 无
- official-doc: ai-config (可选)

### NPM 依赖
```json
{
  "multer": "^1.4.5-lts.1",
  "pdf-parse": "^1.1.1",
  "xlsx": "^0.18.5",
  "sql-formatter": "^15.0.0",
  "sharp": "^0.33.0" (可选),
  "docx": "^8.0.0" (可选)
}
```

## 风险和挑战

### 高风险
- ❌ 无

### 中风险
- ⚠️ 大文件处理可能导致内存问题
- ⚠️ PDF 解析中文支持
- ⚠️ AI 服务集成复杂度

### 低风险
- ✅ 前端代码已存在,迁移相对简单
- ✅ 文件工具后端代码已实现

## 成功标准

1. **功能完整性**
   - ✅ 所有工具功能正常工作
   - ✅ 文件上传和下载正常
   - ✅ 格式转换准确

2. **测试覆盖率**
   - ✅ 单元测试通过率 > 90%
   - ✅ 集成测试通过率 100%

3. **性能指标**
   - ✅ 文件转换 < 5秒 (10MB 以内)
   - ✅ API 响应 < 100ms
   - ✅ 内存使用 < 500MB

4. **文档完整性**
   - ✅ README.md 完整
   - ✅ API 文档完整
   - ✅ 用户指南完整

## 时间估算

| 阶段 | 任务 | 预计时间 |
|------|------|----------|
| 1 | 准备工作 | 0.5天 |
| 2 | file-tools 模块 | 1天 |
| 3 | efficiency-tools 模块 | 0.5天 |
| 4 | official-doc 模块 | 1天 |
| 5 | 集成测试和优化 | 1天 |
| **总计** | | **4天** |

## 下一步行动

1. **立即执行**: 创建模块目录结构和 module.json
2. **今天完成**: file-tools 模块迁移
3. **明天完成**: efficiency-tools 和 official-doc 模块迁移
4. **后天完成**: 集成测试和文档

---

**计划创建时间**: 2026-02-01  
**计划创建人**: Kiro AI Assistant  
**状态**: 准备就绪,等待用户确认开始

