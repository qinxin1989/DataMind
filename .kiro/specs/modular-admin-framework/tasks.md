# Implementation Plan: 模块化后台管理框架

## Overview

本实现计划将模块化后台管理框架分解为可执行的编码任务。采用渐进式开发，先搭建核心架构，再逐步实现各功能模块。后端使用 TypeScript + Express，前端使用 Vue 3 + Ant Design Vue。

## Tasks

- [x] 1. 搭建项目基础结构和核心类型定义
  - [x] 1.1 创建后端模块化架构目录结构
    - 创建 `src/admin/` 目录结构
    - 包含 core、modules、middleware、services、types 子目录
    - _Requirements: 1.1, 1.2_
  - [x] 1.2 定义核心类型接口
    - 创建 `src/admin/types/index.ts`
    - 定义 ModuleDefinition、ModuleMetadata、ModuleRoute、ModuleMenu、ModulePermission 接口
    - 定义 Role、Permission、UserDetail、AuditLog 等数据模型
    - _Requirements: 1.1, 4.1_
  - [x] 1.3 编写类型定义的属性测试
    - **Property 2: Module Dependency Validation**
    - **Validates: Requirements 1.6**

- [x] 2. 实现模块注册中心
  - [x] 2.1 创建 ModuleRegistry 类
    - 创建 `src/admin/core/moduleRegistry.ts`
    - 实现 register、unregister、getModule、getAllModules 方法
    - 实现依赖检查逻辑
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_
  - [x] 2.2 编写模块注册的属性测试
    - **Property 1: Module Registration Round-Trip**
    - **Validates: Requirements 1.2, 1.3, 1.4**

- [x] 3. 实现权限管理核心
  - [x] 3.1 创建权限数据存储
    - 创建 `src/admin/services/permissionService.ts`
    - 实现角色和权限的 CRUD 操作
    - 实现权限继承逻辑
    - _Requirements: 4.1, 4.2_
  - [x] 3.2 创建权限检查中间件
    - 创建 `src/admin/middleware/permission.ts`
    - 实现 hasPermission、hasAnyPermission、hasAllPermissions 方法
    - 实现权限缓存机制
    - _Requirements: 4.3, 4.4, 4.6, 4.7_
  - [x] 3.3 编写权限系统的属性测试
    - **Property 7: Permission Inheritance Completeness**
    - **Property 8: Permission Verification Correctness**
    - **Validates: Requirements 4.2, 4.3, 4.6**

- [x] 4. Checkpoint - 核心架构验证
  - 确保所有测试通过，如有问题请询问用户

- [x] 5. 实现用户管理模块
  - [x] 5.1 扩展用户服务
    - 创建 `src/admin/modules/user/userService.ts`
    - 实现分页查询、搜索、过滤功能
    - 实现批量操作功能
    - _Requirements: 3.1, 3.3, 3.5_
  - [x] 5.2 实现用户验证逻辑
    - 实现用户名唯一性检查
    - 实现密码强度验证
    - 实现用户状态管理
    - _Requirements: 3.2, 3.3_
  - [x] 5.3 创建用户管理 API 路由
    - 创建 `src/admin/modules/user/routes.ts`
    - 实现 GET/POST/PUT/DELETE 端点
    - 集成权限中间件
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.7_
  - [x] 5.4 编写用户管理的属性测试
    - **Property 3: User Query Consistency**
    - **Property 4: Username Uniqueness Enforcement**
    - **Property 5: User Status Transition Validity**
    - **Property 6: Batch Operation Atomicity**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.5**

- [x] 6. 实现菜单管理模块
  - [x] 6.1 创建菜单服务
    - 创建 `src/admin/modules/menu/menuService.ts`
    - 实现菜单树构建逻辑
    - 实现权限过滤逻辑
    - 实现菜单排序功能
    - _Requirements: 5.1, 5.2, 5.3, 5.6_
  - [x] 6.2 创建菜单管理 API 路由
    - 创建 `src/admin/modules/menu/routes.ts`
    - 实现菜单 CRUD 端点
    - 实现批量排序更新端点
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.6_
  - [x] 6.3 编写菜单管理的属性测试
    - **Property 9: Menu Hierarchy Depth Limit**
    - **Property 10: Menu Permission Filtering**
    - **Property 11: Disabled Menu Preservation**
    - **Validates: Requirements 5.1, 5.3, 5.6**

- [x] 7. 实现审计日志模块
  - [x] 7.1 创建审计服务
    - 创建 `src/admin/modules/audit/auditService.ts`
    - 实现日志记录功能
    - 实现日志查询和导出功能
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  - [x] 7.2 创建审计中间件
    - 创建 `src/admin/middleware/audit.ts`
    - 自动记录所有 API 操作
    - 支持敏感操作标记
    - _Requirements: 10.1, 10.2, 10.5_
  - [x] 7.3 创建审计日志 API 路由
    - 创建 `src/admin/modules/audit/routes.ts`
    - 实现日志查询和导出端点
    - _Requirements: 10.3, 10.4_
  - [x] 7.4 编写审计日志的属性测试
    - **Property 14: Audit Log Completeness**
    - **Property 15: Audit Log Search Correctness**
    - **Property 16: Audit Log Export Format Validity**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4**

- [x] 8. Checkpoint - 后端核心模块验证
  - 确保所有测试通过，如有问题请询问用户
  - ✅ 77 个测试全部通过

- [x] 9. 实现 AI 管理模块
  - [x] 9.1 创建 AI 配置服务
    - 创建 `src/admin/modules/ai/aiConfigService.ts`
    - 实现多提供商配置管理
    - 实现 API Key 验证功能
    - _Requirements: 6.1, 6.4, 6.5_
  - [x] 9.2 创建 AI 统计服务
    - 创建 `src/admin/modules/ai/aiStatsService.ts`
    - 实现使用统计计算
    - 实现对话历史管理
    - _Requirements: 6.2, 6.3_
  - [x] 9.3 创建 AI 管理 API 路由
    - 创建 `src/admin/modules/ai/routes.ts`
    - 实现配置、统计、历史查询端点
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [x] 9.4 编写 AI 管理的属性测试
    - **Property 12: AI Usage Statistics Accuracy**
    - **Property 13: AI Provider Configuration Isolation**
    - **Validates: Requirements 6.2, 6.5**

- [x] 10. 实现系统管理模块
  - [x] 10.1 创建系统配置服务
    - 创建 `src/admin/modules/system/systemService.ts`
    - 实现系统配置管理
    - 实现系统状态监控
    - _Requirements: 7.1, 7.2_
  - [x] 10.2 创建备份恢复服务
    - 创建 `src/admin/modules/system/backupService.ts`
    - 实现数据备份功能
    - 实现数据恢复功能
    - _Requirements: 7.6_
  - [x] 10.3 创建系统管理 API 路由
    - 创建 `src/admin/modules/system/routes.ts`
    - 实现配置、状态、备份端点
    - _Requirements: 7.1, 7.2, 7.5, 7.6, 7.7_
  - [x] 10.4 编写系统管理的属性测试
    - **Property 20: System Backup and Restore Round-Trip**
    - **Validates: Requirements 7.6**

- [x] 11. 实现通知中心模块
  - [x] 11.1 创建通知服务
    - 创建 `src/admin/modules/notification/notificationService.ts`
    - 实现通知创建和查询
    - 实现已读状态管理
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  - [x] 11.2 创建通知 API 路由
    - 创建 `src/admin/modules/notification/routes.ts`
    - 实现通知列表、标记已读端点
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  - [x] 11.3 编写通知中心的属性测试
    - **Property 17: Notification Badge Count Accuracy**
    - **Property 18: Notification Status Management**
    - **Validates: Requirements 9.3, 9.4**

- [x] 12. 实现数据源管理增强
  - [x] 12.1 扩展数据源服务
    - 创建 `src/admin/modules/datasource/datasourceService.ts`
    - 实现连接测试功能
    - 实现使用统计功能
    - 实现分组和标签功能
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - [x] 12.2 创建数据源管理 API 路由
    - 创建 `src/admin/modules/datasource/routes.ts`
    - 实现测试、统计、分组端点
    - _Requirements: 8.2, 8.3, 8.4, 8.5_
  - [x] 12.3 编写数据源管理的属性测试
    - **Property 19: Datasource Connection Test Validity**
    - **Validates: Requirements 8.2, 8.4**

- [x] 13. Checkpoint - 后端模块完成验证
  - 确保所有测试通过，如有问题请询问用户
  - ✅ 153 个测试全部通过（10 个测试文件）

- [x] 14. 创建前端项目结构
  - [x] 14.1 初始化 Vue 3 项目
    - 在 `admin-ui/` 目录创建 Vue 3 + TypeScript 项目
    - 配置 Vite 构建工具
    - 安装 Ant Design Vue、Pinia、Vue Router
    - _Requirements: 2.1_
  - [x] 14.2 创建前端目录结构
    - 创建 layouts、views、components、stores、router、api、utils 目录
    - 配置路径别名
    - _Requirements: 1.1, 2.1_

- [x] 15. 实现阿里云风格布局
  - [x] 15.1 创建主布局组件
    - 创建 `admin-ui/src/layouts/AdminLayout.vue`
    - 实现左侧菜单、顶部导航、内容区域布局
    - 实现侧边栏折叠功能
    - _Requirements: 2.1, 2.2_
  - [x] 15.2 创建面包屑组件
    - 创建 `admin-ui/src/components/Breadcrumb.vue`
    - 基于路由自动生成面包屑
    - _Requirements: 2.3_
  - [x] 15.3 创建通知中心组件
    - 创建 `admin-ui/src/components/NotificationCenter.vue`
    - 实现通知列表和未读计数
    - _Requirements: 9.1, 9.2, 9.3_
  - [x] 15.4 配置响应式样式
    - 实现移动端适配
    - 配置阿里云风格主题色
    - _Requirements: 2.4, 2.5, 2.6_

- [x] 16. 实现前端路由和权限
  - [x] 16.1 配置动态路由
    - 创建 `admin-ui/src/router/index.ts`
    - 实现基于权限的动态路由加载
    - _Requirements: 1.2, 4.4_
  - [x] 16.2 创建权限指令
    - 创建 `admin-ui/src/directives/permission.ts`
    - 实现 v-permission 指令用于按钮级权限
    - _Requirements: 4.4_
  - [x] 16.3 创建权限 Store
    - 创建 `admin-ui/src/stores/permission.ts`
    - 管理用户权限状态
    - _Requirements: 4.3, 4.4_

- [x] 17. 实现前端功能模块
  - [x] 17.1 创建用户管理页面
    - 创建 `admin-ui/src/views/user/` 目录
    - 实现用户列表、新增、编辑、详情页面
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.7_
  - [x] 17.2 创建角色管理页面
    - 创建 `admin-ui/src/views/role/` 目录
    - 实现角色列表和权限分配页面
    - _Requirements: 4.1, 4.2, 4.5_
  - [x] 17.3 创建菜单管理页面
    - 创建 `admin-ui/src/views/menu/` 目录
    - 实现菜单树编辑和拖拽排序
    - _Requirements: 5.1, 5.2, 5.4, 5.7_
  - [x] 17.4 创建 AI 管理页面
    - 创建 `admin-ui/src/views/ai/` 目录
    - 实现配置管理、使用统计、对话历史页面
    - _Requirements: 6.1, 6.2, 6.3, 6.6_
  - [x] 17.5 创建系统管理页面
    - 创建 `admin-ui/src/views/system/` 目录
    - 实现系统配置、状态监控、审计日志页面
    - _Requirements: 7.1, 7.2, 7.3, 10.3_
  - [x] 17.6 创建数据源管理页面
    - 创建 `admin-ui/src/views/datasource/` 目录
    - 实现数据源列表、测试、统计页面
    - _Requirements: 8.1, 8.2, 8.3, 8.5_

- [x] 18. 集成和整合
  - [x] 18.1 整合后端路由
    - 创建 `src/admin/index.ts` 主入口
    - 注册所有模块路由到 Express
    - 配置 API 前缀 `/api/admin`
    - _Requirements: 1.2, 1.3_
  - [x] 18.2 配置前端代理
    - 配置 Vite 开发代理
    - 配置生产环境 API 地址
    - _Requirements: 8.1_
  - [x] 18.3 创建模块注册示例
    - 创建示例模块展示如何添加新功能
    - 编写模块开发文档
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 19. Final Checkpoint - 完整功能验证
  - ✅ 后端 153 个测试全部通过
  - ✅ 前端构建成功
  - ✅ 模块化扩展机制完成

## Notes

- 所有任务都是必须执行的，包括测试任务
- 每个任务都引用了具体的需求编号以便追溯
- Checkpoint 任务用于阶段性验证
- 属性测试验证通用正确性属性
- 单元测试验证具体示例和边界情况
