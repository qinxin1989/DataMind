# 模块化迁移计划

## 迁移状态总览

| 模块 | src 目录代码 | 状态 | 完成日期 |
|------|-------------|------|----------|
| rag-service | `src/rag/*` | ✅ 完成 | 2026-02-05 |
| skills-service | `src/agent/skills/*` | ✅ 完成 | 2026-02-05 |
| datasource-management | `src/datasource/*` | ✅ 完成 | 2026-02-05 |
| auth | `src/services/authService.ts` | ✅ 完成 | 2026-02-05 |
| ai-config | `src/admin/modules/ai/*` | 🔄 待迁移 | - |
| ai-qa | `src/admin/modules/ai-qa/*` | 🔄 待迁移 | - |
| file-tools | `src/services/fileEncryption.ts` | 🔄 待迁移 | - |
| ocr-service | `src/services/ocr/*` | 🔄 待迁移 | - |

---

## 已完成模块（4个）

### 1. rag-service (RAG 知识库服务)

**新增功能:**
- Agentic 渐进式检索器（不依赖向量库）
- 服务层封装
- 数据库迁移脚本
- 配置 Schema

**目录结构:**
```
modules/rag-service/
├── module.json
├── README.md
├── backend/
│   ├── index.ts, routes.ts, service.ts, types.ts
│   ├── ragEngine.ts, agenticRetriever.ts
│   ├── knowledgeBase.ts, knowledgeGraph.ts
│   ├── vectorStore.ts, embeddingService.ts
│   ├── documentProcessor.ts
│   ├── migrations/, hooks/
├── config/
└── frontend/views/
```

### 2. skills-service (AI 技能服务)

**新增功能:**
- 技能注册中心
- 服务层封装
- 完整 API 路由

**目录结构:**
```
modules/skills-service/
├── module.json
├── README.md
├── backend/
│   ├── index.ts, routes.ts, service.ts, types.ts
│   ├── registry.ts
│   ├── data/, document/, media/, report/
└── frontend/
```

### 3. datasource-management (数据源管理)

**新增功能:**
- 服务层封装
- 多数据源适配器
- 连接测试、查询执行

**目录结构:**
```
modules/datasource-management/
├── module.json
├── README.md
├── backend/
│   ├── index.ts, routes.ts, service.ts, types.ts
│   ├── base.ts, mysql.ts, postgres.ts
│   ├── file.ts, api.ts
└── frontend/
```

### 4. auth (用户认证)

**新增功能:**
- 模块入口整合路由、服务和中间件
- 类型定义

**目录结构:**
```
modules/auth/
├── module.json
├── README.md
├── backend/
│   ├── index.ts, routes.ts, types.ts
│   ├── authService.ts, middleware.ts
└── frontend/
```

---

## 模块标准结构

```
modules/<module-name>/
├── module.json           # 必需：模块配置
├── README.md             # 推荐：模块说明
├── backend/
│   ├── index.ts          # 必需：模块入口
│   ├── routes.ts         # 必需：API 路由
│   ├── service.ts        # 推荐：服务层
│   ├── types.ts          # 推荐：类型定义
│   ├── hooks/            # 可选：生命周期钩子
│   └── migrations/       # 可选：数据库迁移
├── config/
│   ├── schema.json       # 可选：配置 Schema
│   └── default.json      # 可选：默认配置
└── frontend/
    ├── index.ts          # 可选：前端入口
    ├── routes.ts         # 可选：前端路由
    └── views/            # 可选：Vue 组件
```

---

## 使用示例

```typescript
// 初始化各模块
import { initRagModule } from './modules/rag-service/backend';
import { initSkillsModule } from './modules/skills-service/backend';
import { initDataSourceModule } from './modules/datasource-management/backend';
import { initAuthModule } from './modules/auth/backend';

// RAG 知识库
const ragModule = initRagModule({ db: pool, aiConfigs: [] });
app.use('/api/rag', ragModule.routes);

// AI 技能
const skillsModule = initSkillsModule({ autoRegister: true });
app.use('/api/skills', skillsModule.routes);

// 数据源管理
const dsModule = initDataSourceModule({ db: pool });
app.use('/api/datasource', dsModule.routes);

// 认证
const authModule = initAuthModule({ pool, jwtSecret: 'xxx' });
app.use('/api/auth', authModule.routes);

// 使用认证中间件保护其他路由
app.use('/api/protected', authModule.authMiddleware, protectedRoutes);
```

---

## 下一步

1. 迁移 `ai-config` 模块
2. 迁移 `ai-qa` 模块
3. 迁移 `file-tools` 模块
4. 迁移 `ocr-service` 模块
5. 更新 `src` 目录的入口文件，从模块重新导出
