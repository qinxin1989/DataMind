/**
 * AI配置模块服务层测试
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { pool } from '../../../src/admin/core/database';
import { AIConfigService } from '../../../modules/ai-config/backend/service';
import type { CreateAIConfigRequest } from '../../../modules/ai-config/backend/types';

describe('AI Config Service', () => {
  let service: AIConfigService;

  beforeAll(async () => {
    service = new AIConfigService(pool);
  });

  beforeEach(async () => {
    // 清空测试数据
    await service.clearAll();
  });

  afterAll(async () => {
    // 清理测试数据
    await service.clearAll();
  });

  describe('创建配置', () => {
    it('应该成功创建AI配置', async () => {
      const data: CreateAIConfigRequest = {
        name: '测试配置',
        provider: 'siliconflow',
        model: 'Qwen/Qwen3-32B',
        embeddingModel: 'BAAI/bge-large-zh-v1.5',
        apiKey: 'test-api-key-12345',
        baseUrl: 'https://api.siliconflow.cn/v1',
        isDefault: true,
        status: 'active'
      };

      const config = await service.createConfig(data);

      expect(config).toBeDefined();
      expect(config.id).toBeDefined();
      expect(config.name).toBe(data.name);
      expect(config.provider).toBe(data.provider);
      expect(config.model).toBe(data.model);
      expect(config.embeddingModel).toBe(data.embeddingModel);
      expect(config.apiKey).toBe(data.apiKey); // 解密后应该相同
      expect(config.baseUrl).toBe(data.baseUrl);
      expect(config.isDefault).toBe(true);
      expect(config.status).toBe('active');
      expect(config.priority).toBeGreaterThanOrEqual(1);
    });

    it('应该自动设置优先级', async () => {
      const config1 = await service.createConfig({
        name: '配置1',
        provider: 'siliconflow',
        model: 'Qwen/Qwen3-32B',
        apiKey: 'key1',
        status: 'active'
      });

      const config2 = await service.createConfig({
        name: '配置2',
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'key2',
        status: 'active'
      });

      expect(config2.priority).toBeGreaterThan(config1.priority);
    });

    it('创建默认配置时应该取消其他默认', async () => {
      await service.createConfig({
        name: '配置1',
        provider: 'siliconflow',
        model: 'Qwen/Qwen3-32B',
        apiKey: 'key1',
        isDefault: true,
        status: 'active'
      });

      const config2 = await service.createConfig({
        name: '配置2',
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'key2',
        isDefault: true,
        status: 'active'
      });

      const allConfigs = await service.getAllConfigs();
      const defaultConfigs = allConfigs.filter(c => c.isDefault);
      
      expect(defaultConfigs.length).toBe(1);
      expect(defaultConfigs[0].id).toBe(config2.id);
    });
  });

  describe('查询配置', () => {
    it('应该根据ID获取配置', async () => {
      const created = await service.createConfig({
        name: '测试配置',
        provider: 'siliconflow',
        model: 'Qwen/Qwen3-32B',
        apiKey: 'test-key',
        status: 'active'
      });

      const config = await service.getConfigById(created.id);

      expect(config).toBeDefined();
      expect(config?.id).toBe(created.id);
      expect(config?.name).toBe('测试配置');
    });

    it('不存在的ID应该返回null', async () => {
      const config = await service.getConfigById('non-existent-id');
      expect(config).toBeNull();
    });

    it('应该获取所有配置', async () => {
      await service.createConfig({
        name: '配置1',
        provider: 'siliconflow',
        model: 'Qwen/Qwen3-32B',
        apiKey: 'key1',
        status: 'active'
      });

      await service.createConfig({
        name: '配置2',
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'key2',
        status: 'active'
      });

      const configs = await service.getAllConfigs();
      expect(configs.length).toBe(2);
    });

    it('应该按优先级排序获取配置', async () => {
      const config1 = await service.createConfig({
        name: '配置1',
        provider: 'siliconflow',
        model: 'Qwen/Qwen3-32B',
        apiKey: 'key1',
        status: 'active'
      });

      const config2 = await service.createConfig({
        name: '配置2',
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'key2',
        status: 'active'
      });

      const configs = await service.getAllConfigs();
      expect(configs[0].priority).toBeLessThanOrEqual(configs[1].priority);
    });

    it('应该只获取激活的配置', async () => {
      await service.createConfig({
        name: '激活配置',
        provider: 'siliconflow',
        model: 'Qwen/Qwen3-32B',
        apiKey: 'key1',
        status: 'active'
      });

      await service.createConfig({
        name: '禁用配置',
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'key2',
        status: 'inactive'
      });

      const activeConfigs = await service.getActiveConfigsByPriority();
      expect(activeConfigs.length).toBe(1);
      expect(activeConfigs[0].name).toBe('激活配置');
    });

    it('应该获取默认配置', async () => {
      await service.createConfig({
        name: '非默认配置',
        provider: 'siliconflow',
        model: 'Qwen/Qwen3-32B',
        apiKey: 'key1',
        isDefault: false,
        status: 'active'
      });

      const defaultConfig = await service.createConfig({
        name: '默认配置',
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'key2',
        isDefault: true,
        status: 'active'
      });

      const config = await service.getDefaultConfig();
      expect(config).toBeDefined();
      expect(config?.id).toBe(defaultConfig.id);
      expect(config?.name).toBe('默认配置');
    });
  });

  describe('更新配置', () => {
    it('应该成功更新配置', async () => {
      const created = await service.createConfig({
        name: '原始名称',
        provider: 'siliconflow',
        model: 'Qwen/Qwen3-32B',
        apiKey: 'original-key',
        status: 'active'
      });

      const updated = await service.updateConfig(created.id, {
        name: '新名称',
        model: 'Qwen/Qwen2.5-72B-Instruct'
      });

      expect(updated.name).toBe('新名称');
      expect(updated.model).toBe('Qwen/Qwen2.5-72B-Instruct');
      expect(updated.provider).toBe('siliconflow'); // 未更新的字段保持不变
    });

    it('更新不存在的配置应该抛出错误', async () => {
      await expect(
        service.updateConfig('non-existent-id', { name: '新名称' })
      ).rejects.toThrow('AI配置不存在');
    });

    it('应该支持部分更新', async () => {
      const created = await service.createConfig({
        name: '测试配置',
        provider: 'siliconflow',
        model: 'Qwen/Qwen3-32B',
        apiKey: 'test-key',
        status: 'active'
      });

      const updated = await service.updateConfig(created.id, {
        status: 'inactive'
      });

      expect(updated.status).toBe('inactive');
      expect(updated.name).toBe('测试配置'); // 其他字段不变
    });

    it('空字符串API Key不应该更新', async () => {
      const created = await service.createConfig({
        name: '测试配置',
        provider: 'siliconflow',
        model: 'Qwen/Qwen3-32B',
        apiKey: 'original-key',
        status: 'active'
      });

      const updated = await service.updateConfig(created.id, {
        apiKey: '' // 空字符串表示不修改
      });

      expect(updated.apiKey).toBe('original-key');
    });
  });

  describe('删除配置', () => {
    it('应该成功删除配置', async () => {
      const created = await service.createConfig({
        name: '待删除配置',
        provider: 'siliconflow',
        model: 'Qwen/Qwen3-32B',
        apiKey: 'test-key',
        status: 'active'
      });

      await service.deleteConfig(created.id);

      const config = await service.getConfigById(created.id);
      expect(config).toBeNull();
    });

    it('删除不存在的配置应该抛出错误', async () => {
      await expect(
        service.deleteConfig('non-existent-id')
      ).rejects.toThrow('AI配置不存在');
    });
  });

  describe('默认配置管理', () => {
    it('应该设置默认配置', async () => {
      const config1 = await service.createConfig({
        name: '配置1',
        provider: 'siliconflow',
        model: 'Qwen/Qwen3-32B',
        apiKey: 'key1',
        isDefault: true,
        status: 'active'
      });

      const config2 = await service.createConfig({
        name: '配置2',
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'key2',
        status: 'active'
      });

      await service.setDefaultConfig(config2.id);

      const defaultConfig = await service.getDefaultConfig();
      expect(defaultConfig?.id).toBe(config2.id);

      // 验证旧的默认配置已取消
      const oldConfig = await service.getConfigById(config1.id);
      expect(oldConfig?.isDefault).toBe(false);
    });
  });

  describe('优先级管理', () => {
    it('应该更新优先级', async () => {
      const config1 = await service.createConfig({
        name: '配置1',
        provider: 'siliconflow',
        model: 'Qwen/Qwen3-32B',
        apiKey: 'key1',
        status: 'active'
      });

      const config2 = await service.createConfig({
        name: '配置2',
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'key2',
        status: 'active'
      });

      await service.updatePriorities([
        { id: config2.id, priority: 1 },
        { id: config1.id, priority: 2 }
      ]);

      const updated1 = await service.getConfigById(config1.id);
      const updated2 = await service.getConfigById(config2.id);

      expect(updated2?.priority).toBe(1);
      expect(updated1?.priority).toBe(2);
    });
  });

  describe('API Key加密', () => {
    it('API Key应该加密存储', async () => {
      const originalKey = 'test-api-key-12345';
      
      const config = await service.createConfig({
        name: '测试配置',
        provider: 'siliconflow',
        model: 'Qwen/Qwen3-32B',
        apiKey: originalKey,
        status: 'active'
      });

      // 从数据库直接查询，验证是否加密
      const [rows] = await pool.query(
        'SELECT api_key FROM sys_ai_configs WHERE id = ?',
        [config.id]
      );
      const dbKey = (rows as any[])[0].api_key;

      // 数据库中的key应该与原始key不同（已加密）
      expect(dbKey).not.toBe(originalKey);
      
      // 但通过service获取应该是解密后的原始key
      expect(config.apiKey).toBe(originalKey);
    });
  });

  describe('API Key验证', () => {
    it('应该验证API Key格式', async () => {
      const result = await service.validateApiKey({
        provider: 'siliconflow',
        apiKey: 'short',
        apiEndpoint: 'https://api.siliconflow.cn/v1'
      });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('格式不正确');
    });

    it('应该使用默认endpoint', async () => {
      const result = await service.validateApiKey({
        provider: 'siliconflow',
        apiKey: 'test-key-12345'
      });

      // 即使没有提供endpoint，也应该能执行验证（使用默认endpoint）
      expect(result).toBeDefined();
      expect(result.valid).toBeDefined();
    });
  });
});
