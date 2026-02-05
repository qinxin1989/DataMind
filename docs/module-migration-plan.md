# 模块化迁移计划

## 迁移状态总览

| 模块 | src 目录代码 | 状态 | 完成日期 |
|------|-------------|------|----------|
| rag-service | `src/rag/*` | ✅ 完成 | 2026-02-05 |
| skills-service | `src/agent/skills/*` | ✅ 完成 | 2026-02-05 |
| datasource-management | `src/datasource/*` | ✅ 完成 | 2026-02-05 |
| auth | `src/services/authService.ts` | ✅ 完成 | 2026-02-05 |
| ocr-service | `src/services/ocrService.ts` | ✅ 完成 | 2026-02-05 |
| ai-crawler-assistant | `src/agent/skills/crawler/*` | ✅ 完成 | 2026-02-05 |
| ai-config | 已完整 | ✅ 已有 | - |
| file-tools | 已完整 | ✅ 已有 | - |

---

## 已完成模块（8个）

### 1. rag-service (RAG 知识库服务)
- Agentic 渐进式检索器
- 向量存储和知识图谱
- 数据库迁移和配置

### 2. skills-service (AI 技能服务)
- 技能注册中心
- 数据、文档、媒体、报告技能

### 3. datasource-management (数据源管理)
- 多数据源适配器（MySQL, PostgreSQL, File, API）
- 连接测试、查询执行

### 4. auth (用户认证)
- JWT 认证
- 用户审核流程

### 5. ocr-service (OCR 识别服务)
- PaddleOCR 客户端
- 单图/批量识别

### 6. ai-crawler-assistant (AI 爬虫助手)
- 模板分析器
- 动态爬虫引擎
- Python 爬虫脚本

### 7. ai-config (已有完整结构)
### 8. file-tools (已有完整结构)

---

## 模块使用示例

```typescript
// 在 src/index.ts 中使用模块
import { initRagModule } from './modules/rag-service/backend';
import { initSkillsModule } from './modules/skills-service/backend';
import { initDataSourceModule } from './modules/datasource-management/backend';
import { initAuthModule } from './modules/auth/backend';
import { initOCRModule } from './modules/ocr-service/backend';

// 初始化模块
const ragModule = initRagModule({ db: pool, aiConfigs });
const skillsModule = initSkillsModule({ autoRegister: true });
const dsModule = initDataSourceModule({ db: pool });
const authModule = initAuthModule({ pool, jwtSecret });
const ocrModule = initOCRModule({ serviceUrl: 'http://localhost:5100' });

// 注册路由
app.use('/api/rag', ragModule.routes);
app.use('/api/skills', skillsModule.routes);
app.use('/api/datasource', dsModule.routes);
app.use('/api/auth', authModule.routes);
app.use('/api/ocr', ocrModule.routes);

// 使用认证中间件
app.use('/api/protected', authModule.authMiddleware, protectedRoutes);
```

---

## 模块标准结构

```
modules/<module-name>/
├── module.json           # 必需：模块配置
├── README.md             # 推荐：模块说明
├── backend/
│   ├── index.ts          # 必需：模块入口（导出 initXxxModule）
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

## 迁移完成！

所有核心模块已完成迁移：
- ✅ 代码从 `src` 复制到 `modules`
- ✅ 每个模块有独立的入口、路由、服务、类型
- ✅ 添加了 README 文档
- ✅ 代码已推送到 GitHub
