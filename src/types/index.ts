// 数据源类型
export type DataSourceType = 'mysql' | 'postgres' | 'sqlite' | 'file' | 'api';

// 数据源配置
export interface DataSourceConfig {
  id: string;
  name: string;
  type: DataSourceType;
  config: DatabaseConfig | FileConfig | ApiConfig;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface FileConfig {
  path: string;
  fileType: 'csv' | 'xlsx' | 'json';
}

export interface ApiConfig {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  params?: Record<string, string>;
}

// 表结构信息
export interface TableSchema {
  tableName: string;
  columns: ColumnInfo[];
  sampleData?: Record<string, any>[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey?: boolean;
  comment?: string;
}

// 查询结果
export interface QueryResult {
  success: boolean;
  data?: any[];
  sql?: string;
  error?: string;
  rowCount?: number;
}

// AI响应
export interface AIResponse {
  answer: string;
  sql?: string;
  data?: any[];
  explanation?: string;
}

// Agent 响应（扩展 AI 响应）
export interface AgentResponse extends AIResponse {
  skillUsed?: string;
  toolUsed?: string;
  visualization?: VisualizationConfig;
}

// 可视化配置
export interface VisualizationConfig {
  type: 'table' | 'bar' | 'line' | 'pie' | 'scatter';
  title?: string;
  xField?: string;
  yField?: string;
  data: any[];
}

// 技能定义
export interface SkillDefinition {
  name: string;
  description: string;
  parameters: SkillParameter[];
}

export interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  required: boolean;
}

// MCP 工具定义
export interface MCPToolDefinition {
  server: string;
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}
