# 系统备份模块 (system-backup)

## 概述

系统备份模块提供完整的系统数据备份和恢复功能，支持备份创建、验证、恢复、导出和自动清理。

## 功能特性

### 核心功能
- ✅ 备份创建：创建系统数据完整备份
- ✅ 备份列表：查询和管理备份列表
- ✅ 备份恢复：恢复历史备份数据
- ✅ 备份验证：验证备份完整性
- ✅ 备份导出：导出备份为JSON格式
- ✅ 备份下载：下载备份文件
- ✅ 自动清理：定期清理过期备份

### 技术特性
- 🔒 数据安全：完整备份系统核心数据
- 📦 文件管理：独立目录存储备份文件
- 🔍 完整性验证：JSON格式验证
- 📊 状态跟踪：pending/completed/failed
- ⚡ 自动清理：定期清理过期备份

## 模块信息

- **模块ID**: `system-backup`
- **版本**: `1.0.0`
- **作者**: System
- **许可证**: MIT

## 安装和使用

### 安装模块

```bash
# 通过模块管理器安装
POST /api/module-system/modules/system-backup/install
```

### 启用模块

```bash
# 启用模块
POST /api/module-system/modules/system-backup/enable
```

## API 接口

### 1. 备份管理

#### 1.1 获取备份列表

```http
GET /api/modules/system-backup/backups
```

**查询参数**:
- `status` (string, 可选): 备份状态 (pending/completed/failed)
- `createdBy` (string, 可选): 创建人ID
- `startDate` (number, 可选): 开始时间戳
- `endDate` (number, 可选): 结束时间戳
- `page` (number, 可选): 页码，默认1
- `pageSize` (number, 可选): 每页数量，默认20

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total": 10,
    "page": 1,
    "pageSize": 20,
    "items": [
      {
        "id": "backup-uuid",
        "name": "系统备份-2026-02-01",
        "description": "定期备份",
        "backupSize": 1048576,
        "fileCount": 7,
        "backupPath": "/data/backups/backup-uuid",
        "status": "completed",
        "createdBy": "user-1",
        "createdAt": 1706745600000,
        "completedAt": 1706745610000
      }
    ]
  },
  "timestamp": 1706745600000
}
```

#### 1.2 获取备份详情

```http
GET /api/modules/system-backup/backups/:id
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "backup-uuid",
    "name": "系统备份-2026-02-01",
    "description": "定期备份",
    "backupSize": 1048576,
    "fileCount": 7,
    "backupPath": "/data/backups/backup-uuid",
    "status": "completed",
    "createdBy": "user-1",
    "createdAt": 1706745600000,
    "completedAt": 1706745610000
  },
  "timestamp": 1706745600000
}
```

#### 1.3 创建备份

```http
POST /api/modules/system-backup/backups
```

**请求体**:
```json
{
  "name": "系统备份-2026-02-01",
  "description": "定期备份",
  "createdBy": "user-1"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "backup-uuid",
    "name": "系统备份-2026-02-01",
    "description": "定期备份",
    "backupSize": 1048576,
    "fileCount": 7,
    "backupPath": "/data/backups/backup-uuid",
    "status": "completed",
    "createdBy": "user-1",
    "createdAt": 1706745600000,
    "completedAt": 1706745610000
  },
  "timestamp": 1706745600000
}
```

#### 1.4 删除备份

```http
DELETE /api/modules/system-backup/backups/:id
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "message": "删除成功"
  },
  "timestamp": 1706745600000
}
```

### 2. 恢复功能

#### 2.1 恢复备份

```http
POST /api/modules/system-backup/backups/:id/restore
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "success": true,
    "restored": [
      "users.json",
      "roles.json",
      "permissions.json"
    ],
    "skipped": [],
    "message": "成功恢复 3 个文件"
  },
  "timestamp": 1706745600000
}
```

### 3. 验证功能

#### 3.1 验证备份

```http
GET /api/modules/system-backup/backups/:id/verify
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "errors": [],
    "message": "备份验证通过"
  },
  "timestamp": 1706745600000
}
```

### 4. 导出功能

#### 4.1 导出备份

```http
GET /api/modules/system-backup/backups/:id/export
```

**响应**: JSON文件下载

#### 4.2 下载备份

```http
GET /api/modules/system-backup/backups/:id/download
```

**响应**: 备份文件下载

### 5. 清理功能

#### 5.1 清理过期备份

```http
POST /api/modules/system-backup/cleanup
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "count": 5,
    "message": "已清理 5 个过期备份"
  },
  "timestamp": 1706745600000
}
```

## 数据库表结构

### system_backups 表

```sql
CREATE TABLE system_backups (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  backup_size BIGINT NOT NULL,
  file_count INT NOT NULL,
  backup_path VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL COMMENT 'pending, completed, failed',
  created_by VARCHAR(36) NOT NULL,
  created_at BIGINT NOT NULL,
  completed_at BIGINT,
  error_message TEXT,
  INDEX idx_system_backups_created (created_at),
  INDEX idx_system_backups_status (status),
  INDEX idx_system_backups_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统备份表';
```

## 配置选项

### 配置文件 (config/default.json)

```json
{
  "backupDir": "data/backups",
  "maxBackups": 50,
  "autoCleanup": true,
  "retentionDays": 30
}
```

### 配置说明

- `backupDir`: 备份文件存储目录
- `maxBackups`: 最大备份数量（1-1000）
- `autoCleanup`: 是否启用自动清理
- `retentionDays`: 备份保留天数（1-365）

## 权限控制

### 权限列表

| 权限代码 | 权限名称 | 说明 |
|---------|---------|------|
| `system-backup:view` | 查看备份 | 允许查看备份列表 |
| `system-backup:create` | 创建备份 | 允许创建系统备份 |
| `system-backup:restore` | 恢复备份 | 允许恢复系统备份 |
| `system-backup:delete` | 删除备份 | 允许删除备份文件 |

## 生命周期钩子

### 1. beforeInstall
- 检查数据库连接
- 验证必要权限

### 2. afterInstall
- 创建备份目录
- 初始化配置

### 3. beforeEnable
- 检查数据库表
- 验证配置

### 4. afterEnable
- 启动自动清理任务
- 记录启用日志

### 5. beforeDisable
- 停止自动清理任务
- 记录禁用日志

### 6. afterDisable
- 清理临时数据

### 7. beforeUninstall
- 警告数据删除
- 备份重要数据

### 8. afterUninstall
- 删除数据库表
- 保留备份文件（安全考虑）

## 备份内容

系统备份包含以下核心数据文件：

- `users.json` - 用户数据
- `roles.json` - 角色数据
- `permissions.json` - 权限数据
- `menus.json` - 菜单配置
- `ai-configs.json` - AI配置
- `system-configs.json` - 系统配置
- `admin-users.json` - 管理员用户

## 使用示例

### 前端使用

```typescript
import { systemBackupApi } from '@/modules/system-backup/frontend';

// 获取备份列表
const backups = await systemBackupApi.getBackups({
  page: 1,
  pageSize: 20
});

// 创建备份
await systemBackupApi.createBackup({
  name: '系统备份-2026-02-01',
  description: '定期备份',
  createdBy: 'user-1'
});

// 恢复备份
const result = await systemBackupApi.restoreBackup('backup-id');

// 验证备份
const verifyResult = await systemBackupApi.verifyBackup('backup-id');

// 下载备份
await systemBackupApi.downloadBackup('backup-id');
```

### 后端使用

```typescript
import { SystemBackupService } from '@/modules/system-backup/backend';

const service = new SystemBackupService(db);

// 创建备份
const backup = await service.createBackup({
  name: '系统备份-2026-02-01',
  description: '定期备份',
  createdBy: 'user-1'
});

// 查询备份
const result = await service.queryBackups({
  status: 'completed',
  page: 1,
  pageSize: 20
});

// 恢复备份
const restoreResult = await service.restoreBackup('backup-id');

// 验证备份
const verifyResult = await service.verifyBackup('backup-id');

// 清理过期备份
const count = await service.cleanupOldBackups();
```

## 测试

### 运行测试

```bash
npm test tests/modules/system-backup/service.test.ts
```

### 测试覆盖

- ✅ 备份创建测试（2个测试）
- ✅ 备份查询测试（4个测试）
- ✅ 备份删除测试（2个测试）
- ✅ 备份恢复测试（2个测试）
- ✅ 备份验证测试（2个测试）
- ✅ 备份导出测试（2个测试）
- ✅ 备份清理测试（1个测试）

**总计**: 15个测试用例

## 性能指标

- 备份创建: < 10s (取决于数据量)
- 备份查询: < 50ms
- 备份恢复: < 5s (取决于数据量)
- 备份验证: < 1s
- 备份导出: < 2s

## 最佳实践

### 1. 备份策略
- 定期创建备份（每天/每周）
- 保留多个历史版本
- 重要操作前手动备份
- 定期验证备份完整性

### 2. 恢复操作
- 恢复前先创建当前备份
- 验证备份完整性
- 在测试环境先测试
- 记录恢复操作日志

### 3. 存储管理
- 定期清理过期备份
- 监控存储空间
- 备份文件异地存储
- 加密敏感备份

### 4. 安全考虑
- 严格的权限控制
- 备份文件加密
- 审计所有操作
- 防止未授权访问

## 故障排除

### 问题1: 备份创建失败
**原因**: 磁盘空间不足或权限问题  
**解决**: 检查磁盘空间，确保备份目录有写权限

### 问题2: 恢复失败
**原因**: 备份文件损坏或格式错误  
**解决**: 先验证备份，使用其他备份版本

### 问题3: 备份文件过大
**原因**: 数据量增长  
**解决**: 调整保留策略，定期清理，考虑增量备份

## 更新日志

### v1.0.0 (2026-02-01)
- ✅ 初始版本发布
- ✅ 实现备份创建功能
- ✅ 实现备份恢复功能
- ✅ 实现备份验证功能
- ✅ 实现备份导出功能
- ✅ 实现自动清理功能
- ✅ 完成15个测试用例

## 贡献指南

欢迎提交问题和改进建议！

## 许可证

MIT License

---

**维护者**: System  
**最后更新**: 2026-02-01
