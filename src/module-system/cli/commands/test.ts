/**
 * test 命令实现
 * 运行模块测试
 */

import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

interface TestOptions {
  coverage?: boolean;
  watch?: boolean;
}

export async function testModule(moduleName: string, options: TestOptions): Promise<void> {
  console.log(`Running tests for module: ${moduleName}`);

  const modulePath = path.join(process.cwd(), 'modules', moduleName);
  const testPath = path.join(process.cwd(), 'tests', 'modules', moduleName);

  try {
    await fs.access(modulePath);
    await fs.access(testPath);

    let command = `npx vitest run ${testPath}`;

    if (options.coverage) {
      command += ' --coverage';
    }

    if (options.watch) {
      command = `npx vitest ${testPath} --watch${options.coverage ? ' --coverage' : ''}`;
    }

    console.log(`Executing: ${command}`);

    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });

    if (stdout) {
      console.log(stdout);
    }
    
    if (stderr) {
      console.error(stderr);
    }

    console.log(`✅ Tests completed for module ${moduleName}`);
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      console.error(`❌ 未找到模块目录或测试目录: ${moduleName}`);
      process.exit(1);
    }
    console.error(`❌ Tests failed: ${error.message}`);
    if (error.stdout) {
      console.log(error.stdout);
    }
    if (error.stderr) {
      console.error(error.stderr);
    }
    process.exit(1);
  }
}
