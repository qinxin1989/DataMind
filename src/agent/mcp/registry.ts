/**
 * MCP Registry - MCP 工具注册中心
 * 管理所有 MCP 服务器和工具的注册与调用
 */

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
  handler: (input: Record<string, any>) => Promise<MCPToolResult>;
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface MCPServer {
  name: string;
  description: string;
  tools: MCPTool[];
}

export class MCPRegistry {
  private servers = new Map<string, MCPServer>();
  private tools = new Map<string, { server: string; tool: MCPTool }>();

  // 注册 MCP 服务器
  registerServer(server: MCPServer) {
    this.servers.set(server.name, server);
    for (const tool of server.tools) {
      this.tools.set(`${server.name}__${tool.name}`, { server: server.name, tool });
    }
    console.log(`[MCP] Registered server: ${server.name} with ${server.tools.length} tools`);
  }

  // 获取所有可用工具
  getAllTools(): Array<{ serverName: string; tool: MCPTool }> {
    return Array.from(this.tools.values()).map(({ server, tool }) => ({
      serverName: server,
      tool
    }));
  }

  // 获取服务器
  getServer(name: string): MCPServer | undefined {
    return this.servers.get(name);
  }

  // 获取所有服务器
  getAllServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  // 调用工具
  async callTool(serverName: string, toolName: string, input: Record<string, any>): Promise<MCPToolResult> {
    const key = `${serverName}__${toolName}`;
    const entry = this.tools.get(key);
    
    if (!entry) {
      return {
        content: [{ type: 'text', text: `工具 ${toolName} 不存在` }],
        isError: true
      };
    }

    try {
      return await entry.tool.handler(input);
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `工具执行失败: ${error.message}` }],
        isError: true
      };
    }
  }

  // 获取工具描述（供AI选择）
  getToolDescriptions(): string {
    const tools = this.getAllTools();
    if (tools.length === 0) return '暂无可用的MCP工具';
    
    return tools.map(({ serverName, tool }) => {
      const params = Object.entries(tool.inputSchema.properties)
        .map(([name, schema]) => `${name}(${schema.type}): ${schema.description}`)
        .join('; ');
      return `- [${serverName}] ${tool.name}: ${tool.description}\n  参数: ${params}`;
    }).join('\n');
  }
}

// 全局 MCP 注册中心实例
export const mcpRegistry = new MCPRegistry();
