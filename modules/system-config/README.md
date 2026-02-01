# 系统配置模块

提供系统配置管理、数据库配置、系统状态监控等功能。

## 功能特性

### 1. 系统配置管理
- ✅ 配置项 CRUD 操作
- ✅ 配置分组管理
- ✅ 配置类型验证（string, number, boolean, json）
- ✅ 可编辑性控制
- ✅ 配置值类型转换

### 2. 数据库配置
- ✅ 数据库连接配置管理
- ✅ 连接测试功能
- ✅ 密码脱敏显示
- ✅ 配置更新提示

### 3. 系统状态监控
- ✅ CPU 使用率监控
- ✅ 内存使用监控
- ✅ 磁盘使用监控
- ✅ 系统运行时间
- ✅ Node.js 版本信息
- ✅ 实时数据刷新

## 模块结构

```
modules/system-config/
├── module.json                 # 模块配置文件
├── README.md                   # 模块文档
├── backend/                    # 后端代码
│   ├── index.ts               # 后端入口
│   ├── types.ts               # 类型定义
│   ├── service.ts             # 业务逻辑
│   ├── routes.ts              # API 路由
│   ├── hooks/                 # 生命周期钩子
│   │   ├── beforeInstall.ts
│   │   ├── afterInstall.ts
│   │   ├── beforeEnable.ts
│   │   ├── afterEnable.ts
│   │   ├── beforeDisable.ts
│   │   ├── afterDisable.ts
│   │   ├── beforeUninstall.ts
│   │   └── afterUninstall.ts
│   └── migrations/            # 数据库迁移
│       └── 001_create_system_config_tables.sql
├── frontend/                   # 前端代码
│   ├── index.ts               # 前端入口
│   ├── api/                   # API 调用
│   │   └── index.ts
│   └── views/                 # 页面组件
│       ├── SystemConfig.vue   # 系统配置页面
│       └── SystemStatus.vue   # 系统状态页面
└── config/                     # 配置文件
    ├── schema.json            # 配置 Schema
    └── default.json           # 默认配置
```

## API 接口

### 配置管理

#### 获取配置列表
```
GET /api/modules/system-config/configs
Query: group?, key?
Response: SystemConfig[]
```

#### 获取单个配置
```
GET /api/modules/system-config/configs/:key
Response: SystemConfig
```

#### 创建配置
```
POST /api/modules/system-config/configs
Body: CreateConfigRequest
Response: SystemConfig
```

#### 更新配置
```
PUT /api/modules/system-config/configs/:key
Body: UpdateConfigRequest
Response: SystemConfig
```

#### 删除配置
```
DELETE /api/modules/system-config/configs/:key
Response: { message: string }
```

#### 获取配置分组
```
GET /api/modules/system-config/config-groups
Response: string[]
```

### 系统状态

#### 获取系统状态
```
GET /api/modules/system-config/status
Response: SystemStatus
```

### 数据库配置

#### 获取数据库配置
```
GET /api/modules/system-config/db-config
Response: DbConfig (密码已脱敏)
```

#### 更新数据库配置
```
PUT /api/modules/system-config/db-config
Body: UpdateDbConfigRequest
Response: DbConfig & { message: string }
```

#### 测试数据库连接
```
POST /api/modules/system-config/db-config/test
Body: Partial<DbConfig>
Response: DbConnectionTestResult
```

## 数据库表

### system_configs
系统配置表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(36) | 主键 |
| config_key | VARCHAR(100) | 配置键（唯一） |
| config_value | TEXT | 配置值 |
| value_type | VARCHAR(20) | 值类型 |
| description | VARCHAR(255) | 描述 |
| config_group | VARCHAR(50) | 配置分组 |
| is_editable | BOOLEAN | 是否可编辑 |
| created_at | BIGINT | 创建时间 |
| updated_at | BIGINT | 更新时间 |

## 权限定义

- `system-config:view` - 查看系统配置和状态
- `system-config:manage` - 管理系统配置
- `system-config:db-config` - 管理数据库配置

## 菜单定义

- 系统配置 (`/system/config`) - 系统配置管理页面
- 系统状态 (`/system/status`) - 系统状态监控页面

## 配置项

模块配置（config/default.json）：

```json
{
  "enableMonitoring": true,
  "monitoringInterval": 30000,
  "maxConfigHistoryDays": 90
}
```

- `enableMonitoring`: 是否启用系统监控
- `monitoringInterval`: 监控数据刷新间隔（毫秒）
- `maxConfigHistoryDays`: 配置历史保留天数

## 使用示例

### 后端使用

```typescript
import { SystemConfigService } from './backend/service';

const service = new SystemConfigService(db);

// 创建配置
await service.createConfig({
  key: 'app.name',
  value: 'My App',
  type: 'string',
  description: '应用名称',
  group: 'app'
});

// 获取配置值
const appName = await service.getConfigValue<string>('app.name');

// 更新配置
await service.updateConfig('app.name', { value: 'New App Name' });

// 获取系统状态
const status = await service.getSystemStatus();
console.log(`CPU使用率: ${status.cpu.usage}%`);
```

### 前端使用

```typescript
import { systemConfigApi } from './frontend/api';

// 获取配置列表
const configs = await systemConfigApi.getConfigs({ group: 'app' });

// 更新配置
await systemConfigApi.updateConfig('app.name', { value: 'New Name' });

// 获取系统状态
const status = await systemConfigApi.getSystemStatus();

// 测试数据库连接
const result = await systemConfigApi.testDbConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'password',
  database: 'mydb'
});
```

## 生命周期钩子

### beforeInstall
- 检查数据库连接
- 验证必要权限

### afterInstall
- 验证数据表创建
- 加载默认配置

### beforeEnable
- 检查配置表是否存在

### afterEnable
- 初始化监控任务

### beforeDisable
- 停止监控任务

### afterDisable
- 清理资源

### beforeUninstall
- 警告数据删除

### afterUninstall
- 删除数据表
- 清理相关数据

## 测试

运行测试：
```bash
npm test tests/modules/system-config
```

测试覆盖：
- ✅ 配置 CRUD 操作（10个测试）
- ✅ 配置类型验证（7个测试）
- ✅ 系统状态监控（1个测试）
- ✅ 数据库配置管理（2个测试）

总计：20个测试用例

## 注意事项

1. **数据库配置更新**：修改数据库配置后需要重启服务才能生效
2. **密码安全**：数据库密码在前端显示时会自动脱敏
3. **配置验证**：创建和更新配置时会自动验证值类型
4. **不可编辑配置**：系统核心配置标记为不可编辑，防止误操作
5. **监控性能**：系统监控默认30秒刷新一次，避免频繁查询影响性能

## 依赖

- `uuid`: 生成唯一ID
- `mysql2`: 数据库连接测试

## 版本历史

### 1.0.0 (2026-02-01)
- ✅ 初始版本
- ✅ 系统配置管理
- ✅ 数据库配置管理
- ✅ 系统状态监控
- ✅ 完整的测试覆盖

## 作者

System

## 许可证

MIT
