/**
 * test 命令实现
 * 运行模块测试
 */

import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface TestOptions {
  coverage?: boolean;
  watch?: boolean;
}

export async function testModule(moduleName: string, options: TestOptions): Promise<void> {
  console.log(`Running tests for module: ${moduleName}`);

  const modulePath = path.join(process.cwd(), 'modules', moduleName);

  try {
    let command = 'npm test';
    
    if (options.coverage) {
      command += ' -- --coverage';
    }
    
    if (options.watch) {
      command += ' -- --watch';
    }

    console.log(`Executing: ${command}`);
    
    const { stdout, stderr } = await execAsync(command, {
      cwd: modulePath,
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
