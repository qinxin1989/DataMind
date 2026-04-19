#!/usr/bin/env node
/**
 * 模块 CLI 工具
 * 提供模块创建、构建、验证、测试等命令
 */

import { buildModule } from './commands/build';
import { createModule } from './commands/create';
import { testModule } from './commands/test';
import { validateModule } from './commands/validate';

type CommandName = 'create' | 'build' | 'validate' | 'test';

type ParsedOptions = Record<string, string | boolean>;

interface ParsedArgs {
  command?: CommandName;
  moduleName?: string;
  options: ParsedOptions;
}

const OPTION_ALIASES: Record<string, string> = {
  d: 'description',
  a: 'author',
  t: 'type',
  o: 'output',
  w: 'watch',
  s: 'strict',
  c: 'coverage',
};

function printHelp(): void {
  console.log(`
DataMind 模块 CLI

用法:
  npm run module:create -- <name> [options]
  npm run module:validate -- <name> [options]
  npm run module:test -- <name> [options]
  npm run module:build -- <name> [options]

命令:
  create     创建新的模块脚手架
  validate   验证模块结构和 manifest
  test       运行模块测试
  build      构建并验证整个工作区中的模块集成

create 选项:
  --display-name <name>    模块显示名称
  --description <text>     模块描述
  --author <name>          模块作者
  --type <type>            模块类型: business | system | tool
  --category <name>        模块分类

test 选项:
  --coverage               生成覆盖率
  --watch                  监听模式

validate 选项:
  --strict                 严格模式

build 选项:
  --watch                  监听模式
  --output <dir>           兼容保留字段，当前不会单独输出模块目录
`);
}

function printVersion(): void {
  console.log('module-cli 1.0.0');
}

function parseArgs(argv: string[]): ParsedArgs {
  const [commandArg, moduleName, ...rest] = argv;
  const options: ParsedOptions = {};

  for (let index = 0; index < rest.length; index++) {
    const token = rest[index];
    if (!token.startsWith('-')) {
      continue;
    }

    const normalizedToken = token.replace(/^-+/, '');
    const optionKey = OPTION_ALIASES[normalizedToken] || toCamelCase(normalizedToken);
    const next = rest[index + 1];

    if (!next || next.startsWith('-')) {
      options[optionKey] = true;
      continue;
    }

    options[optionKey] = next;
    index += 1;
  }

  return {
    command: commandArg as CommandName | undefined,
    moduleName,
    options,
  };
}

function toCamelCase(input: string): string {
  return input.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function requireModuleName(moduleName: string | undefined, command: string): string {
  if (!moduleName) {
    throw new Error(`${command} 命令需要提供模块名`);
  }

  return moduleName;
}

function readStringOption(options: ParsedOptions, key: string): string | undefined {
  const value = options[key];
  return typeof value === 'string' ? value : undefined;
}

function readBooleanOption(options: ParsedOptions, key: string): boolean {
  return options[key] === true;
}

function normalizeType(value: string | undefined): 'business' | 'system' | 'tool' | undefined {
  if (!value) {
    return undefined;
  }

  if (value === 'business' || value === 'system' || value === 'tool') {
    return value;
  }

  throw new Error(`不支持的模块类型: ${value}`);
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);

  if (rawArgs.length === 0 || rawArgs.includes('--help') || rawArgs.includes('-h') || rawArgs[0] === 'help') {
    printHelp();
    return;
  }

  if (rawArgs.includes('--version') || rawArgs.includes('-v')) {
    printVersion();
    return;
  }

  const { command, moduleName, options } = parseArgs(rawArgs);

  switch (command) {
    case 'create':
      await createModule(requireModuleName(moduleName, 'create'), {
        displayName: readStringOption(options, 'displayName'),
        description: readStringOption(options, 'description'),
        author: readStringOption(options, 'author'),
        category: readStringOption(options, 'category'),
        type: normalizeType(readStringOption(options, 'type')),
      });
      return;
    case 'validate':
      await validateModule(requireModuleName(moduleName, 'validate'), {
        strict: readBooleanOption(options, 'strict'),
      });
      return;
    case 'test':
      await testModule(requireModuleName(moduleName, 'test'), {
        coverage: readBooleanOption(options, 'coverage'),
        watch: readBooleanOption(options, 'watch'),
      });
      return;
    case 'build':
      await buildModule(requireModuleName(moduleName, 'build'), {
        output: readStringOption(options, 'output'),
        watch: readBooleanOption(options, 'watch'),
      });
      return;
    default:
      throw new Error(`未知命令: ${command || '(empty)'}`);
  }
}

main().catch(error => {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
