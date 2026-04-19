import { recreateIsolatedDatabase } from './testDatabase';

declare global {
  // eslint-disable-next-line no-var
  var __DATAMIND_VITEST_SETUP__: Promise<void> | undefined;
}

async function prepareVitestDatabase(): Promise<void> {
  await recreateIsolatedDatabase({
    envVarName: 'CONFIG_DB_TEST_NAME',
    defaultSuffix: 'vitest',
  });

  const { initAdminTables } = await import('../../src/admin/core/database');
  await initAdminTables();
}

if (!globalThis.__DATAMIND_VITEST_SETUP__) {
  globalThis.__DATAMIND_VITEST_SETUP__ = prepareVitestDatabase();
}

await globalThis.__DATAMIND_VITEST_SETUP__;

export {};
