/**
 * 系统配置服务
 */

import { v4 as uuidv4 } from 'uuid';
import * as os from 'os';
import * as mysql from 'mysql2/promise';
import type {
  SystemConfig,
  CreateConfigRequest,
  UpdateConfigRequest,
  ConfigQueryParams,
  SystemStatus,
  DbConfig,
  UpdateDbConfigRequest,
  DbConnectionTestResult,
  SystemConfigModuleConfig
} from './types';

export class SystemConfigService {
  private db: any;
  private config: SystemConfigModuleConfig;

  constructor(db: any, config?: Partial<SystemConfigModuleConfig>) {
    this.db = db;
    this.config = {
      enableMonitoring: true,
      monitoringInterval: 30000,
      maxConfigHistoryDays: 90,
      ...config
    };
  }

  // ==================== 配置管理 ====================

  /**
   * 获取配置列表
   */
  async getConfigs(params: ConfigQueryParams = {}): Promise<SystemConfig[]> {
    let query = 'SELECT * FROM system_configs';
    const conditions: string[] = [];
    const values: any[] = [];

    if (params.group) {
      conditions.push('config_group = ?');
      values.push(params.group);
    }

    if (params.key) {
      conditions.push('config_key = ?');
      values.push(params.key);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY config_group, config_key';

    const queryParams = values.map(v => v === undefined ? null : v);
    const [rows]: any = await this.db.execute(query, queryParams);
    return rows.map((row: any) => this.mapRowToConfig(row));
  }

  /**
   * 获取单个配置
   */
  async getConfig(key: string): Promise<SystemConfig | null> {
    const query = 'SELECT * FROM system_configs WHERE config_key = ?';
    const [rows]: any = await this.db.execute(query, [key]);
    return rows.length > 0 ? this.mapRowToConfig(rows[0]) : null;
  }

  /**
   * 获取配置值
   */
  async getConfigValue<T = any>(key: string): Promise<T | null> {
    const config = await this.getConfig(key);
    if (!config) return null;

    return this.parseConfigValue<T>(config.value, config.type);
  }

  /**
   * 创建配置
   */
  async createConfig(request: CreateConfigRequest): Promise<SystemConfig> {
    // 检查配置是否已存在
    const existing = await this.getConfig(request.key);
    if (existing) {
      throw new Error('配置项已存在');
    }

    // 验证值类型
    this.validateConfigValue(request.value, request.type);

    const id = uuidv4();
    const now = Date.now();

    const query = `
      INSERT INTO system_configs 
      (id, config_key, config_value, value_type, description, config_group, is_editable, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db.execute(query, [
      id,
      request.key,
      request.value,
      request.type,
      request.description ?? null,
      request.group ?? null,
      request.editable !== false ? 1 : 0,
      new Date(now),
      new Date(now)
    ]);

    const config = await this.getConfig(request.key);
    if (!config) {
      throw new Error('创建配置失败');
    }

    return config;
  }

  /**
   * 更新配置
   */
  async updateConfig(key: string, request: UpdateConfigRequest): Promise<SystemConfig> {
    const config = await this.getConfig(key);
    if (!config) {
      throw new Error('配置项不存在');
    }

    if (!config.editable) {
      throw new Error('该配置项不可编辑');
    }

    // 验证值类型
    this.validateConfigValue(request.value, config.type);

    const now = Date.now();
    const query = 'UPDATE system_configs SET config_value = ?, updated_at = ? WHERE config_key = ?';
    await this.db.execute(query, [request.value, new Date(now), key]);

    const updated = await this.getConfig(key);
    if (!updated) {
      throw new Error('更新配置失败');
    }

    return updated;
  }

  /**
   * 删除配置
   */
  async deleteConfig(key: string): Promise<void> {
    const config = await this.getConfig(key);
    if (!config) {
      throw new Error('配置项不存在');
    }

    if (!config.editable) {
      throw new Error('该配置项不可删除');
    }

    const query = 'DELETE FROM system_configs WHERE config_key = ?';
    await this.db.execute(query, [key]);
  }

  /**
   * 获取配置分组列表
   */
  async getConfigGroups(): Promise<string[]> {
    const query = 'SELECT DISTINCT config_group FROM system_configs ORDER BY config_group';
    const [rows]: any = await this.db.execute(query);
    return rows.map((row: any) => row.config_group);
  }

  // ==================== 系统状态监控 ====================

  /**
   * 获取系统状态
   */
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
        cores: cpus.length
      },
      memory: {
        total: totalMemory,
        used: totalMemory - freeMemory,
        free: freeMemory
      },
      disk: {
        // 简化实现，实际应该使用 diskusage 等库
        total: 0,
        used: 0,
        free: 0
      },
      uptime: os.uptime(),
      nodeVersion: process.version,
      platform: os.platform()
    };
  }

  // ==================== 数据库配置管理 ====================

  /**
   * 获取数据库配置
   */
  async getDbConfig(): Promise<DbConfig> {
    return {
      host: process.env.CONFIG_DB_HOST || 'localhost',
      port: parseInt(process.env.CONFIG_DB_PORT || '3306', 10),
      user: process.env.CONFIG_DB_USER || 'root',
      password: process.env.CONFIG_DB_PASSWORD || '',
      database: process.env.CONFIG_DB_NAME || ''
    };
  }

  /**
   * 更新数据库配置
   */
  async updateDbConfig(request: UpdateDbConfigRequest): Promise<DbConfig> {
    // 注意：这里只是返回更新后的配置，实际的环境变量更新需要重启服务
    const current = await this.getDbConfig();

    const updated: DbConfig = {
      host: request.host || current.host,
      port: request.port || current.port,
      user: request.user || current.user,
      password: request.password || current.password,
      database: request.database || current.database
    };

    // TODO: 实际项目中应该更新 .env 文件或配置管理系统
    // 这里只是演示，实际需要实现环境变量持久化

    return updated;
  }

  /**
   * 测试数据库连接
   */
  async testDbConnection(config: DbConfig): Promise<DbConnectionTestResult> {
    const startTime = Date.now();

    try {
      const connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.database
      });

      await connection.ping();
      await connection.end();

      const latency = Date.now() - startTime;

      return {
        success: true,
        message: '连接成功',
        latency
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || '连接失败'
      };
    }
  }

  // ==================== 辅助方法 ====================

  /**
   * 映射数据库行到配置对象
   */
  private mapRowToConfig(row: any): SystemConfig {
    return {
      id: row.id,
      key: row.config_key,
      value: row.config_value,
      type: row.value_type,
      description: row.description,
      group: row.config_group,
      editable: Boolean(row.is_editable),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * 解析配置值
   */
  private parseConfigValue<T>(value: string, type: string): T {
    switch (type) {
      case 'number':
        return parseFloat(value) as T;
      case 'boolean':
        return (value === 'true') as T;
      case 'json':
        return JSON.parse(value) as T;
      default:
        return value as T;
    }
  }

  /**
   * 验证配置值
   */
  private validateConfigValue(value: string, type: string): void {
    switch (type) {
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
  }
}
