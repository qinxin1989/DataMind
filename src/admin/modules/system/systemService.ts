/**
 * 系统配置服务
 * 实现系统配置管理和状态监控
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const DATA_DIR = path.join(process.cwd(), 'data');
const SYSTEM_CONFIGS_FILE = path.join(DATA_DIR, 'system-configs.json');

export interface SystemConfig {
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  description: string;
  group: string;
  editable: boolean;
}

export interface SystemStatus {
  cpu: { usage: number; cores: number };
  memory: { total: number; used: number; free: number };
  disk: { total: number; used: number; free: number };
  uptime: number;
  nodeVersion: string;
  platform: string;
}

export class SystemService {
  private configs: Map<string, SystemConfig> = new Map();

  constructor() {
    this.loadData();
    this.initDefaultConfigs();
  }

  private loadData(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(SYSTEM_CONFIGS_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(SYSTEM_CONFIGS_FILE, 'utf-8'));
        data.forEach((config: SystemConfig) => this.configs.set(config.key, config));
      } catch {
        // 文件为空或格式错误
      }
    }
  }

  private saveData(): void {
    fs.writeFileSync(SYSTEM_CONFIGS_FILE, JSON.stringify(Array.from(this.configs.values()), null, 2));
  }

  private initDefaultConfigs(): void {
    const defaults: SystemConfig[] = [
      { key: 'site.name', value: 'AI 数据平台', type: 'string', description: '站点名称', group: 'site', editable: true },
      { key: 'site.logo', value: '/logo.png', type: 'string', description: '站点 Logo', group: 'site', editable: true },
      { key: 'site.description', value: '智能数据分析平台', type: 'string', description: '站点描述', group: 'site', editable: true },
      { key: 'security.sessionTimeout', value: '3600', type: 'number', description: '会话超时时间(秒)', group: 'security', editable: true },
      { key: 'security.maxLoginAttempts', value: '5', type: 'number', description: '最大登录尝试次数', group: 'security', editable: true },
      { key: 'security.passwordMinLength', value: '8', type: 'number', description: '密码最小长度', group: 'security', editable: true },
      { key: 'upload.maxFileSize', value: '10485760', type: 'number', description: '最大上传文件大小(字节)', group: 'upload', editable: true },
      { key: 'upload.allowedTypes', value: '["csv","xlsx","json"]', type: 'json', description: '允许的文件类型', group: 'upload', editable: true },
      { key: 'ai.defaultProvider', value: 'qwen', type: 'string', description: '默认 AI 提供商', group: 'ai', editable: true },
      { key: 'ai.maxTokensPerRequest', value: '4096', type: 'number', description: '每次请求最大 Token 数', group: 'ai', editable: true },
    ];

    for (const config of defaults) {
      if (!this.configs.has(config.key)) {
        this.configs.set(config.key, config);
      }
    }
    this.saveData();
  }

  // ==================== 配置管理 ====================

  async getConfigs(group?: string): Promise<SystemConfig[]> {
    const configs = Array.from(this.configs.values());
    if (group) {
      return configs.filter(c => c.group === group);
    }
    return configs;
  }

  async getConfig(key: string): Promise<SystemConfig | null> {
    return this.configs.get(key) || null;
  }

  async getConfigValue<T = string>(key: string): Promise<T | null> {
    const config = this.configs.get(key);
    if (!config) return null;

    switch (config.type) {
      case 'number':
        return parseFloat(config.value) as T;
      case 'boolean':
        return (config.value === 'true') as T;
      case 'json':
        return JSON.parse(config.value) as T;
      default:
        return config.value as T;
    }
  }

  async updateConfig(key: string, value: string): Promise<SystemConfig> {
    const config = this.configs.get(key);
    if (!config) {
      throw new Error('配置项不存在');
    }
    if (!config.editable) {
      throw new Error('该配置项不可编辑');
    }

    // 验证值类型
    switch (config.type) {
      case 'number':
        if (isNaN(parseFloat(value))) {
          throw new Error('值必须是数字');
        }
        break;
      case 'boolean':
        if (value !== 'true' && value !== 'false') {
          throw new Error('值必须是 true 或 false');
        }
        break;
      case 'json':
        try {
          JSON.parse(value);
        } catch {
          throw new Error('值必须是有效的 JSON');
        }
        break;
    }

    config.value = value;
    this.configs.set(key, config);
    this.saveData();
    return config;
  }

  async createConfig(config: SystemConfig): Promise<SystemConfig> {
    if (this.configs.has(config.key)) {
      throw new Error('配置项已存在');
    }
    this.configs.set(config.key, config);
    this.saveData();
    return config;
  }

  async deleteConfig(key: string): Promise<void> {
    const config = this.configs.get(key);
    if (!config) {
      throw new Error('配置项不存在');
    }
    if (!config.editable) {
      throw new Error('该配置项不可删除');
    }
    this.configs.delete(key);
    this.saveData();
  }

  // ==================== 系统状态 ====================

  async getSystemStatus(): Promise<SystemStatus> {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();

    // CPU 使用率估算
    let cpuUsage = 0;
    for (const cpu of cpus) {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      cpuUsage += ((total - idle) / total) * 100;
    }
    cpuUsage = cpuUsage / cpus.length;

    return {
      cpu: {
        usage: Math.round(cpuUsage * 100) / 100,
        cores: cpus.length,
      },
      memory: {
        total: totalMemory,
        used: totalMemory - freeMemory,
        free: freeMemory,
      },
      disk: {
        // 简化实现，实际应该使用 diskusage 等库
        total: 0,
        used: 0,
        free: 0,
      },
      uptime: os.uptime(),
      nodeVersion: process.version,
      platform: os.platform(),
    };
  }

  // ==================== 配置组 ====================

  async getConfigGroups(): Promise<string[]> {
    const groups = new Set<string>();
    for (const config of this.configs.values()) {
      groups.add(config.group);
    }
    return Array.from(groups);
  }

  // ==================== 测试辅助 ====================

  clearAll(): void {
    this.configs.clear();
  }
}

export const systemService = new SystemService();
