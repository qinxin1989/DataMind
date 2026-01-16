/**
 * MCP (Model Context Protocol) 模块入口
 * 统一管理 MCP 注册中心和内置工具服务器
 */

export * from './registry';
export * from './servers/calculator';
export * from './servers/datetime';
export * from './servers/formatter';
export * from './servers/textFormatter';
export * from './servers/pptServer';

// 导入并初始化
import { mcpRegistry } from './registry';
import { calculatorServer } from './servers/calculator';
import { datetimeServer } from './servers/datetime';
import { formatterServer } from './servers/formatter';
import { textFormatterServer } from './servers/textFormatter';
import { pptServer } from './servers/pptServer';

// 注册所有内置服务器
mcpRegistry.registerServer(calculatorServer);
mcpRegistry.registerServer(datetimeServer);
mcpRegistry.registerServer(formatterServer);
mcpRegistry.registerServer(textFormatterServer);
mcpRegistry.registerServer(pptServer);

console.log('[MCP] Registered built-in servers:', mcpRegistry.getAllTools().length, 'tools');

export { mcpRegistry };
