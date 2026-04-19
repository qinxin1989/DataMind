/**
 * create 命令实现
 * 创建符合当前仓库约定的模块脚手架
 */

import * as fs from 'fs/promises';
import * as path from 'path';

interface CreateOptions {
  description?: string;
  author?: string;
  type?: 'business' | 'system' | 'tool';
  displayName?: string;
  category?: string;
}

interface ModuleMeta {
  name: string;
  displayName: string;
  description: string;
  author: string;
  type: 'business' | 'system' | 'tool';
  category: string;
  pascalName: string;
  camelName: string;
  tableName: string;
  routePrefix: string;
  permissionPrefix: string;
  modulePath: string;
  testPath: string;
}

const HOOK_NAMES = [
  'beforeInstall',
  'afterInstall',
  'beforeEnable',
  'afterEnable',
  'beforeDisable',
  'afterDisable',
  'beforeUninstall',
  'afterUninstall',
] as const;

export async function createModule(name: string, options: CreateOptions): Promise<void> {
  const normalizedName = name.trim();
  assertValidModuleName(normalizedName);

  const meta = buildModuleMeta(normalizedName, options);

  console.log(`Creating module: ${meta.name}`);
  console.log(`Target: ${meta.modulePath}`);

  try {
    await ensureTargetDoesNotExist(meta);
    await createDirectoryStructure(meta);
    await generateManifest(meta);
    await generateBackendFiles(meta);
    await generateFrontendFiles(meta);
    await generateConfigFiles(meta);
    await generateTests(meta);
    await generateReadme(meta);

    console.log(`✅ Module ${meta.name} created successfully`);
    console.log('\nRecommended next steps:');
    console.log(`  1. npm run module:validate -- ${meta.name}`);
    console.log(`  2. 完善 modules/${meta.name}/backend/service.ts 里的业务逻辑`);
    console.log(`  3. 更新 modules/${meta.name}/module.json 的菜单、权限和配置`);
    console.log(`  4. 运行 npm run module:test -- ${meta.name}`);
  } catch (error) {
    console.error(`❌ Failed to create module: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

function assertValidModuleName(name: string): void {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    throw new Error('模块名必须使用 kebab-case，例如 data-quality-center');
  }
}

function buildModuleMeta(name: string, options: CreateOptions): ModuleMeta {
  const pascalName = toPascalCase(name);
  const camelName = toCamelCase(name);

  return {
    name,
    displayName: options.displayName?.trim() || pascalName,
    description: options.description?.trim() || `${pascalName} 模块`,
    author: options.author?.trim() || 'DataMind Team',
    type: options.type || 'business',
    category: options.category?.trim() || 'general',
    pascalName,
    camelName,
    tableName: `${name.replace(/-/g, '_')}_items`,
    routePrefix: `/${name}`,
    permissionPrefix: name,
    modulePath: path.join(process.cwd(), 'modules', name),
    testPath: path.join(process.cwd(), 'tests', 'modules', name),
  };
}

function toPascalCase(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function toCamelCase(value: string): string {
  const pascal = toPascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

async function ensureTargetDoesNotExist(meta: ModuleMeta): Promise<void> {
  const targets = [meta.modulePath, meta.testPath];

  for (const target of targets) {
    try {
      await fs.access(target);
      throw new Error(`目标已存在，请先移除或更换模块名: ${target}`);
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

async function createDirectoryStructure(meta: ModuleMeta): Promise<void> {
  const directories = [
    meta.modulePath,
    path.join(meta.modulePath, 'backend'),
    path.join(meta.modulePath, 'backend', 'hooks'),
    path.join(meta.modulePath, 'backend', 'migrations'),
    path.join(meta.modulePath, 'backend', 'migrations', 'rollback'),
    path.join(meta.modulePath, 'frontend'),
    path.join(meta.modulePath, 'frontend', 'api'),
    path.join(meta.modulePath, 'frontend', 'components'),
    path.join(meta.modulePath, 'frontend', 'views'),
    path.join(meta.modulePath, 'config'),
    meta.testPath,
  ];

  for (const directory of directories) {
    await fs.mkdir(directory, { recursive: true });
  }
}

async function generateManifest(meta: ModuleMeta): Promise<void> {
  const manifest = {
    name: meta.name,
    displayName: meta.displayName,
    version: '1.0.0',
    description: meta.description,
    author: meta.author,
    license: 'MIT',
    type: meta.type,
    category: meta.category,
    tags: [meta.category],
    dependencies: {},
    backend: {
      entry: './backend/index.ts',
      routes: {
        prefix: meta.routePrefix,
        file: './backend/routes.ts',
      },
      migrations: {
        directory: './backend/migrations',
        tableName: 'module_migrations',
      },
    },
    frontend: {
      integration: 'module',
      entry: './frontend/index.ts',
      routes: './frontend/routes.ts',
      components: {
        [`${meta.pascalName}List`]: `./frontend/views/${meta.pascalName}List.vue`,
      },
    },
    menus: [
      {
        id: `${meta.name}-menu`,
        title: meta.displayName,
        path: meta.routePrefix,
        icon: 'AppstoreOutlined',
        parentId: null,
        sortOrder: 900,
        permission: `${meta.permissionPrefix}:view`,
      },
    ],
    permissions: [
      {
        code: `${meta.permissionPrefix}:view`,
        name: `查看${meta.displayName}`,
        description: `查看${meta.displayName}列表和详情`,
      },
      {
        code: `${meta.permissionPrefix}:create`,
        name: `创建${meta.displayName}`,
        description: `创建${meta.displayName}记录`,
      },
      {
        code: `${meta.permissionPrefix}:update`,
        name: `更新${meta.displayName}`,
        description: `更新${meta.displayName}记录`,
      },
      {
        code: `${meta.permissionPrefix}:delete`,
        name: `删除${meta.displayName}`,
        description: `删除${meta.displayName}记录`,
      },
    ],
    config: {
      schema: './config/schema.json',
      defaults: './config/default.json',
    },
    hooks: Object.fromEntries(
      HOOK_NAMES.map(hook => [hook, `./backend/hooks/${hook}.ts`])
    ),
    database: {
      tables: [meta.tableName],
      version: '1.0.0',
    },
    api: {
      endpoints: [
        { method: 'GET', path: meta.routePrefix, description: `获取${meta.displayName}列表`, permission: `${meta.permissionPrefix}:view` },
        { method: 'GET', path: `${meta.routePrefix}/:id`, description: `获取${meta.displayName}详情`, permission: `${meta.permissionPrefix}:view` },
        { method: 'POST', path: meta.routePrefix, description: `创建${meta.displayName}`, permission: `${meta.permissionPrefix}:create` },
        { method: 'PUT', path: `${meta.routePrefix}/:id`, description: `更新${meta.displayName}`, permission: `${meta.permissionPrefix}:update` },
        { method: 'DELETE', path: `${meta.routePrefix}/:id`, description: `删除${meta.displayName}`, permission: `${meta.permissionPrefix}:delete` },
      ],
    },
    enabled: false,
    installed: false,
  };

  await writeFile(path.join(meta.modulePath, 'module.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function generateBackendFiles(meta: ModuleMeta): Promise<void> {
  const {
    modulePath,
    name,
    displayName,
    pascalName,
    camelName,
    tableName,
    permissionPrefix,
  } = meta;

  const itemName = `${pascalName}Item`;
  const createDtoName = `Create${pascalName}Dto`;
  const updateDtoName = `Update${pascalName}Dto`;
  const listQueryName = `${pascalName}ListQuery`;
  const listResponseName = `${pascalName}ListResponse`;
  const serviceClassName = `${pascalName}Service`;
  const serviceInstanceName = `${camelName}Service`;

  await writeFile(
    path.join(modulePath, 'backend', 'index.ts'),
    `/**
 * ${displayName}模块后端入口
 */

import routes from './routes';
import { ${serviceInstanceName} } from './service';

export { routes, ${serviceInstanceName} };
export * from './types';
`
  );

  await writeFile(
    path.join(modulePath, 'backend', 'types.ts'),
    `/**
 * ${displayName}模块类型定义
 */

export interface ${itemName} {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface ${createDtoName} {
  name: string;
  description?: string;
  status?: 'active' | 'inactive';
}

export interface ${updateDtoName} {
  name?: string;
  description?: string;
  status?: 'active' | 'inactive';
}

export interface ${listQueryName} {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: 'active' | 'inactive';
}

export interface ${listResponseName} {
  items: ${itemName}[];
  total: number;
  page: number;
  pageSize: number;
}
`
  );

  await writeFile(
    path.join(modulePath, 'backend', 'service.ts'),
    `/**
 * ${displayName}模块服务
 */

import { v4 as uuidv4 } from 'uuid';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../../src/admin/core/database';
import type {
  ${itemName},
  ${createDtoName},
  ${updateDtoName},
  ${listQueryName},
  ${listResponseName},
} from './types';

type Queryable = Pick<Pool, 'query'>;

type ${pascalName}Row = RowDataPacket & {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive';
  created_at: Date;
  updated_at: Date;
};

function mapRow(row: ${pascalName}Row): ${itemName} {
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export class ${serviceClassName} {
  constructor(private db: Queryable = pool) {}

  async list(query: ${listQueryName} = {}): Promise<${listResponseName}> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    const offset = (page - 1) * pageSize;

    let sql = 'SELECT * FROM ${tableName} WHERE 1=1';
    const params: any[] = [];

    if (query.keyword) {
      sql += ' AND (name LIKE ? OR description LIKE ?)';
      const keyword = \`%\${query.keyword}%\`;
      params.push(keyword, keyword);
    }

    if (query.status) {
      sql += ' AND status = ?';
      params.push(query.status);
    }

    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) AS total');
    const [countRows] = await this.db.query<RowDataPacket[]>(countSql, params);
    const total = Number(countRows[0]?.total || 0);

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const [rows] = await this.db.query<${pascalName}Row[]>(sql, params);

    return {
      items: rows.map(mapRow),
      total,
      page,
      pageSize,
    };
  }

  async getById(id: string): Promise<${itemName} | null> {
    const [rows] = await this.db.query<${pascalName}Row[]>(
      'SELECT * FROM ${tableName} WHERE id = ?',
      [id]
    );

    return rows[0] ? mapRow(rows[0]) : null;
  }

  async create(data: ${createDtoName}): Promise<${itemName}> {
    const trimmedName = data.name?.trim();
    if (!trimmedName) {
      throw new Error('名称不能为空');
    }

    const id = uuidv4();
    const now = new Date();

    await this.db.query<ResultSetHeader>(
      \`INSERT INTO ${tableName} (id, name, description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)\`,
      [
        id,
        trimmedName,
        data.description || null,
        data.status || 'active',
        now,
        now,
      ]
    );

    const created = await this.getById(id);
    if (!created) {
      throw new Error('创建记录失败');
    }

    return created;
  }

  async update(id: string, data: ${updateDtoName}): Promise<${itemName}> {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      const trimmedName = data.name.trim();
      if (!trimmedName) {
        throw new Error('名称不能为空');
      }
      updates.push('name = ?');
      params.push(trimmedName);
    }

    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description || null);
    }

    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }

    if (updates.length === 0) {
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error('${displayName}不存在');
      }
      return existing;
    }

    updates.push('updated_at = ?');
    params.push(new Date(), id);

    const [result] = await this.db.query<ResultSetHeader>(
      \`UPDATE ${tableName} SET \${updates.join(', ')} WHERE id = ?\`,
      params
    );

    if (result.affectedRows === 0) {
      throw new Error('${displayName}不存在');
    }

    const updated = await this.getById(id);
    if (!updated) {
      throw new Error('更新记录失败');
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    const [result] = await this.db.query<ResultSetHeader>(
      'DELETE FROM ${tableName} WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      throw new Error('${displayName}不存在');
    }
  }
}

export const ${serviceInstanceName} = new ${serviceClassName}();
`
  );

  await writeFile(
    path.join(modulePath, 'backend', 'routes.ts'),
    `/**
 * ${displayName}模块路由
 */

import { Router, type Request, type Response } from 'express';
import { requirePermission } from '../../../src/admin/middleware/permission';
import { success, error } from '../../../src/admin/utils/response';
import { ${serviceInstanceName} } from './service';
import type { ${createDtoName}, ${listQueryName}, ${updateDtoName} } from './types';

const router = Router();

router.get('/', requirePermission('${permissionPrefix}:view'), async (req: Request, res: Response) => {
  try {
    const query: ${listQueryName} = {
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
      keyword: req.query.keyword as string | undefined,
      status: req.query.status as 'active' | 'inactive' | undefined,
    };

    const data = await ${serviceInstanceName}.list(query);
    res.json(success(data));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

router.get('/:id', requirePermission('${permissionPrefix}:view'), async (req: Request, res: Response) => {
  try {
    const item = await ${serviceInstanceName}.getById(req.params.id);
    if (!item) {
      return res.status(404).json(error('RES_NOT_FOUND', '${displayName}不存在'));
    }

    res.json(success(item));
  } catch (err: any) {
    res.status(500).json(error('SYS_INTERNAL_ERROR', err.message));
  }
});

router.post('/', requirePermission('${permissionPrefix}:create'), async (req: Request, res: Response) => {
  try {
    const payload: ${createDtoName} = req.body;
    const item = await ${serviceInstanceName}.create(payload);
    res.status(201).json(success(item));
  } catch (err: any) {
    const status = err.message.includes('不能为空') ? 400 : 500;
    res.status(status).json(error('BIZ_OPERATION_FAILED', err.message));
  }
});

router.put('/:id', requirePermission('${permissionPrefix}:update'), async (req: Request, res: Response) => {
  try {
    const payload: ${updateDtoName} = req.body;
    const item = await ${serviceInstanceName}.update(req.params.id, payload);
    res.json(success(item));
  } catch (err: any) {
    const status = err.message.includes('不存在') ? 404 : err.message.includes('不能为空') ? 400 : 500;
    res.status(status).json(error('BIZ_OPERATION_FAILED', err.message));
  }
});

router.delete('/:id', requirePermission('${permissionPrefix}:delete'), async (req: Request, res: Response) => {
  try {
    await ${serviceInstanceName}.delete(req.params.id);
    res.json(success(true));
  } catch (err: any) {
    const status = err.message.includes('不存在') ? 404 : 500;
    res.status(status).json(error('BIZ_OPERATION_FAILED', err.message));
  }
});

export default router;
`
  );

  await writeFile(
    path.join(modulePath, 'backend', 'migrations', '001_initial.sql'),
    `CREATE TABLE IF NOT EXISTS ${tableName} (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_${name.replace(/-/g, '_')}_status (status),
  INDEX idx_${name.replace(/-/g, '_')}_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
`
  );

  await writeFile(
    path.join(modulePath, 'backend', 'migrations', 'rollback', '001_initial.sql'),
    `DROP TABLE IF EXISTS ${tableName};
`
  );

  for (const hookName of HOOK_NAMES) {
    await writeFile(
      path.join(modulePath, 'backend', 'hooks', `${hookName}.ts`),
      `/**
 * ${hookName} 生命周期钩子
 */

export default async function ${hookName}(): Promise<void> {
  console.log('[${name}] ${hookName}');
}
`
    );
  }
}

async function generateFrontendFiles(meta: ModuleMeta): Promise<void> {
  const { modulePath, name, displayName, pascalName, camelName } = meta;
  const itemName = `${pascalName}Item`;
  const createDtoName = `Create${pascalName}Dto`;
  const updateDtoName = `Update${pascalName}Dto`;
  const listQueryName = `${pascalName}ListQuery`;
  const listResponseName = `${pascalName}ListResponse`;

  await writeFile(
    path.join(modulePath, 'frontend', 'index.ts'),
    `/**
 * ${displayName}模块前端入口
 */

import routes from './routes';

export { routes };
export const components = {
  ${pascalName}List: () => import('./views/${pascalName}List.vue'),
};
`
  );

  await writeFile(
    path.join(modulePath, 'frontend', 'routes.ts'),
    `/**
 * ${displayName}模块前端路由
 */

import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/${name}',
    name: '${pascalName}',
    component: () => import('./views/${pascalName}List.vue'),
    meta: {
      title: '${displayName}',
      permission: '${name}:view',
      icon: 'AppstoreOutlined',
    },
  },
];

export default routes;
export { routes };
`
  );

  await writeFile(
    path.join(modulePath, 'frontend', 'api', 'index.ts'),
    `/**
 * ${displayName}模块 API
 */

import axios from 'axios';
import type {
  ${itemName},
  ${createDtoName},
  ${updateDtoName},
  ${listQueryName},
  ${listResponseName},
} from '../../backend/types';

const API_BASE = '/api/${name}';

export const ${camelName}Api = {
  async list(query?: ${listQueryName}): Promise<${listResponseName}> {
    const { data } = await axios.get(API_BASE, { params: query });
    return data.data;
  },

  async getById(id: string): Promise<${itemName}> {
    const { data } = await axios.get(\`\${API_BASE}/\${id}\`);
    return data.data;
  },

  async create(payload: ${createDtoName}): Promise<${itemName}> {
    const { data } = await axios.post(API_BASE, payload);
    return data.data;
  },

  async update(id: string, payload: ${updateDtoName}): Promise<${itemName}> {
    const { data } = await axios.put(\`\${API_BASE}/\${id}\`, payload);
    return data.data;
  },

  async delete(id: string): Promise<void> {
    await axios.delete(\`\${API_BASE}/\${id}\`);
  },
};
`
  );

  await writeFile(
    path.join(modulePath, 'frontend', 'views', `${pascalName}List.vue`),
    `<template>
  <section class="${name}-page">
    <header class="${name}-header">
      <div>
        <h1>${displayName}</h1>
        <p>这是 ${displayName} 模块的默认页面骨架，可以直接替换为业务界面。</p>
      </div>
      <button type="button" @click="loadItems" :disabled="loading">
        {{ loading ? '加载中...' : '刷新' }}
      </button>
    </header>

    <ul v-if="items.length" class="${name}-list">
      <li v-for="item in items" :key="item.id">
        <strong>{{ item.name }}</strong>
        <span>{{ item.status }}</span>
      </li>
    </ul>

    <p v-else class="${name}-empty">暂无数据，可以先完善 service 和 API。</p>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { ${itemName} } from '../../backend/types';
import { ${camelName}Api } from '../api';

const loading = ref(false);
const items = ref<${itemName}[]>([]);

async function loadItems() {
  loading.value = true;

  try {
    const result = await ${camelName}Api.list();
    items.value = result.items;
  } catch (error) {
    console.error('加载${displayName}失败:', error);
  } finally {
    loading.value = false;
  }
}

onMounted(loadItems);
</script>

<style scoped>
.${name}-page {
  padding: 24px;
}

.${name}-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.${name}-list {
  display: grid;
  gap: 12px;
  padding: 0;
  list-style: none;
}

.${name}-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #ffffff;
}

.${name}-empty {
  color: #6b7280;
}
</style>
`
  );
}

async function generateConfigFiles(meta: ModuleMeta): Promise<void> {
  await writeFile(
    path.join(meta.modulePath, 'config', 'default.json'),
    `${JSON.stringify(
      {
        pageSize: 20,
        enableAudit: true,
        allowBatchOperation: false,
      },
      null,
      2
    )}\n`
  );

  await writeFile(
    path.join(meta.modulePath, 'config', 'schema.json'),
    `${JSON.stringify(
      {
        type: 'object',
        properties: {
          pageSize: {
            type: 'integer',
            minimum: 1,
            maximum: 200,
          },
          enableAudit: {
            type: 'boolean',
          },
          allowBatchOperation: {
            type: 'boolean',
          },
        },
        required: ['pageSize', 'enableAudit', 'allowBatchOperation'],
        additionalProperties: false,
      },
      null,
      2
    )}\n`
  );
}

async function generateTests(meta: ModuleMeta): Promise<void> {
  const { testPath, modulePath, name, displayName, pascalName } = meta;
  const serviceClassName = `${pascalName}Service`;
  const itemName = `${pascalName}Item`;

  await writeFile(
    path.join(testPath, 'service.test.ts'),
    `/**
 * ${displayName}模块服务测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Pool } from 'mysql2/promise';
import { ${serviceClassName} } from '../../../modules/${name}/backend/service';
import type { ${itemName} } from '../../../modules/${name}/backend/types';

const mockDb = {
  query: vi.fn(),
} as unknown as Pick<Pool, 'query'>;

describe('${serviceClassName}', () => {
  let service: ${serviceClassName};

  beforeEach(() => {
    service = new ${serviceClassName}(mockDb);
    vi.clearAllMocks();
  });

  it('应该返回列表结果', async () => {
    vi.mocked(mockDb.query).mockResolvedValueOnce([[{ total: 1 }], []] as any);
    vi.mocked(mockDb.query).mockResolvedValueOnce([
      [
        {
          id: '1',
          name: '示例记录',
          description: '描述',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      [],
    ] as any);

    const result = await service.list();

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('示例记录');
  });

  it('应该创建记录', async () => {
    vi.mocked(mockDb.query).mockResolvedValueOnce([{ affectedRows: 1 }, []] as any);
    vi.mocked(mockDb.query).mockResolvedValueOnce([
      [
        {
          id: '1',
          name: '新记录',
          description: null,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      [],
    ] as any);

    const result = await service.create({ name: '新记录' });

    expect(result.name).toBe('新记录');
    expect(mockDb.query).toHaveBeenCalled();
  });
});
`
  );
}

async function generateReadme(meta: ModuleMeta): Promise<void> {
  await writeFile(
    path.join(meta.modulePath, 'README.md'),
    `# ${meta.displayName}

${meta.description}

## 开发定位

- 模块目录：\`modules/${meta.name}\`
- 模块测试：\`tests/modules/${meta.name}\`
- 路由前缀：\`${meta.routePrefix}\`
- 权限前缀：\`${meta.permissionPrefix}\`

## 建议开发流程

1. 完善 \`module.json\` 中的菜单、权限、配置和 API 描述。
2. 在 \`backend/service.ts\` 中补业务逻辑，优先保持服务类内聚。
3. 在 \`backend/routes.ts\` 中补接口校验和权限控制。
4. 在 \`frontend/\` 内补页面和 API 调用。
5. 在 \`tests/modules/${meta.name}/service.test.ts\` 中补齐模块测试。

## 常用命令

\`\`\`bash
npm run module:validate -- ${meta.name}
npm run module:test -- ${meta.name}
\`\`\`
`
  );
}

async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, 'utf8');
}
