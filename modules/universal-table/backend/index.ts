import type { ModuleContext } from '../../../src/module-system/types';
import { UniversalTableService } from './service';

export async function initialize(context: ModuleContext) {
  const service = new UniversalTableService(context.db);
  await service.initTables();

  return {
    service,
  };
}

export { UniversalTableService } from './service';
export * from './types';
