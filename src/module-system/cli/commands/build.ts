/**
 * build 命令实现
 * 构建模块
 */

import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface BuildOptions {
  output?: string;
  watch?: boolean;
}

export async function buildModule(moduleName: string, options: BuildOptions): Promise<void> {
  console.log(`Building module: ${moduleName}`);

  const modulePath = path.join(process.cwd(), 'modules', moduleName);
  const outputDir = options.output || 'dist';

  try {
    // 编译 TypeScript
    console.log('Compiling TypeScript...');
    await execAsync(`tsc --project ${modulePath}/tsconfig.json --outDir ${modulePath}/${outputDir}`, {
      cwd: modulePath
    });

    // 打包前端资源（如果有）
    console.log('Building frontend assets...');
    try {
      await execAsync('npm run build', { cwd: path.join(modulePath, 'frontend') });
    } catch {
      console.log('No frontend build script found, skipping...');
    }

    console.log(`✅ Module ${moduleName} built successfully`);
    console.log(`Output directory: ${modulePath}/${outputDir}`);
  } catch (error) {
    console.error(`❌ Build failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
