/**
 * 系统配置模块服务测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SystemConfigService } from '../../../modules/system-config/backend/service';
import type { CreateConfigRequest, UpdateConfigRequest } from '../../../modules/system-config/backend/types';

// 模拟数据库
class MockDatabase {
  private data: Map<string, any> = new Map();
  private tables: Map<string, any[]> = new Map();

  constructor() {
    this.tables.set('system_configs', []);
  }

  async get(query: string, params: any[] = []): Promise<any> {
    if (query.includes('SELECT') && query.includes('WHERE config_key')) {
      const key = params[0];
      const table = this.tables.get('system_configs') || [];
      return table.find((row: any) => row.config_key === key);
    }
    if (query.includes('COUNT(*)')) {
      const table = this.tables.get('system_configs') || [];
      return { count: table.length };
    }
    return null;
  }

  async all(query: string, params: any[] = []): Promise<any[]> {
    const table = this.tables.get('system_configs') || [];
    
    if (query.includes('WHERE config_group')) {
      const group = params[0];
      return table.filter((row: any) => row.config_group === group);
    }
    
    if (query.includes('DISTINCT config_group')) {
      const groups = new Set(table.map((row: any) => row.config_group));
      return Array.from(groups).map(g => ({ config_group: g }));
    }
    
    return table;
  }

  async run(query: string, params: any[] = []): Promise<void> {
    const table = this.tables.get('system_configs') || [];
    
    if (query.includes('INSERT INTO')) {
      const [id, key, value, type, description, group, editable, createdAt, updatedAt] = params;
      table.push({
        id,
        config_key: key,
        config_value: value,
        value_type: type,
        description,
        config_group: group,
        is_editable: editable,
        created_at: createdAt,
        updated_at: updatedAt
      });
    } else if (query.includes('UPDATE')) {
      const [value, updatedAt, key] = params;
      const row = table.find((r: any) => r.config_key === key);
      if (row) {
        row.config_value = value;
        row.updated_at = updatedAt;
      }
    } else if (query.includes('DELETE')) {
      const key = params[0];
      const index = table.findIndex((r: any) => r.config_key === key);
      if (index !== -1) {
        table.splice(index, 1);
      }
    }
    
    this.tables.set('system_configs', table);
  }

  clear() {
    this.tables.set('system_configs', []);
  }
}

describe('SystemConfigService', () => {
  let service: SystemConfigService;
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
    service = new SystemConfigService(db);
  });

  afterEach(() => {
    db.clear();
  });

  describe('配置管理', () => {
    it('应该创建配置', async () => {
      const request: CreateConfigRequest = {
        key: 'test.key',
        value: 'test value',
        type: 'string',
        description: '测试配置',
        group: 'test',
        editable: true
      };

      const config = await service.createConfig(request);

      expect(config).toBeDefined();
      expect(config.key).toBe('test.key');
      expect(config.value).toBe('test value');
      expect(config.type).toBe('string');
      expect(config.group).toBe('test');
    });

    it('应该拒绝创建重复的配置', async () => {
      const request: CreateConfigRequest = {
        key: 'test.key',
        value: 'test value',
        type: 'string',
        description: '测试配置',
        group: 'test'
      };

      await service.createConfig(request);
      await expect(service.createConfig(request)).rejects.toThrow('配置项已存在');
    });

    it('应该获取配置列表', async () => {
      await service.createConfig({
        key: 'test.key1',
        value: 'value1',
        type: 'string',
        description: '配置1',
        group: 'test'
      });

      await service.createConfig({
        key: 'test.key2',
        value: 'value2',
        type: 'string',
        description: '配置2',
        group: 'test'
      });

      const configs = await service.getConfigs();
      expect(configs).toHaveLength(2);
    });

    it('应该按分组过滤配置', async () => {
      await service.createConfig({
        key: 'test.key1',
        value: 'value1',
        type: 'string',
        description: '配置1',
        group: 'group1'
      });

      await service.createConfig({
        key: 'test.key2',
        value: 'value2',
        type: 'string',
        description: '配置2',
        group: 'group2'
      });

      const configs = await service.getConfigs({ group: 'group1' });
      expect(configs).toHaveLength(1);
      expect(configs[0].group).toBe('group1');
    });

    it('应该获取单个配置', async () => {
      await service.createConfig({
        key: 'test.key',
        value: 'test value',
        type: 'string',
        description: '测试配置',
        group: 'test'
      });

      const config = await service.getConfig('test.key');
      expect(config).toBeDefined();
      expect(config?.key).toBe('test.key');
    });

    it('应该更新配置', async () => {
      await service.createConfig({
        key: 'test.key',
        value: 'old value',
        type: 'string',
        description: '测试配置',
        group: 'test',
        editable: true
      });

      const request: UpdateConfigRequest = {
        value: 'new value'
      };

      const updated = await service.updateConfig('test.key', request);
      expect(updated.value).toBe('new value');
    });

    it('应该拒绝更新不可编辑的配置', async () => {
      await service.createConfig({
        key: 'test.key',
        value: 'value',
        type: 'string',
        description: '测试配置',
        group: 'test',
        editable: false
      });

      await expect(
        service.updateConfig('test.key', { value: 'new value' })
      ).rejects.toThrow('不可编辑');
    });

    it('应该删除配置', async () => {
      await service.createConfig({
        key: 'test.key',
        value: 'value',
        type: 'string',
        description: '测试配置',
        group: 'test',
        editable: true
      });

      await service.deleteConfig('test.key');
      const config = await service.getConfig('test.key');
      expect(config).toBeNull();
    });

    it('应该拒绝删除不可编辑的配置', async () => {
      await service.createConfig({
        key: 'test.key',
        value: 'value',
        type: 'string',
        description: '测试配置',
        group: 'test',
        editable: false
      });

      await expect(service.deleteConfig('test.key')).rejects.toThrow('不可删除');
    });

    it('应该获取配置分组列表', async () => {
      await service.createConfig({
        key: 'test.key1',
        value: 'value1',
        type: 'string',
        description: '配置1',
        group: 'group1'
      });

      await service.createConfig({
        key: 'test.key2',
        value: 'value2',
        type: 'string',
        description: '配置2',
        group: 'group2'
      });

      const groups = await service.getConfigGroups();
      expect(groups).toContain('group1');
      expect(groups).toContain('group2');
    });
  });

  describe('配置值类型', () => {
    it('应该正确解析字符串类型', async () => {
      await service.createConfig({
        key: 'test.string',
        value: 'hello',
        type: 'string',
        description: '字符串配置',
        group: 'test'
      });

      const value = await service.getConfigValue<string>('test.string');
      expect(value).toBe('hello');
      expect(typeof value).toBe('string');
    });

    it('应该正确解析数字类型', async () => {
      await service.createConfig({
        key: 'test.number',
        value: '123',
        type: 'number',
        description: '数字配置',
        group: 'test'
      });

      const value = await service.getConfigValue<number>('test.number');
      expect(value).toBe(123);
      expect(typeof value).toBe('number');
    });

    it('应该正确解析布尔类型', async () => {
      await service.createConfig({
        key: 'test.boolean',
        value: 'true',
        type: 'boolean',
        description: '布尔配置',
        group: 'test'
      });

      const value = await service.getConfigValue<boolean>('test.boolean');
      expect(value).toBe(true);
      expect(typeof value).toBe('boolean');
    });

    it('应该正确解析JSON类型', async () => {
      await service.createConfig({
        key: 'test.json',
        value: '{"key":"value"}',
        type: 'json',
        description: 'JSON配置',
        group: 'test'
      });

      const value = await service.getConfigValue<any>('test.json');
      expect(value).toEqual({ key: 'value' });
    });

    it('应该验证数字类型的值', async () => {
      await expect(
        service.createConfig({
          key: 'test.number',
          value: 'not a number',
          type: 'number',
          description: '数字配置',
          group: 'test'
        })
      ).rejects.toThrow('值必须是数字');
    });

    it('应该验证布尔类型的值', async () => {
      await expect(
        service.createConfig({
          key: 'test.boolean',
          value: 'not a boolean',
          type: 'boolean',
          description: '布尔配置',
          group: 'test'
        })
      ).rejects.toThrow('值必须是 true 或 false');
    });

    it('应该验证JSON类型的值', async () => {
      await expect(
        service.createConfig({
          key: 'test.json',
          value: 'invalid json',
          type: 'json',
          description: 'JSON配置',
          group: 'test'
        })
      ).rejects.toThrow('值必须是有效的 JSON');
    });
  });

  describe('系统状态', () => {
    it('应该获取系统状态', async () => {
      const status = await service.getSystemStatus();

      expect(status).toBeDefined();
      expect(status.cpu).toBeDefined();
      expect(status.cpu.cores).toBeGreaterThan(0);
      expect(status.memory).toBeDefined();
      expect(status.memory.total).toBeGreaterThan(0);
      expect(status.uptime).toBeGreaterThanOrEqual(0);
      expect(status.nodeVersion).toBeTruthy();
      expect(status.platform).toBeTruthy();
    });
  });

  describe('数据库配置', () => {
    it('应该获取数据库配置', async () => {
      const config = await service.getDbConfig();

      expect(config).toBeDefined();
      expect(config.host).toBeDefined();
      expect(config.port).toBeGreaterThan(0);
      expect(config.user).toBeDefined();
    });

    it('应该更新数据库配置', async () => {
      const updated = await service.updateDbConfig({
        host: 'newhost',
        port: 3307
      });

      expect(updated.host).toBe('newhost');
      expect(updated.port).toBe(3307);
    });
  });
});
