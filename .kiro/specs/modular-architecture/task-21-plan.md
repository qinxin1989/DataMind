# Task 21 实施计划：系统管理模块迁移

## 任务概述

**任务**: Task 21 - 迁移系统管理模块  
**优先级**: 高  
**预计时间**: 2-3天  
**开始时间**: 2026-02-01  
**状态**: 准备中

## 子任务列表

### 21.1 迁移系统配置模块
- 创建 system-config 模块
- 迁移系统配置管理功能
- 实现8个生命周期钩子
- 编写测试用例

### 21.2 迁移审计日志模块
- 创建 audit-log 模块
- 迁移审计日志功能
- 实现8个生命周期钩子
- 编写测试用例

### 21.3 迁移备份恢复模块
- 创建 system-backup 模块
- 迁移备份恢复功能
- 实现8个生命周期钩子
- 编写测试用例

### 21.4 测试系统管理模块
- 功能测试
- 集成测试
- 安全测试

## 现有代码分析

### 1. 系统配置模块 (system-config)

#### 后端代码
- **位置**: `src/admin/modules/system/systemService.ts`
- **功能**:
  - 系统配置管理（CRUD）
  - 配置分组管理
  - 配置类型验证
  - 系统状态监控
  - 数据库配置管理
- **特点**:
  - 支持多种配置类型（string, number, boolean, json）
  - 配置分组（site, security, upload, ai）
  - 可编辑性控制
  - 系统状态实时监控（CPU、内存、磁盘）

#### 前端代码
- **位置**: `admin-ui/src/views/system/config.vue`
- **功能**:
  - 配置项管理界面
  - 数据库配置界面
  - 配置分组展示
  - 配置测试功能
- **特点**:
  - 分组标签页
  - 表单验证
  - 实时保存
  - 密码脱敏

### 2. 审计日志模块 (audit-log)

#### 当前状态
- **位置**: 类型定义在 `src/admin/types/index.ts`
- **功能**: 审计日志记录
- **特点**:
  - 用户操作记录
  - 时间戳记录
  - 操作类型分类
  - IP地址记录

#### 需要实现
- 审计日志服务
- 日志查询和过滤
- 日志导出
- 日志清理策略

### 3. 备份恢复模块 (system-backup)

#### 后端代码
- **位置**: `src/admin/modules/system/backupService.ts`
- **功能**:
  - 创建备份
  - 备份列表管理
  - 备份恢复
  - 备份验证
  - 备份导出
- **特点**:
  - 支持多文件备份
  - 元数据管理
  - 完整性验证
  - JSON格式导出

#### 前端代码
- **位置**: `admin-ui/src/views/system/backup.vue`
- **功能**:
  - 备份列表展示
  - 创建备份
  - 恢复备份
  - 下载备份
- **特点**:
  - 表格展示
  - 操作按钮
  - 文件大小格式化
  - 时间格式化

### 4. 系统状态监控

#### 后端代码
- **位置**: `src/admin/modules/system/systemService.ts` (getSystemStatus方法)
- **功能**:
  - CPU使用率监控
  - 内存使用监控
  - 磁盘使用监控
  - 系统运行时间
  - Node.js版本信息

#### 前端代码
- **位置**: `admin-ui/src/views/system/status.vue`
- **功能**:
  - 系统状态仪表盘
  - 实时数据刷新
  - 进度条展示
  - 系统信息展示

## 模块设计

### 1. system-config 模块

```
modules/system-config/
├── module.json
├── README.md
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
│       └── 001_create_system_config_tables.sql
├── frontend/
│   ├── index.ts
│   ├── routes.ts
│   ├── api/
│   │   └── index.ts
│   └── views/
│       ├── SystemConfig.vue
│       └── SystemStatus.vue
└── config/
    ├── schema.json
    └── default.json
```

#### API 端点
- `GET /api/modules/system-config/configs` - 获取配置列表
- `GET /api/modules/system-config/configs/:key` - 获取单个配置
- `PUT /api/modules/system-config/configs/:key` - 更新配置
- `POST /api/modules/system-config/configs` - 创建配置
- `DELETE /api/modules/system-config/configs/:key` - 删除配置
- `GET /api/modules/system-config/config-groups` - 获取配置分组
- `GET /api/modules/system-config/status` - 获取系统状态
- `GET /api/modules/system-config/db-config` - 获取数据库配置
- `PUT /api/modules/system-config/db-config` - 更新数据库配置
- `POST /api/modules/system-config/db-config/test` - 测试数据库连接

#### 数据库表
```sql
-- 系统配置表
CREATE TABLE system_configs (
  id VARCHAR(36) PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  value_type VARCHAR(20) NOT NULL, -- string, number, boolean, json
  description VARCHAR(255),
  config_group VARCHAR(50) NOT NULL,
  is_editable BOOLEAN DEFAULT TRUE,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX idx_system_configs_group ON system_configs(config_group);
CREATE INDEX idx_system_configs_key ON system_configs(config_key);
```

### 2. audit-log 模块

```
modules/audit-log/
├── module.json
├── README.md
├── backend/
│   ├── index.ts
│   ├── types.ts
│   ├── service.ts
│   ├── routes.ts
│   ├── hooks/ (8个钩子)
│   └── migrations/
│       └── 001_create_audit_log_tables.sql
├── frontend/
│   ├── index.ts
│   ├── routes.ts
│   ├── api/
│   │   └── index.ts
│   └── views/
│       └── AuditLog.vue
└── config/
    ├── schema.json
    └── default.json
```

#### API 端点
- `GET /api/modules/audit-log/logs` - 获取审计日志列表
- `GET /api/modules/audit-log/logs/:id` - 获取日志详情
- `POST /api/modules/audit-log/logs` - 创建审计日志
- `DELETE /api/modules/audit-log/logs/:id` - 删除日志
- `POST /api/modules/audit-log/export` - 导出日志
- `POST /api/modules/audit-log/cleanup` - 清理过期日志
- `GET /api/modules/audit-log/stats` - 获取日志统计

#### 数据库表
```sql
-- 审计日志表
CREATE TABLE audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  username VARCHAR(100),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(36),
  details TEXT,
  ip_address VARCHAR(45),
  user_agent VARCHAR(255),
  status VARCHAR(20) NOT NULL, -- success, failed
  error_message TEXT,
  created_at BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES sys_users(id) ON DELETE CASCADE
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
```

### 3. system-backup 模块

```
modules/system-backup/
├── module.json
├── README.md
├── backend/
│   ├── index.ts
│   ├── types.ts
│   ├── service.ts
│   ├── routes.ts
│   ├── hooks/ (8个钩子)
│   └── migrations/
│       └── 001_create_backup_tables.sql
├── frontend/
│   ├── index.ts
│   ├── routes.ts
│   ├── api/
│   │   └── index.ts
│   └── views/
│       └── SystemBackup.vue
└── config/
    ├── schema.json
    └── default.json
```

#### API 端点
- `GET /api/modules/system-backup/backups` - 获取备份列表
- `POST /api/modules/system-backup/backups` - 创建备份
- `GET /api/modules/system-backup/backups/:id` - 获取备份详情
- `DELETE /api/modules/system-backup/backups/:id` - 删除备份
- `POST /api/modules/system-backup/backups/:id/restore` - 恢复备份
- `GET /api/modules/system-backup/backups/:id/verify` - 验证备份
- `GET /api/modules/system-backup/backups/:id/export` - 导出备份
- `GET /api/modules/system-backup/backups/:id/download` - 下载备份

#### 数据库表
```sql
-- 备份记录表
CREATE TABLE system_backups (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  backup_size BIGINT NOT NULL,
  file_count INT NOT NULL,
  backup_path VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL, -- pending, completed, failed
  created_by VARCHAR(36) NOT NULL,
  created_at BIGINT NOT NULL,
  completed_at BIGINT,
  error_message TEXT,
  FOREIGN KEY (created_by) REFERENCES sys_users(id) ON DELETE CASCADE
);

CREATE INDEX idx_system_backups_created ON system_backups(created_at);
CREATE INDEX idx_system_backups_status ON system_backups(status);
```

## 实施步骤

### 阶段 1: 准备工作 (0.5天)

1. **创建模块目录结构**
   ```bash
   mkdir -p modules/system-config/{backend/{hooks,migrations},frontend/{views,api},config}
   mkdir -p modules/audit-log/{backend/{hooks,migrations},frontend/{views,api},config}
   mkdir -p modules/system-backup/{backend/{hooks,migrations},frontend/{views,api},config}
   ```

2. **创建 module.json 文件**
   - 定义模块元数据
   - 声明依赖关系
   - 定义权限和菜单

3. **创建数据库迁移脚本**
   - system-config: 系统配置表
   - audit-log: 审计日志表
   - system-backup: 备份记录表

### 阶段 2: 迁移 system-config 模块 (1天)

1. **后端迁移**
   - 创建 types.ts (类型定义)
   - 创建 service.ts (业务逻辑)
   - 创建 routes.ts (API 路由)
   - 实现 8 个生命周期钩子
   - 从 `src/admin/modules/system/systemService.ts` 迁移代码

2. **前端迁移**
   - 创建 SystemConfig.vue
   - 创建 SystemStatus.vue
   - 从 `admin-ui/src/views/system/config.vue` 迁移代码
   - 从 `admin-ui/src/views/system/status.vue` 迁移代码
   - 创建 API 调用模块
   - 配置路由

3. **测试**
   - 单元测试 (20个测试用例)
   - 配置管理测试
   - 系统状态测试
   - 数据库配置测试

### 阶段 3: 迁移 audit-log 模块 (0.5天)

1. **后端实现**
   - 创建 types.ts
   - 创建 service.ts (日志记录、查询、导出)
   - 创建 routes.ts
   - 实现 8 个生命周期钩子
   - 实现日志中间件

2. **前端实现**
   - 创建 AuditLog.vue
   - 实现日志列表
   - 实现日志过滤
   - 实现日志导出
   - 配置路由

3. **测试**
   - 单元测试 (15个测试用例)
   - 日志记录测试
   - 日志查询测试
   - 日志导出测试

### 阶段 4: 迁移 system-backup 模块 (0.5天)

1. **后端迁移**
   - 创建 types.ts
   - 创建 service.ts
   - 创建 routes.ts
   - 实现 8 个生命周期钩子
   - 从 `src/admin/modules/system/backupService.ts` 迁移代码

2. **前端迁移**
   - 创建 SystemBackup.vue
   - 从 `admin-ui/src/views/system/backup.vue` 迁移代码
   - 增强功能 (进度显示、验证)
   - 配置路由

3. **测试**
   - 单元测试 (18个测试用例)
   - 备份创建测试
   - 备份恢复测试
   - 备份验证测试

### 阶段 5: 集成测试和优化 (0.5天)

1. **集成测试**
   - 测试模块间协作
   - 测试完整工作流
   - 安全测试

2. **文档编写**
   - 编写 README.md
   - API 文档
   - 用户指南

3. **优化**
   - 性能优化
   - 安全加固
   - 用户体验优化

## 技术要点

### 1. 系统配置管理
- 配置类型验证
- 配置分组管理
- 配置加密存储
- 配置热更新

### 2. 审计日志
- 自动日志记录
- 日志中间件
- 日志查询优化
- 日志归档策略

### 3. 备份恢复
- 文件系统操作
- 数据完整性验证
- 增量备份（可选）
- 备份压缩（可选）

### 4. 系统监控
- 系统资源监控
- 实时数据更新
- 性能指标收集
- 告警机制（可选）

## 测试计划

### 单元测试
- system-config: 20个测试用例
- audit-log: 15个测试用例
- system-backup: 18个测试用例
- **总计**: 53个测试用例

### 集成测试
- 模块安装和启用
- 配置管理流程
- 审计日志记录
- 备份恢复流程
- 权限控制

### 安全测试
- 配置访问控制
- 敏感数据保护
- 备份文件安全
- 日志数据安全

## 依赖关系

### 模块依赖
- system-config: 无
- audit-log: 无
- system-backup: 无

### NPM 依赖
```json
{
  "archiver": "^6.0.0" (可选，用于备份压缩),
  "diskusage": "^1.1.3" (可选，用于磁盘监控)
}
```

## 风险和挑战

### 高风险
- ⚠️ 备份恢复可能导致数据丢失
- ⚠️ 系统配置错误可能导致系统不可用

### 中风险
- ⚠️ 审计日志数据量大可能影响性能
- ⚠️ 系统监控可能消耗资源

### 低风险
- ✅ 后端代码已存在，迁移相对简单
- ✅ 前端代码已存在，迁移相对简单

## 成功标准

1. **功能完整性**
   - ✅ 所有系统管理功能正常工作
   - ✅ 配置管理正常
   - ✅ 备份恢复正常
   - ✅ 审计日志正常

2. **测试覆盖率**
   - ✅ 单元测试通过率 > 90%
   - ✅ 集成测试通过率 100%

3. **安全性**
   - ✅ 敏感数据加密
   - ✅ 权限控制完善
   - ✅ 审计日志完整

4. **性能指标**
   - ✅ 配置读取 < 50ms
   - ✅ 日志查询 < 200ms
   - ✅ 备份创建 < 10秒
   - ✅ 系统监控 < 100ms

5. **文档完整性**
   - ✅ README.md 完整
   - ✅ API 文档完整
   - ✅ 用户指南完整

## 时间估算

| 阶段 | 任务 | 预计时间 |
|------|------|----------|
| 1 | 准备工作 | 0.5天 |
| 2 | system-config 模块 | 1天 |
| 3 | audit-log 模块 | 0.5天 |
| 4 | system-backup 模块 | 0.5天 |
| 5 | 集成测试和优化 | 0.5天 |
| **总计** | | **3天** |

## 下一步行动

1. **立即执行**: 创建模块目录结构和 module.json
2. **今天完成**: system-config 模块迁移
3. **明天完成**: audit-log 和 system-backup 模块迁移
4. **后天完成**: 集成测试和文档

---

**计划创建时间**: 2026-02-01  
**计划创建人**: Kiro AI Assistant  
**状态**: 准备就绪，等待用户确认开始
