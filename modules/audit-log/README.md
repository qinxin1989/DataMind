# 审计日志模块 (audit-log)

## 概述

审计日志模块提供完整的系统操作审计功能，记录用户的所有重要操作，支持日志查询、统计、导出和自动清理。

## 功能特性

### 核心功能
- ✅ 日志记录：自动记录用户操作
- ✅ 日志查询：支持多条件查询和分页
- ✅ 日志统计：提供多维度统计分析
- ✅ 日志导出：支持JSON和CSV格式导出
- ✅ 自动清理：定期清理过期日志
- ✅ 详情查看：查看完整的日志详情

### 技术特性
- 🔒 安全可靠：完整记录操作轨迹
- 📊 统计分析：多维度数据统计
- 🔍 高效查询：支持索引优化
- 📦 批量导出：支持大量数据导出
- ⚡ 自动清理：定期清理过期数据

## 模块信息

- **模块ID**: `audit-log`
- **版本**: `1.0.0`
- **作者**: System
- **许可证**: MIT

## 安装和使用

### 安装模块

```bash
# 通过模块管理器安装
POST /api/module-system/modules/audit-log/install
```

### 启用模块

```bash
# 启用模块
POST /api/module-system/modules/audit-log/enable
```

## API 接口

### 1. 日志管理

#### 1.1 获取日志列表

```http
GET /api/modules/audit-log/logs
```

**查询参数**:
- `userId` (string, 可选): 用户ID
- `action` (string, 可选): 操作类型
- `resourceType` (string, 可选): 资源类型
- `status` (string, 可选): 状态 (success/failed)
- `startDate` (number, 可选): 开始时间戳
- `endDate` (number, 可选): 结束时间戳
- `page` (number, 可选): 页码，默认1
- `pageSize` (number, 可选): 每页数量，默认20

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "items": [
      {
        "id": "log-uuid",
        "userId": "user-1",
        "username": "admin",
        "action": "login",
        "resourceType": "user",
        "resourceId": "user-1",
        "details": "User logged in",
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "status": "success",
        "errorMessage": null,
        "createdAt": 1706745600000
      }
    ]
  },
  "timestamp": 1706745600000
}
```

#### 1.2 获取日志详情

```http
GET /api/modules/audit-log/logs/:id
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "log-uuid",
    "userId": "user-1",
    "username": "admin",
    "action": "update_config",
    "resourceType": "config",
    "resourceId": "config-1",
    "details": "Updated system configuration",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "status": "success",
    "errorMessage": null,
    "createdAt": 1706745600000
  },
  "timestamp": 1706745600000
}
```

#### 1.3 创建审计日志

```http
POST /api/modules/audit-log/logs
```

**请求体**:
```json
{
  "userId": "user-1",
  "username": "admin",
  "action": "delete_user",
  "resourceType": "user",
  "resourceId": "user-2",
  "details": "Deleted user account",
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "status": "success"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "log-uuid",
    "userId": "user-1",
    "username": "admin",
    "action": "delete_user",
    "resourceType": "user",
    "resourceId": "user-2",
    "details": "Deleted user account",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "status": "success",
    "errorMessage": null,
    "createdAt": 1706745600000
  },
  "timestamp": 1706745600000
}
```

#### 1.4 删除日志

```http
DELETE /api/modules/audit-log/logs/:id
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

### 2. 日志统计

#### 2.1 获取日志统计

```http
GET /api/modules/audit-log/stats
```

**查询参数**:
- `startDate` (number, 可选): 开始时间戳
- `endDate` (number, 可选): 结束时间戳

**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalLogs": 1000,
    "successLogs": 950,
    "failedLogs": 50,
    "topActions": [
      { "action": "login", "count": 300 },
      { "action": "logout", "count": 250 }
    ],
    "topUsers": [
      { "userId": "user-1", "username": "admin", "count": 500 },
      { "userId": "user-2", "username": "user", "count": 300 }
    ],
    "logsByDate": [
      { "date": "2026-02-01", "count": 100 },
      { "date": "2026-01-31", "count": 95 }
    ]
  },
  "timestamp": 1706745600000
}
```

### 3. 日志导出

#### 3.1 导出日志

```http
POST /api/modules/audit-log/export
```

**请求体**:
```json
{
  "format": "csv",
  "startDate": 1706659200000,
  "endDate": 1706745600000,
  "userId": "user-1",
  "action": "login"
}
```

**响应**: 文件下载

### 4. 日志清理

#### 4.1 清理过期日志

```http
POST /api/modules/audit-log/cleanup
```

**请求体**:
```json
{
  "beforeDate": 1706659200000,
  "status": "failed"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "count": 50,
    "message": "已清理 50 条日志"
  },
  "timestamp": 1706745600000
}
```

## 数据库表结构

### audit_logs 表

```sql
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
  status VARCHAR(20) NOT NULL COMMENT 'success, failed',
  error_message TEXT,
  created_at BIGINT NOT NULL,
  INDEX idx_audit_logs_user (user_id),
  INDEX idx_audit_logs_action (action),
  INDEX idx_audit_logs_created (created_at),
  INDEX idx_audit_logs_resource (resource_type, resource_id),
  INDEX idx_audit_logs_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计日志表';
```

## 配置选项

### 配置文件 (config/default.json)

```json
{
  "retentionDays": 90,
  "maxLogsPerQuery": 1000,
  "enableAutoCleanup": true,
  "autoCleanupInterval": 86400000
}
```

### 配置说明

- `retentionDays`: 日志保留天数（7-365天）
- `maxLogsPerQuery`: 单次查询最大日志数（100-10000）
- `enableAutoCleanup`: 是否启用自动清理
- `autoCleanupInterval`: 自动清理间隔（毫秒，1小时-7天）

## 权限控制

### 权限列表

| 权限代码 | 权限名称 | 说明 |
|---------|---------|------|
| `audit-log:view` | 查看审计日志 | 允许查看审计日志 |
| `audit-log:export` | 导出审计日志 | 允许导出审计日志 |
| `audit-log:manage` | 管理审计日志 | 允许删除和清理审计日志 |

## 生命周期钩子

### 1. beforeInstall
- 检查数据库连接
- 验证必要权限

### 2. afterInstall
- 记录安装日志
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
- 清理相关文件

## 使用示例

### 前端使用

```typescript
import { auditLogApi } from '@/modules/audit-log/frontend';

// 获取日志列表
const logs = await auditLogApi.getLogs({
  userId: 'user-1',
  page: 1,
  pageSize: 20
});

// 创建日志
await auditLogApi.createLog({
  userId: 'user-1',
  username: 'admin',
  action: 'update_config',
  resourceType: 'config',
  resourceId: 'config-1',
  status: 'success'
});

// 获取统计
const stats = await auditLogApi.getStats({
  startDate: Date.now() - 7 * 24 * 60 * 60 * 1000,
  endDate: Date.now()
});

// 导出日志
await auditLogApi.exportLogs({
  format: 'csv',
  startDate: Date.now() - 30 * 24 * 60 * 60 * 1000,
  endDate: Date.now()
});
```

### 后端使用

```typescript
import { AuditLogService } from '@/modules/audit-log/backend';

const service = new AuditLogService(db);

// 创建日志
await service.createLog({
  userId: req.user.id,
  username: req.user.username,
  action: 'delete_user',
  resourceType: 'user',
  resourceId: userId,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
  status: 'success'
});

// 查询日志
const result = await service.queryLogs({
  userId: 'user-1',
  action: 'login',
  page: 1,
  pageSize: 20
});

// 获取统计
const stats = await service.getStats();

// 自动清理
const count = await service.autoCleanup();
```

## 测试

### 运行测试

```bash
npm test tests/modules/audit-log/service.test.ts
```

### 测试覆盖

- ✅ 日志创建测试（3个测试）
- ✅ 日志查询测试（6个测试）
- ✅ 日志删除测试（1个测试）
- ✅ 日志统计测试（3个测试）
- ✅ 日志导出测试（3个测试）
- ✅ 日志清理测试（3个测试）

**总计**: 19个测试用例

## 性能指标

- 日志创建: < 10ms
- 日志查询: < 50ms
- 统计分析: < 100ms
- 日志导出: < 1s (1000条)
- 自动清理: < 500ms

## 最佳实践

### 1. 日志记录
- 记录所有重要操作
- 包含完整的上下文信息
- 记录IP地址和User Agent
- 区分成功和失败状态

### 2. 日志查询
- 使用索引优化查询
- 合理设置分页大小
- 使用时间范围过滤
- 避免全表扫描

### 3. 日志清理
- 定期清理过期日志
- 保留重要日志
- 备份历史数据
- 监控存储空间

### 4. 安全考虑
- 敏感信息脱敏
- 权限控制严格
- 防止日志注入
- 定期审计日志

## 故障排除

### 问题1: 日志查询慢
**原因**: 数据量大，缺少索引  
**解决**: 添加索引，使用时间范围过滤

### 问题2: 存储空间不足
**原因**: 日志积累过多  
**解决**: 启用自动清理，调整保留天数

### 问题3: 导出超时
**原因**: 导出数据量过大  
**解决**: 分批导出，使用时间范围限制

## 更新日志

### v1.0.0 (2026-02-01)
- ✅ 初始版本发布
- ✅ 实现日志记录功能
- ✅ 实现日志查询功能
- ✅ 实现日志统计功能
- ✅ 实现日志导出功能
- ✅ 实现自动清理功能
- ✅ 完成19个测试用例

## 贡献指南

欢迎提交问题和改进建议！

## 许可证

MIT License

---

**维护者**: System  
**最后更新**: 2026-02-01
