# Admin Backend Module

后台管理模块，提供用户管理、权限控制、系统配置以及 AI 服务的后台支撑接口。

## 📦 功能模块

### 1. 核心模块 (core/)
- **auth/**: JWT 认证、权限中间件
- **database.ts**: 数据库连接池、初始化脚本
- **utils/**: 通用工具函数

### 2. 业务模块 (modules/)
- **ai/**: AI 配置管理、聊天记录、知识库
- **datasource/**: 数据源管理（连接测试、Schema同步）
- **system/**: 系统配置、菜单管理、角色管理
- **user/**: 用户管理

## 🗄️ 数据库表结构

主要数据表（均以 `sys_` 开头）：

| 表名 | 说明 |
|------|------|
| `sys_users` | 用户信息 |
| `sys_roles` | 角色定义 |
| `sys_menus` | 系统菜单 |
| `sys_ai_configs` | AI 模型配置 |
| `sys_datasource_config` | 数据源配置 |
| `sys_chat_history` | AI 问答历史 |
| `sys_schema_analysis` | 数据库 Schema 分析缓存 |

## 🚀 常用命令

### 初始化数据库
应用启动时会自动检测并初始化表结构。如需手动重置，可调用 `initAdminTables()` 函数。

### 添加新模块
1. 在 `modules/` 下创建新文件夹
2. 创建 `service.ts` 处理业务逻辑
3. 创建 `controller.ts` 处理 HTTP 请求
4. 在 `router.ts` 中注册路由
