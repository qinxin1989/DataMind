# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

DataMind is a natural-language data query platform (Chinese-primary UI) that connects to multiple data sources (MySQL, PostgreSQL, CSV/Excel, APIs) and uses AI (OpenAI-compatible LLMs) to convert natural language questions into SQL, generate analysis reports, BI dashboards, and more. It is a full-stack TypeScript/Node.js backend with a Vue 3 frontend admin panel.

## Build & Run Commands

### Backend (root directory)
- `npm install` — install Node.js dependencies
- `npm run dev` — start backend in dev mode (tsx watch, hot-reload)
- `npm run build` — compile TypeScript (`tsc`)
- `npm run build:prod` — build backend + admin-ui together
- `npm start` — run compiled production build (`node dist/index.js`)
- `npm run start:secure` — production mode reading encrypted `.env.encrypted`
- `npm run encrypt-env` — encrypt `.env` → `.env.encrypted`

### Frontend Admin UI (`admin-ui/`)
- `cd admin-ui && npm install && npm run dev` — Vite dev server
- `cd admin-ui && npm run build` — production build (outputs to `admin-ui/dist/`)

### OCR Service (optional, Python)
- `cd ocr-service && pip install -r requirements.txt && python app.py`

### Tests
- `npm test` — run integration API tests against a running server (`tsx tests/run-tests.ts`); requires the server to be running on port 3000
- `npx vitest` — run unit tests (vitest, files matching `tests/**/*.test.ts` and `src/**/*.test.ts`)
- `npx vitest run tests/admin/userService.test.ts` — run a single test file
- `npx vitest --coverage` — run tests with v8 coverage

### Docker
- `npm run docker:build` — build Docker image
- `npm run docker:run` / `npm run docker:stop` — start/stop via docker-compose (app + MySQL + Nginx)

## Architecture

### Two-Layer Module System
The codebase has a **core layer** (`src/`) and a **module layer** (`modules/`). Understanding both is essential.

**Core layer (`src/`):**
- `src/index.ts` — Express entry point. Initializes DB, module system, registers route bridges, starts crawlerScheduler, serves SPA.
- `src/agent/` — AI Agent: intent recognition → SQL generation → query execution → result explanation. Contains `AIAgent` class with auto-failover across multiple AI provider configs, skills registry, MCP tool registry, `AutoAnalyst`, `DashboardGenerator`, `QualityInspector`.
- `src/ai/engine.ts` — Lower-level `AIEngine` class for schema analysis and SQL generation (used independently of Agent).
- `src/datasource/` — Data source abstraction. `BaseDataSource` (abstract) → `MySQLDataSource`, `PostgresDataSource`, `FileDataSource`, `ApiDataSource`. Factory: `createDataSource(config)`.
- `src/module-system/` — Plugin architecture: `ModuleScanner` discovers modules from `modules/` dir, `ModuleRegistry` tracks them, `LifecycleManager` handles enable/disable, `BackendModuleLoader` dynamically loads backend routes/services, `BackendRouteManager` mounts Express routes, `MigrationManager` runs DB migrations, `PermissionManager` / `MenuManager` manage RBAC and menus.
- `src/admin/` — Admin framework routes mounted at `/api/admin/*`. Sub-modules: user, role, menu, audit, ai-config, system, notification, datasource, ai-qa, dashboard, crawler, file-tools, ocr, skills, rag.
- `src/rag/` — RAG knowledge base (vector store, knowledge graph, document processor, embedding service). Partially migrated to `modules/rag-service/`.
- `src/store/configStore.ts` — `ConfigStore` class wrapping MySQL pool for datasource configs, chat sessions, schema analysis. Uses the shared `pool` from `src/admin/core/database.ts`.
- `src/middleware/` — `auth.ts` (JWT auth middleware), `csrf.ts`, `rateLimiter.ts`.
- `src/services/` — Cross-cutting: `aiProviderService`, `authService` (JWT + bcrypt), `dataMasking`, `fileEncryption`, `ocrService`.
- `src/types/index.ts` — Shared TypeScript interfaces (`DataSourceConfig`, `TableSchema`, `QueryResult`, `AIResponse`, etc.).

**Module layer (`modules/`):**
Each module is a self-contained directory with a `module.json` manifest describing name, version, dependencies, backend entry/routes, frontend routes/components, menus, permissions, config schema, and lifecycle hooks.

Key modules: `ai-config`, `ai-qa`, `ai-crawler-assistant`, `ai-stats`, `audit-log`, `auth`, `crawler-management`, `crawler-template-config`, `dashboard`, `datasource-management`, `efficiency-tools`, `file-tools`, `menu-management`, `notification`, `ocr-service`, `official-doc`, `rag-service`, `role-management`, `skills-service`, `system-backup`, `system-config`, `user-management`.

Module structure convention:
```
modules/<name>/
  module.json          # manifest (required)
  backend/
    index.ts           # entry point
    routes.ts           # Express routes
    service.ts          # business logic
    migrations/         # DB migrations
  frontend/             # Vue components (optional)
  config/
    schema.json         # config validation schema
    default.json        # default config values
```

### Route Bridging Pattern
`src/index.ts` uses lazy-loaded route bridges: Express `app.use()` handlers dynamically `import()` module routes on first request. This allows modules to be loaded on-demand. Example:
```typescript
app.use('/api/auth', async (req, res, next) => {
  const { default: authRoutes } = await import('../modules/auth/backend/routes');
  authRoutes(req, res, next);
});
```

### AI Agent Flow
1. `AIAgent.answer()` — main entry point
2. Chitchat detection (pattern-based, no AI call)
3. Quality inspection mode (keyword trigger)
4. Comprehensive analysis mode (keyword trigger → `AutoAnalyst`)
5. Intent recognition via LLM (`planAction`) → determines tool: `sql`, `chitchat`, `crawler.extract`, `data.analyze`
6. SQL generation → execution → result validation → explanation generation
7. Chart data auto-generated when appropriate
8. Auto-failover: if an AI provider fails (429, timeout, auth error), automatically switches to next config in priority order

### AI Config
LLM configs are stored in database table `sys_ai_configs` (managed via admin UI). The `AIAgent` fetches configs dynamically with `configGetter` and supports hot-reload via `globalConfigVersion`.

### Frontend (admin-ui/)
Vue 3 + Vite + Ant Design Vue + Pinia. Charts via ECharts and @antv/g2plot.
- `src/api/` — API client modules
- `src/views/` — page components per feature
- `src/stores/` — Pinia stores (user, permission, notification)
- `src/router/` — Vue Router config
- `src/layouts/AdminLayout.vue` — main admin layout

### MCP Servers (`mcp-servers/`)
`mcp-servers/skills-server/` — MCP server exposing data query, document processing, media processing, and report generation tools via the Model Context Protocol SDK.

## TypeScript Path Aliases
Defined in `tsconfig.json`:
- `@/*` → `src/*`
- `@modules/*` → `modules/*`

## Environment Configuration
Copy `.env.example` to `.env`. Key variables: `CONFIG_DB_*` (MySQL connection for internal config DB), `JWT_SECRET`, `FILE_ENCRYPTION_KEY`, `MCP_API_KEY`. AI provider configs live in the database, not in `.env`.

## Key Conventions
- The codebase and UI are primarily in **Chinese** (comments, log messages, user-facing strings). Keep this consistent.
- All API routes require JWT auth via `authMiddleware` except login/register endpoints.
- Only `SELECT` queries are allowed against user data sources (safety constraint in AI SQL generation).
- Uploaded files are automatically encrypted with `fileEncryption` service.
- The module system uses topological sorting for dependency-ordered loading.
- Database migrations for modules live in `modules/<name>/backend/migrations/` and are managed by `MigrationManager`.
