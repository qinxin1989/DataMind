/**
 * validate 命令实现
 * 验证模块结构和清单
 */

import * as path from 'path';
import { ModuleScanner } from '../../core/ModuleScanner';
import { ManifestParser } from '../../core/ManifestParser';

interface ValidateOptions {
  strict?: boolean;
}

export async function validateModule(moduleName: string, options: ValidateOptions): Promise<void> {
  console.log(`Validating module: ${moduleName}`);

  const modulesDir = path.join(process.cwd(), 'modules');
  const scanner = new ModuleScanner(modulesDir);

  try {
    // 扫描模块
    const result = await scanner.scanModule(moduleName, {
      validateStructure: true
    });

    // 显示验证结果
    console.log('\n=== Validation Results ===\n');
    console.log(`Module: ${result.moduleName}`);
    console.log(`Path: ${result.path}`);
    console.log(`Valid: ${result.valid ? '✅' : '❌'}`);

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    if (result.manifest) {
      console.log('\nManifest:');
      console.log(`  Name: ${result.manifest.name}`);
      console.log(`  Version: ${result.manifest.version}`);
      console.log(`  Display Name: ${result.manifest.displayName}`);
      console.log(`  Type: ${result.manifest.type || 'N/A'}`);
      
      if (result.manifest.dependencies) {
        console.log(`  Dependencies: ${Object.keys(result.manifest.dependencies).join(', ') || 'None'}`);
      }
    }

    if (!result.valid) {
      process.exit(1);
    }

    console.log('\n✅ Module validation passed');
  } catch (error) {
    console.error(`❌ Validation failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
