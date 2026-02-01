/**
 * create 命令实现
 * 创建模块脚手架
 */

import * as fs from 'fs/promises';
import * as path from 'path';

interface CreateOptions {
  description?: string;
  author?: string;
  type?: 'business' | 'system' | 'tool';
}

export async function createModule(name: string, options: CreateOptions): Promise<void> {
  console.log(`Creating module: ${name}`);

  const modulePath = path.join(process.cwd(), 'modules', name);

  try {
    // 创建目录结构
    await createDirectoryStructure(modulePath);

    // 生成 module.json
    await generateManifest(modulePath, name, options);

    // 生成后端文件
    await generateBackendFiles(modulePath, name);

    // 生成前端文件
    await generateFrontendFiles(modulePath, name);

    // 生成 README
    await generateReadme(modulePath, name, options);

    console.log(`✅ Module ${name} created successfully at ${modulePath}`);
    console.log('\nNext steps:');
    console.log(`  cd modules/${name}`);
    console.log('  npm install');
    console.log('  npm run dev');
  } catch (error) {
    console.error(`❌ Failed to create module: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

async function createDirectoryStructure(modulePath: string): Promise<void> {
  const dirs = [
    modulePath,
    path.join(modulePath, 'backend'),
    path.join(modulePath, 'backend', 'migrations'),
    path.join(modulePath, 'backend', 'migrations', 'rollback'),
    path.join(modulePath, 'backend', 'hooks'),
    path.join(modulePath, 'frontend'),
    path.join(modulePath, 'frontend', 'views'),
    path.join(modulePath, 'frontend', 'components'),
    path.join(modulePath, 'frontend', 'api'),
    path.join(modulePath, 'config'),
    path.join(modulePath, 'tests'),
    path.join(modulePath, 'tests', 'backend'),
    path.join(modulePath, 'tests', 'frontend'),
    path.join(modulePath, 'docs')
  ];

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function generateManifest(modulePath: string, name: string, options: CreateOptions): Promise<void> {
  const manifest = {
    name,
    displayName: name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    version: '1.0.0',
    description: options.description || `${name} module`,
    author: options.author || 'Your Name',
    license: 'MIT',
    type: options.type || 'business',
    category: 'general',
    tags: [],
    dependencies: {},
    backend: {
      entry: './backend/index.ts',
      routes: {
        prefix: `/${name}`,
        file: './backend/routes.ts'
      },
      migrations: {
        directory: './backend/migrations'
      }
    },
    frontend: {
      entry: './frontend/index.ts',
      routes: './frontend/routes.ts'
    },
    menus: [],
    permissions: [],
    hooks: {
      beforeInstall: './backend/hooks/beforeInstall.ts',
      afterInstall: './backend/hooks/afterInstall.ts',
      beforeEnable: './backend/hooks/beforeEnable.ts',
      afterEnable: './backend/hooks/afterEnable.ts',
      beforeDisable: './backend/hooks/beforeDisable.ts',
      afterDisable: './backend/hooks/afterDisable.ts',
      beforeUninstall: './backend/hooks/beforeUninstall.ts',
      afterUninstall: './backend/hooks/afterUninstall.ts'
    }
  };

  await fs.writeFile(
    path.join(modulePath, 'module.json'),
    JSON.stringify(manifest, null, 2)
  );
}

async function generateBackendFiles(modulePath: string, name: string): Promise<void> {
  // backend/index.ts
  const indexContent = `/**
 * ${name} module backend entry
 */

export { router } from './routes';
export { service } from './service';
`;

  await fs.writeFile(path.join(modulePath, 'backend', 'index.ts'), indexContent);

  // backend/routes.ts
  const routesContent = `/**
 * ${name} module routes
 */

import { Router } from 'express';
import { service } from './service';

export const router = Router();

// GET /${name}
router.get('/', async (req, res) => {
  try {
    const data = await service.list();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /${name}
router.post('/', async (req, res) => {
  try {
    const data = await service.create(req.body);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
`;

  await fs.writeFile(path.join(modulePath, 'backend', 'routes.ts'), routesContent);

  // backend/service.ts
  const serviceContent = `/**
 * ${name} module service
 */

export const service = {
  async list() {
    // TODO: Implement list logic
    return [];
  },

  async create(data: any) {
    // TODO: Implement create logic
    return data;
  },

  async update(id: string, data: any) {
    // TODO: Implement update logic
    return data;
  },

  async delete(id: string) {
    // TODO: Implement delete logic
    return true;
  }
};
`;

  await fs.writeFile(path.join(modulePath, 'backend', 'service.ts'), serviceContent);

  // 生成钩子文件
  const hookNames = ['beforeInstall', 'afterInstall', 'beforeEnable', 'afterEnable', 
                     'beforeDisable', 'afterDisable', 'beforeUninstall', 'afterUninstall'];
  
  for (const hookName of hookNames) {
    const hookContent = `/**
 * ${hookName} hook
 */

export default async function ${hookName}(): Promise<void> {
  console.log('${hookName} hook executed for ${name}');
  // TODO: Implement ${hookName} logic
}
`;
    await fs.writeFile(path.join(modulePath, 'backend', 'hooks', `${hookName}.ts`), hookContent);
  }
}

async function generateFrontendFiles(modulePath: string, name: string): Promise<void> {
  // frontend/index.ts
  const indexContent = `/**
 * ${name} module frontend entry
 */

export { routes } from './routes';
`;

  await fs.writeFile(path.join(modulePath, 'frontend', 'index.ts'), indexContent);

  // frontend/routes.ts
  const routesContent = `/**
 * ${name} module routes
 */

export const routes = [
  {
    path: '/${name}',
    name: '${name}',
    component: () => import('./views/Index.vue'),
    meta: {
      title: '${name}',
      permission: '${name}:view'
    }
  }
];
`;

  await fs.writeFile(path.join(modulePath, 'frontend', 'routes.ts'), routesContent);

  // frontend/views/Index.vue
  const viewContent = `<template>
  <div class="${name}-container">
    <h1>${name}</h1>
    <p>Welcome to ${name} module</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const data = ref([]);

onMounted(async () => {
  // TODO: Load data
});
</script>

<style scoped>
.${name}-container {
  padding: 20px;
}
</style>
`;

  await fs.writeFile(path.join(modulePath, 'frontend', 'views', 'Index.vue'), viewContent);
}

async function generateReadme(modulePath: string, name: string, options: CreateOptions): Promise<void> {
  const readmeContent = `# ${name}

${options.description || `${name} module`}

## Installation

\`\`\`bash
npm install
\`\`\`

## Development

\`\`\`bash
npm run dev
\`\`\`

## Build

\`\`\`bash
npm run build
\`\`\`

## Test

\`\`\`bash
npm test
\`\`\`

## License

MIT
`;

  await fs.writeFile(path.join(modulePath, 'README.md'), readmeContent);
}
