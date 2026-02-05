# 数据源管理模块

## 模块概述

数据源管理模块，支持多种数据源类型的连接、查询和管理。

## 功能特性

### 1. 支持的数据源类型
- **MySQL**: 关系型数据库
- **PostgreSQL**: 关系型数据库
- **API**: RESTful API 数据源
- **File**: 文件数据源（Excel、CSV）

### 2. 核心功能
- 数据源 CRUD 操作
- 连接测试
- Schema 分析
- SQL 查询执行
- 数据源审核（公开/私有）

## 目录结构

```
datasource-management/
├── module.json           # 模块配置
├── README.md             # 说明文档
├── backend/
│   ├── index.ts          # 模块入口
│   ├── routes.ts         # API 路由
│   ├── service.ts        # 服务层
│   ├── types.ts          # 类型定义
│   ├── base.ts           # 基类适配器
│   ├── mysql.ts          # MySQL 适配器
│   ├── postgres.ts       # PostgreSQL 适配器
│   ├── file.ts           # 文件适配器
│   └── api.ts            # API 适配器
└── frontend/
    └── views/            # Vue 组件
```

## API 接口

| 方法 | 路径 | 描述 |
|-----|------|------|
| GET | /datasource | 获取数据源列表 |
| GET | /datasource/:id | 获取数据源详情 |
| POST | /datasource | 创建数据源 |
| PUT | /datasource/:id | 更新数据源 |
| DELETE | /datasource/:id | 删除数据源 |
| POST | /datasource/:id/test | 测试连接 |
| GET | /datasource/:id/schemas | 获取表结构 |
| POST | /datasource/:id/query | 执行查询 |
| POST | /datasource/:id/approve | 审核数据源 |

## 使用示例

```typescript
import { initDataSourceModule } from './modules/datasource-management/backend';

// 初始化模块
const dsModule = initDataSourceModule({ db: pool });

// 使用路由
app.use('/api/datasource', dsModule.routes);

// 创建服务实例
const service = dsModule.createService(userId);
const dataSources = await service.getList({ page: 1, pageSize: 10 });
```

## 数据源配置示例

### MySQL
```json
{
  "name": "我的 MySQL",
  "type": "mysql",
  "host": "localhost",
  "port": 3306,
  "database": "mydb",
  "username": "root",
  "password": "password"
}
```

### PostgreSQL
```json
{
  "name": "我的 PostgreSQL",
  "type": "postgres",
  "host": "localhost",
  "port": 5432,
  "database": "mydb",
  "username": "postgres",
  "password": "password"
}
```

### API
```json
{
  "name": "外部 API",
  "type": "api",
  "apiUrl": "https://api.example.com",
  "apiKey": "your-api-key"
}
```

### Excel 文件
```json
{
  "name": "销售数据",
  "type": "excel",
  "filePath": "/uploads/sales.xlsx"
}
```
