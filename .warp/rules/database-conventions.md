# 数据库规范

## 数据库信息
- 主数据库: MySQL
- 连接配置: 环境变量 `CONFIG_DB_HOST`, `CONFIG_DB_PORT`, `CONFIG_DB_USER`, `CONFIG_DB_PASSWORD`, `CONFIG_DB_NAME`
- 连接池: `ConfigStore.pool`（mysql2/promise Pool）
- 数据库名默认: `DataMind`

## 表命名规范
- 系统表前缀: `sys_`（如 `sys_ai_configs`, `sys_users`）
- 业务表使用模块名前缀或直接使用业务名
- 字段命名: snake_case

## 查询规范
- 使用参数化查询（`?` 占位符），严禁字符串拼接 SQL
- 使用 `pool.execute()` 执行预处理语句
- 查询结果类型使用 `RowDataPacket[]` 断言

```typescript
const [rows] = await pool.execute<RowDataPacket[]>(
  'SELECT * FROM sys_users WHERE id = ?',
  [userId]
);
```

## 迁移
- 迁移文件存放在 `migrations/` 目录
- 模块相关的表初始化通常在模块的 `afterInstall` 钩子或 `service.init()` 中执行
- 核心表初始化在 `initAdminTables()`（`src/admin/core/database.ts`）和 `initDataSources()`（`src/index.ts`）中

## 安全
- 密码使用 bcrypt 哈希
- 文件上传自动加密（`fileEncryption` 服务）
- JWT 认证（`jsonwebtoken`）
- 环境配置支持加密存储（`npm run encrypt-env`）
