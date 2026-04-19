/**
 * build 命令实现
 * 构建模块
 */

import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

interface BuildOptions {
  output?: string;
  watch?: boolean;
}

export async function buildModule(moduleName: string, options: BuildOptions): Promise<void> {
  console.log(`Building module: ${moduleName}`);

  const modulePath = path.join(process.cwd(), 'modules', moduleName);

  try {
    await fs.access(modulePath);
    console.log('当前仓库采用工作区级构建，开始执行 npm run build ...');

    let command = 'npm run build';
    if (options.watch) {
      command = 'npm run dev';
    }

    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024 * 10,
    });

    if (stdout) {
      console.log(stdout);
    }

    if (stderr) {
      console.error(stderr);
    }

    console.log(`✅ Module ${moduleName} build verification completed`);
  } catch (error) {
    console.error(`❌ Build failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
