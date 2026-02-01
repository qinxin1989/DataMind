/**
 * 系统配置模块类型定义
 */

/**
 * 配置值类型
 */
export type ConfigValueType = 'string' | 'number' | 'boolean' | 'json';

/**
 * 系统配置
 */
export interface SystemConfig {
  id: string;
  key: string;
  value: string;
  type: ConfigValueType;
  description: string;
  group: string;
  editable: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * 配置创建请求
 */
export interface CreateConfigRequest {
  key: string;
  value: string;
  type: ConfigValueType;
  description: string;
  group: string;
  editable?: boolean;
}

/**
 * 配置更新请求
 */
export interface UpdateConfigRequest {
  value: string;
}

/**
 * 配置查询参数
 */
export interface ConfigQueryParams {
  group?: string;
  key?: string;
}

/**
 * 系统状态
 */
export interface SystemStatus {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
  };
  uptime: number;
  nodeVersion: string;
  platform: string;
}

/**
 * 数据库配置
 */
export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/**
 * 数据库配置更新请求
 */
export interface UpdateDbConfigRequest {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}

/**
 * 数据库连接测试结果
 */
export interface DbConnectionTestResult {
  success: boolean;
  message: string;
  latency?: number;
}

/**
 * 模块配置
 */
export interface SystemConfigModuleConfig {
  enableMonitoring: boolean;
  monitoringInterval: number;
  maxConfigHistoryDays: number;
}
