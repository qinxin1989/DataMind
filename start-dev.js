#!/usr/bin/env node

/**
 * 开发环境启动脚本
 * 绕过TypeScript编译问题，直接运行
 */

require('ts-node/register');
require('./src/index.ts');