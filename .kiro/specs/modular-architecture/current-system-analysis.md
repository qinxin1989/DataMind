# 当前系统架构分析

## 概述

本文档分析当前系统的架构，识别现有模块，为模块化重构提供基础。

## 后端架构分析

### 当前模块结构

```
src/
├── admin/                    # 后台管理框架
│   ├── core/                # 核心服务（数据库、注册表）
│   ├── middleware/          # 中间件（权限、审计）
│   ├── modules/             # 功能模块
│   │   ├── ai/             # AI 服务模块
│   │   ├── ai-qa/          # AI 问答模块
│   │   ├── approval/       # 审批模块
│   │   ├── audit/          # 审计日志模块
│   │   ├── dashboard/      # 大屏管理模块
│   │   ├── datasource/     # 数据源管理模块
│   │   ├── menu/           # 菜单管理模块
│   │   ├── notification/   # 通知中心模块
│   │   ├── role/           # 角色管理模块
│   │   ├── skills/         # 技能管理模块
│   │   ├── system/         # 系统管理模块
│   │   ├── tools/          # 工具模块
│   │   └── user/           # 用户管理模块
│   ├── services/           # 共享服务
│   └── index.ts            # 主入口（手动注册路由）
├── agent/                   # AI Agent 服务
├── ai/                      # AI 引擎
├── datasource/              # 数据源基础服务
├── middleware/              # 全局中间件
├── rag/                     # RAG 引擎
├── services/                # 全局服务
└── index.ts                 # 应用主入口
```

### 现有模块列表

#### 1. 用户管理模块 (user)
- **路径**: `src/admin/modules/user/`
- **路由**: `/admin/users`
- **功能**: 用户 CRUD、审核、权限管理
- **数据库表**: `sys_users`
- **前端页面**: `admin-ui/src/views/user/index.vue`
- **菜单**: 基础系统管理 > 用户管理

#### 2. 角色管理模块 (role)
- **路径**: `src/admin/modules/role/`
- **路由**: `/admin/roles`
- **功能**: 角色 CRUD、权限分配
- **数据库表**: `sys_roles`, `sys_role_permissions`, `sys_role_menus`
- **前端页面**: `admin-ui/src/views/role/index.vue`
- **菜单**: 基础系统管理 > 角色管理

#### 3. 菜单管理模块 (menu)
- **路径**: `src/admin/modules/menu/`
- **路由**: `/admin/menus`
- **功能**: 菜单 CRUD、层级管理
- **数据库表**: `sys_menus`
- **前端页面**: `admin-ui/src/views/menu/index.vue`
- **菜单**: 基础系统管理 > 菜单管理

#### 4. AI 服务模块 (ai)
- **路径**: `src/admin/modules/ai/`
- **路由**: `/admin/ai`
- **功能**: AI 配置、爬虫管理、OCR、统计
- **数据库表**: `ai_configs`, `ai_crawler_tasks`, `ai_crawler_templates`
- **前端页面**: 
  - `admin-ui/src/views/ai/config.vue`
  - `admin-ui/src/views/ai/crawler.vue`
  - `admin-ui/src/views/ai/crawler-assistant.vue`
  - `admin-ui/src/views/ai/crawler-template-config.vue`
  - `admin-ui/src/views/ai/ocr.vue`
  - `admin-ui/src/views/ai/stats.vue`
- **菜单**: AI 创新中心 / 数据采集中心

#### 5. AI 问答模块 (ai-qa)
- **路径**: `src/admin/modules/ai-qa/`
- **路由**: `/admin/ai-qa`
- **功能**: 智能问答、知识库、对话历史
- **数据库表**: `ai_qa_sessions`, `ai_qa_messages`, `knowledge_base_categories`, `knowledge_base_documents`
- **前端页面**: 
  - `admin-ui/src/views/ai/chat.vue`
  - `admin-ui/src/views/ai/knowledge.vue`
  - `admin-ui/src/views/ai/history.vue`
- **菜单**: AI 创新中心 > 智能问答/知识中心/对话历史

#### 6. 数据源管理模块 (datasource)
- **路径**: `src/admin/modules/datasource/`
- **路由**: `/admin/datasources`
- **功能**: 数据源 CRUD、连接测试、审核
- **数据库表**: `datasources`, `datasource_schema_analysis`
- **前端页面**: 
  - `admin-ui/src/views/datasource/index.vue`
  - `admin-ui/src/views/datasource/approval.vue`
- **菜单**: 数据资源中心 > 数据源管理/数据源审核

#### 7. 审计日志模块 (audit)
- **路径**: `src/admin/modules/audit/`
- **路由**: `/admin/audit`
- **功能**: 操作日志记录和查询
- **数据库表**: `sys_audit_logs`
- **前端页面**: `admin-ui/src/views/system/audit.vue`
- **菜单**: 基础系统管理 > 审计日志

#### 8. 系统管理模块 (system)
- **路径**: `src/admin/modules/system/`
- **路由**: `/admin/system`
- **功能**: 系统配置、状态监控、备份恢复
- **数据库表**: `sys_configs`, `sys_backups`
- **前端页面**: 
  - `admin-ui/src/views/system/config.vue`
  - `admin-ui/src/views/system/status.vue`
  - `admin-ui/src/views/system/backup.vue`
- **菜单**: 基础系统管理 > 系统配置/系统状态/备份恢复

#### 9. 通知中心模块 (notification)
- **路径**: `src/admin/modules/notification/`
- **路由**: `/admin/notifications`
- **功能**: 系统通知、消息推送
- **数据库表**: `sys_notifications`
- **前端页面**: `admin-ui/src/views/notification/index.vue`
- **菜单**: 通知中心

#### 10. 大屏管理模块 (dashboard)
- **路径**: `src/admin/modules/dashboard/`
- **路由**: `/admin/dashboards`
- **功能**: 数据大屏配置和展示
- **数据库表**: `dashboards`, `dashboard_widgets`
- **前端页面**: 
  - `admin-ui/src/views/dashboard/list.vue`
  - `admin-ui/src/views/dashboard/editor.vue`
- **菜单**: 大屏管理

#### 11. 审批流程模块 (approval)
- **路径**: `src/admin/modules/approval/`
- **路由**: 无独立路由（服务层）
- **功能**: 审批流程管理
- **数据库表**: `sys_approvals`
- **前端页面**: 集成在其他模块中
- **菜单**: 无独立菜单

#### 12. 工具模块 (tools)
- **路径**: `src/admin/modules/tools/`
- **路由**: `/admin/tools`
- **功能**: 文件工具、效率工具、公文写作
- **数据库表**: 无
- **前端页面**: 
  - `admin-ui/src/views/tools/file/index.vue`
  - `admin-ui/src/views/tools/efficiency/index.vue`
  - `admin-ui/src/views/tools/official-doc/index.vue`
- **菜单**: 高效办公工具

## 前端架构分析

### 当前路由结构

前端路由在 `admin-ui/src/router/index.ts` 中**硬编码**，包含：
- 静态路由定义
- 手动导入组件
- 固定的菜单结构

### 问题

1. **路由硬编码**: 新增功能需要手动修改路由文件
2. **组件导入硬编码**: 无法动态加载组件
3. **菜单与路由分离**: 菜单在数据库，路由在代码中，容易不一致

## 当前注册机制分析

### 后端路由注册

在 `src/admin/index.ts` 中手动注册：

```typescript
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/menus', menuRoutes);
// ... 更多手动注册
```

**问题**:
- 每个新模块都需要手动添加注册代码
- 无法动态启用/禁用模块
- 模块间耦合度高

### 前端路由注册

在 `admin-ui/src/router/index.ts` 中硬编码所有路由。

**问题**:
- 无法动态加载路由
- 新增模块需要修改核心路由文件
- 无法实现模块的热插拔

## 模块间依赖关系

```
用户模块 ← 角色模块 ← 菜单模块
    ↓
审计模块
    ↓
所有业务模块（记录操作日志）

AI 问答模块 → AI 服务模块（配置）
数据源模块 → 审批模块
```

## 共享服务

### 核心服务
- **数据库连接池**: `src/admin/core/database.ts`
- **权限服务**: `src/admin/services/permissionService.ts`
- **认证服务**: `src/services/authService.ts`

### 中间件
- **认证中间件**: `src/middleware/auth.ts`
- **权限中间件**: `src/admin/middleware/permission.ts`
- **审计中间件**: `src/admin/middleware/audit.ts`

## 数据库表结构

### 系统核心表
- `sys_users` - 用户表
- `sys_roles` - 角色表
- `sys_permissions` - 权限表
- `sys_menus` - 菜单表
- `sys_role_permissions` - 角色权限关联表
- `sys_role_menus` - 角色菜单关联表
- `sys_audit_logs` - 审计日志表
- `sys_configs` - 系统配置表
- `sys_notifications` - 通知表
- `sys_approvals` - 审批表
- `sys_backups` - 备份记录表

### 业务表
- `datasources` - 数据源表
- `datasource_schema_analysis` - 数据源分析表
- `ai_configs` - AI 配置表
- `ai_qa_sessions` - AI 问答会话表
- `ai_qa_messages` - AI 问答消息表
- `ai_crawler_tasks` - 爬虫任务表
- `ai_crawler_templates` - 爬虫模板表
- `knowledge_base_categories` - 知识库分类表
- `knowledge_base_documents` - 知识库文档表
- `dashboards` - 大屏表
- `dashboard_widgets` - 大屏组件表

## 重构优先级

### 高优先级（核心基础设施）
1. 模块注册表系统
2. 动态路由加载机制
3. 模块生命周期管理
4. 数据库迁移系统

### 中优先级（开发工具）
5. 模块脚手架工具
6. 模块打包工具
7. 模块验证工具

### 低优先级（增强功能）
8. 模块市场
9. 模块依赖可视化
10. 模块性能监控

## 迁移策略

### 阶段 1: 基础设施搭建（2-3 周）
- 创建模块注册表
- 实现动态路由加载
- 实现模块生命周期钩子
- 创建模块脚手架工具

### 阶段 2: 核心模块迁移（3-4 周）
- 迁移用户管理模块
- 迁移角色管理模块
- 迁移菜单管理模块
- 验证基础功能

### 阶段 3: 业务模块迁移（4-6 周）
- 迁移 AI 相关模块
- 迁移数据源模块
- 迁移工具模块
- 迁移其他业务模块

### 阶段 4: 优化和完善（2-3 周）
- 性能优化
- 文档完善
- 测试覆盖
- 上线部署

## 风险评估

### 技术风险
- **动态路由加载**: Vue Router 的动态路由可能有限制
- **热重载**: Node.js 的模块热重载需要特殊处理
- **数据库迁移**: 复杂的迁移脚本可能导致数据丢失

### 业务风险
- **功能中断**: 迁移过程中可能影响现有功能
- **数据一致性**: 模块化后数据隔离可能导致一致性问题
- **学习成本**: 团队需要学习新的开发模式

### 缓解措施
- 渐进式迁移，保持新旧架构共存
- 完善的测试覆盖
- 详细的迁移文档和培训
- 数据备份和回滚方案
