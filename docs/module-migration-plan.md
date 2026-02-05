# 模块化迁移计划

## 迁移状态

| 模块 | src 目录代码 | 状态 | 完成日期 |
|------|-------------|------|----------|
| rag-service | `src/rag/*` | ✅ 完成 | 2026-02-05 |
| skills-service | `src/agent/skills/*` | ✅ 完成 | 2026-02-05 |
| datasource-management | `src/datasource/*` | 🔄 待迁移 | - |
| auth | `src/services/authService.ts` | 🔄 待迁移 | - |
| file-tools | `src/services/fileEncryption.ts` | 🔄 待迁移 | - |
| ai-config | `src/admin/modules/ai/*` | 🔄 待迁移 | - |
| ai-qa | `src/admin/modules/ai-qa/*` | 🔄 待迁移 | - |

## 已完成模块

### 1. rag-service (RAG 知识库服务)

**目录结构:**
```
modules/rag-service/
├── module.json           # 模块配置
├── README.md             # 说明文档
├── backend/
│   ├── index.ts          # 模块入口
│   ├── routes.ts         # API 路由
│   ├── service.ts        # 服务层（新增）
│   ├── types.ts          # 类型定义（新增）
│   ├── ragEngine.ts      # RAG 引擎
│   ├── agenticRetriever.ts   # Agentic 检索器（新增）
│   ├── knowledgeBase.ts
│   ├── knowledgeGraph.ts
│   ├── vectorStore.ts
│   ├── embeddingService.ts
│   ├── documentProcessor.ts
│   ├── migrations/       # 数据库迁移
│   └── hooks/            # 生命周期钩子
├── config/
│   ├── schema.json
│   └── default.json
└── frontend/views/
```

**新增功能:**
- Agentic 渐进式检索（agenticRetriever.ts）
- 服务层封装（service.ts）
- 完整的 API 路由
- 数据库迁移脚本
- 配置 Schema

### 2. skills-service (AI 技能服务)

**目录结构:**
```
modules/skills-service/
├── module.json
├── README.md
├── backend/
│   ├── index.ts          # 模块入口
│   ├── routes.ts         # API 路由
│   ├── service.ts        # 服务层（新增）
│   ├── types.ts          # 类型定义（新增）
│   ├── registry.ts       # 技能注册中心
│   ├── data/             # 数据技能
│   ├── document/         # 文档技能
│   ├── media/            # 媒体技能
│   └── report/           # 报告技能
└── frontend/
```

**API 接口:**
- GET /skills - 获取技能列表
- GET /skills/categories - 获取技能分类
- GET /skills/capabilities - 获取 Agent 能力
- GET /skills/:name - 获取技能详情
- POST /skills/:name/execute - 执行技能

## 模块标准结构

每个模块应遵循以下结构（参考 example 模块）:

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

## 迁移策略

1. **保持向后兼容**: 在 `src` 中保留入口文件，添加模块化迁移注释
2. **逐步迁移**: 一次迁移一个模块，确保功能正常
3. **完整测试**: 每个模块迁移后进行功能测试
4. **更新导入**: 逐步将项目中的导入路径更新为模块路径

## 使用模块

```typescript
// 使用 rag-service 模块
import { initRagModule } from './modules/rag-service/backend';

const ragModule = initRagModule({ db: pool, aiConfigs: [] });
app.use('/api/rag', ragModule.routes);

// 使用 skills-service 模块
import { initSkillsModule } from './modules/skills-service/backend';

const skillsModule = initSkillsModule({ autoRegister: true });
app.use('/api/skills', skillsModule.routes);
```
