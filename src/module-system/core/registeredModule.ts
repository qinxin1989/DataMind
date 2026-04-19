import { existsSync } from 'fs';
import { join } from 'path';

export function getModuleManifestPath(moduleName: string, modulesDir = join(process.cwd(), 'modules')): string {
  return join(modulesDir, moduleName, 'module.json');
}

export function isRegisteredModuleName(moduleName?: string | null, modulesDir = join(process.cwd(), 'modules')): boolean {
  if (!moduleName) {
    return false;
  }

  return existsSync(getModuleManifestPath(moduleName, modulesDir));
}
