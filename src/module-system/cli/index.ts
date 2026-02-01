#!/usr/bin/env node
/**
 * 模块 CLI 工具
 * 提供模块创建、构建、验证等命令
 */

import { Command } from 'commander';
import { createModule } from './commands/create';
import { buildModule } from './commands/build';
import { validateModule } from './commands/validate';
import { testModule } from './commands/test';

const program = new Command();

program
  .name('module-cli')
  .description('CLI tool for module management')
  .version('1.0.0');

// create 命令
program
  .command('create <name>')
  .description('Create a new module with standard structure')
  .option('-d, --description <description>', 'Module description')
  .option('-a, --author <author>', 'Module author')
  .option('-t, --type <type>', 'Module type (business|system|tool)', 'business')
  .action(createModule);

// build 命令
program
  .command('build <module>')
  .description('Build a module')
  .option('-o, --output <dir>', 'Output directory', 'dist')
  .option('-w, --watch', 'Watch mode')
  .action(buildModule);

// validate 命令
program
  .command('validate <module>')
  .description('Validate module structure and manifest')
  .option('-s, --strict', 'Strict validation mode')
  .action(validateModule);

// test 命令
program
  .command('test <module>')
  .description('Run module tests')
  .option('-c, --coverage', 'Generate coverage report')
  .option('-w, --watch', 'Watch mode')
  .action(testModule);

program.parse();
