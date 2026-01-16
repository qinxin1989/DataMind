/**
 * AI 管理服务测试
 * Property 12: AI Usage Statistics Accuracy
 * Property 13: AI Provider Configuration Isolation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { AIConfigService } from '../../src/admin/modules/ai/aiConfigService';
import { AIStatsService } from '../../src/admin/modules/ai/aiStatsService';
import type { AIProviderType as AIProvider } from '../../src/admin/types';

describe('AIConfigService', () => {
  let aiConfigService: AIConfigService;

  beforeEach(() => {
    aiConfigService = new AIConfigService();
    aiConfigService.clearAll();
  });

  afterEach(() => {
    aiConfigService.clearAll();
  });

  // Property 13: AI Provider Configuration Isolation
  describe('Property 13: AI Provider Configuration Isolation', () => {
    it('should create independent configurations for different providers', async () => {
      const openaiConfig = await aiConfigService.createProviderConfig({
        name: 'OpenAI GPT-4',
        provider: 'openai',
        apiKey: 'sk-test-openai-key',
        model: 'gpt-4',
        maxTokens: 4096,
        temperature: 0.7,
        isDefault: true,
        status: 'active',
      });

      const qwenConfig = await aiConfigService.createProviderConfig({
        name: 'Qwen',
        provider: 'qwen',
        apiKey: 'qwen-test-api-key-12345',
        model: 'qwen-turbo',
        maxTokens: 2048,
        temperature: 0.5,
        isDefault: false,
        status: 'active',
      });

      expect(openaiConfig.id).not.toBe(qwenConfig.id);
      expect(openaiConfig.provider).toBe('openai');
      expect(qwenConfig.provider).toBe('qwen');
      expect(openaiConfig.apiKey).not.toBe(qwenConfig.apiKey);
    });

    it('should have only one default provider', async () => {
      await aiConfigService.createProviderConfig({
        name: 'Config 1',
        provider: 'openai',
        apiKey: 'sk-key1',
        model: 'gpt-4',
        maxTokens: 2048,
        temperature: 0.7,
        isDefault: true,
        status: 'active',
      });

      await aiConfigService.createProviderConfig({
        name: 'Config 2',
        provider: 'qwen',
        apiKey: 'qwen-key-12345678901234',
        model: 'qwen-turbo',
        maxTokens: 2048,
        temperature: 0.7,
        isDefault: true,
        status: 'active',
      });

      const configs = await aiConfigService.getProviderConfigs();
      const defaultConfigs = configs.filter(c => c.isDefault);
      expect(defaultConfigs.length).toBe(1);
      expect(defaultConfigs[0].name).toBe('Config 2');
    });

    it('should update configuration independently', async () => {
      const config1 = await aiConfigService.createProviderConfig({
        name: 'Config 1',
        provider: 'openai',
        apiKey: 'sk-key1',
        model: 'gpt-4',
        maxTokens: 2048,
        temperature: 0.7,
        isDefault: false,
        status: 'active',
      });

      const config2 = await aiConfigService.createProviderConfig({
        name: 'Config 2',
        provider: 'qwen',
        apiKey: 'qwen-key-12345678901234',
        model: 'qwen-turbo',
        maxTokens: 2048,
        temperature: 0.7,
        isDefault: false,
        status: 'active',
      });

      // 更新 config1
      await aiConfigService.updateProviderConfig(config1.id, { temperature: 0.9 });

      // config2 应该不受影响
      const updated2 = await aiConfigService.getProviderConfigById(config2.id);
      expect(updated2?.temperature).toBe(0.7);
    });
  });

  describe('Basic CRUD Operations', () => {
    it('should create and retrieve config', async () => {
      const config = await aiConfigService.createProviderConfig({
        name: 'Test Config',
        provider: 'openai',
        apiKey: 'sk-test-key',
        model: 'gpt-4',
        maxTokens: 2048,
        temperature: 0.7,
        isDefault: false,
        status: 'active',
      });

      expect(config.id).toBeDefined();
      expect(config.name).toBe('Test Config');

      const retrieved = await aiConfigService.getProviderConfigById(config.id);
      expect(retrieved?.name).toBe('Test Config');
    });

    it('should update config', async () => {
      const config = await aiConfigService.createProviderConfig({
        name: 'Original',
        provider: 'openai',
        apiKey: 'sk-key',
        model: 'gpt-4',
        maxTokens: 2048,
        temperature: 0.7,
        isDefault: false,
        status: 'active',
      });

      const updated = await aiConfigService.updateProviderConfig(config.id, {
        name: 'Updated',
        maxTokens: 4096,
      });

      expect(updated.name).toBe('Updated');
      expect(updated.maxTokens).toBe(4096);
    });

    it('should delete config', async () => {
      const config = await aiConfigService.createProviderConfig({
        name: 'To Delete',
        provider: 'openai',
        apiKey: 'sk-key',
        model: 'gpt-4',
        maxTokens: 2048,
        temperature: 0.7,
        isDefault: false,
        status: 'active',
      });

      await aiConfigService.deleteProviderConfig(config.id);

      const retrieved = await aiConfigService.getProviderConfigById(config.id);
      expect(retrieved).toBeNull();
    });

    it('should not delete default config', async () => {
      const config = await aiConfigService.createProviderConfig({
        name: 'Default',
        provider: 'openai',
        apiKey: 'sk-key',
        model: 'gpt-4',
        maxTokens: 2048,
        temperature: 0.7,
        isDefault: true,
        status: 'active',
      });

      await expect(aiConfigService.deleteProviderConfig(config.id)).rejects.toThrow(/默认/);
    });
  });

  describe('API Key Validation', () => {
    it('should validate OpenAI key format', async () => {
      const valid = await aiConfigService.validateApiKey('openai', 'sk-valid-key');
      expect(valid.valid).toBe(true);

      const invalid = await aiConfigService.validateApiKey('openai', 'invalid-key');
      expect(invalid.valid).toBe(false);
    });

    it('should require endpoint for Azure', async () => {
      const withoutEndpoint = await aiConfigService.validateApiKey('azure', 'azure-key-123');
      expect(withoutEndpoint.valid).toBe(false);

      const withEndpoint = await aiConfigService.validateApiKey('azure', 'azure-key-123', 'https://api.azure.com');
      expect(withEndpoint.valid).toBe(true);
    });

    it('should require endpoint for custom provider', async () => {
      const withoutEndpoint = await aiConfigService.validateApiKey('custom', 'custom-key');
      expect(withoutEndpoint.valid).toBe(false);

      const withEndpoint = await aiConfigService.validateApiKey('custom', 'custom-key', 'https://custom.api.com');
      expect(withEndpoint.valid).toBe(true);
    });
  });
});

describe('AIStatsService', () => {
  let aiStatsService: AIStatsService;

  beforeEach(() => {
    aiStatsService = new AIStatsService();
    aiStatsService.clearAll();
  });

  afterEach(() => {
    aiStatsService.clearAll();
  });

  // Property 12: AI Usage Statistics Accuracy
  describe('Property 12: AI Usage Statistics Accuracy', () => {
    it('should calculate total requests correctly', async () => {
      const now = Date.now();
      
      // 记录 5 个对话
      for (let i = 0; i < 5; i++) {
        await aiStatsService.recordConversation({
          userId: 'user-1',
          datasourceId: 'ds-1',
          question: `Question ${i}`,
          answer: `Answer ${i}`,
          tokensUsed: 100,
          responseTime: 500,
        });
      }

      const stats = await aiStatsService.getUsageStats(now - 60000, now + 60000);
      expect(stats.totalRequests).toBe(5);
    });

    it('should calculate total tokens correctly', async () => {
      const now = Date.now();
      const tokenCounts = [100, 200, 300, 150, 250];
      
      for (const tokens of tokenCounts) {
        await aiStatsService.recordConversation({
          userId: 'user-1',
          datasourceId: 'ds-1',
          question: 'Q',
          answer: 'A',
          tokensUsed: tokens,
          responseTime: 500,
        });
      }

      const stats = await aiStatsService.getUsageStats(now - 60000, now + 60000);
      const expectedTotal = tokenCounts.reduce((a, b) => a + b, 0);
      expect(stats.totalTokens).toBe(expectedTotal);
    });

    it('should aggregate by day correctly', async () => {
      const now = Date.now();
      
      // 记录多个对话
      for (let i = 0; i < 3; i++) {
        await aiStatsService.recordConversation({
          userId: 'user-1',
          datasourceId: 'ds-1',
          question: 'Q',
          answer: 'A',
          tokensUsed: 100,
          responseTime: 500,
        });
      }

      const stats = await aiStatsService.getUsageStats(now - 60000, now + 60000);
      
      // 所有对话应该在同一天
      expect(stats.requestsByDay.length).toBe(1);
      expect(stats.requestsByDay[0].count).toBe(3);
      expect(stats.tokensByDay[0].tokens).toBe(300);
    });

    it('should track top users correctly', async () => {
      const now = Date.now();
      
      // user-1: 3 requests
      for (let i = 0; i < 3; i++) {
        await aiStatsService.recordConversation({
          userId: 'user-1',
          datasourceId: 'ds-1',
          question: 'Q',
          answer: 'A',
          tokensUsed: 100,
          responseTime: 500,
        });
      }
      
      // user-2: 5 requests
      for (let i = 0; i < 5; i++) {
        await aiStatsService.recordConversation({
          userId: 'user-2',
          datasourceId: 'ds-1',
          question: 'Q',
          answer: 'A',
          tokensUsed: 100,
          responseTime: 500,
        });
      }

      const stats = await aiStatsService.getUsageStats(now - 60000, now + 60000);
      
      expect(stats.topUsers.length).toBe(2);
      expect(stats.topUsers[0].userId).toBe('user-2');
      expect(stats.topUsers[0].requests).toBe(5);
      expect(stats.topUsers[1].userId).toBe('user-1');
      expect(stats.topUsers[1].requests).toBe(3);
    });
  });

  describe('Conversation Management', () => {
    it('should record and retrieve conversation', async () => {
      const conv = await aiStatsService.recordConversation({
        userId: 'user-1',
        datasourceId: 'ds-1',
        question: 'What is SQL?',
        answer: 'SQL is...',
        sql: 'SELECT * FROM table',
        tokensUsed: 150,
        responseTime: 800,
      });

      expect(conv.id).toBeDefined();
      expect(conv.createdAt).toBeDefined();

      const retrieved = await aiStatsService.getConversationById('user-1', conv.id);
      expect(retrieved?.question).toBe('What is SQL?');
    });

    it('should query conversations with filters', async () => {
      await aiStatsService.recordConversation({
        userId: 'user-1',
        datasourceId: 'ds-1',
        question: 'Question about sales',
        answer: 'Answer',
        tokensUsed: 100,
        responseTime: 500,
      });

      await aiStatsService.recordConversation({
        userId: 'user-2',
        datasourceId: 'ds-2',
        question: 'Question about orders',
        answer: 'Answer',
        tokensUsed: 100,
        responseTime: 500,
      });

      // 按用户过滤
      const user1Result = await aiStatsService.queryConversations({
        userId: 'user-1',
        page: 1,
        pageSize: 10,
      });
      expect(user1Result.list.length).toBe(1);
      expect(user1Result.list[0].userId).toBe('user-1');

      // 按关键词过滤
      const salesResult = await aiStatsService.queryConversations({
        keyword: 'sales',
        page: 1,
        pageSize: 10,
      });
      expect(salesResult.list.length).toBe(1);
    });

    it('should delete conversation', async () => {
      const conv = await aiStatsService.recordConversation({
        userId: 'user-1',
        datasourceId: 'ds-1',
        question: 'Q',
        answer: 'A',
        tokensUsed: 100,
        responseTime: 500,
      });

      await aiStatsService.deleteConversation('user-1', conv.id);

      const retrieved = await aiStatsService.getConversationById('user-1', conv.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('User Statistics', () => {
    it('should calculate user stats correctly', async () => {
      const now = Date.now();
      
      await aiStatsService.recordConversation({
        userId: 'user-1',
        datasourceId: 'ds-1',
        question: 'Q1',
        answer: 'A1',
        tokensUsed: 100,
        responseTime: 500,
      });

      await aiStatsService.recordConversation({
        userId: 'user-1',
        datasourceId: 'ds-1',
        question: 'Q2',
        answer: 'A2',
        tokensUsed: 200,
        responseTime: 700,
      });

      const stats = await aiStatsService.getUserStats('user-1', now - 60000, now + 60000);
      
      expect(stats.totalRequests).toBe(2);
      expect(stats.totalTokens).toBe(300);
      expect(stats.avgResponseTime).toBe(600);
    });
  });

  // Property-based tests
  describe('Property-based Tests', () => {
    it('Property 12: stats should match sum of individual records', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              tokensUsed: fc.nat(1000),
              responseTime: fc.nat(5000),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (records) => {
            aiStatsService.clearAll();
            const now = Date.now();

            for (const record of records) {
              await aiStatsService.recordConversation({
                userId: 'test-user',
                datasourceId: 'ds-1',
                question: 'Q',
                answer: 'A',
                tokensUsed: record.tokensUsed,
                responseTime: record.responseTime,
              });
            }

            const stats = await aiStatsService.getUsageStats(now - 60000, now + 60000);
            const expectedTokens = records.reduce((sum, r) => sum + r.tokensUsed, 0);
            
            expect(stats.totalRequests).toBe(records.length);
            expect(stats.totalTokens).toBe(expectedTokens);
          }
        ),
        { numRuns: 5 }
      );
    });

    it('Property 13: each config should be independently modifiable', async () => {
      const aiConfigService = new AIConfigService();
      aiConfigService.clearAll();

      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 20 }),
              provider: fc.constantFrom<AIProvider>('openai', 'qwen', 'azure', 'siliconflow', 'custom'),
              temperature: fc.float({ min: 0, max: 1 }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (configData) => {
            aiConfigService.clearAll();

            const configs = [];
            for (let i = 0; i < configData.length; i++) {
              const config = await aiConfigService.createProviderConfig({
                name: configData[i].name,
                provider: configData[i].provider,
                apiKey: configData[i].provider === 'openai' ? 'sk-test' : 'test-key-12345678901234',
                apiEndpoint: configData[i].provider === 'azure' || configData[i].provider === 'custom' 
                  ? 'https://api.test.com' : undefined,
                model: 'test-model',
                maxTokens: 2048,
                temperature: configData[i].temperature,
                isDefault: i === 0,
                status: 'active',
              });
              configs.push(config);
            }

            // 更新第一个配置
            if (configs.length > 0) {
              await aiConfigService.updateProviderConfig(configs[0].id, { maxTokens: 4096 });
            }

            // 验证其他配置未受影响
            for (let i = 1; i < configs.length; i++) {
              const retrieved = await aiConfigService.getProviderConfigById(configs[i].id);
              expect(retrieved?.maxTokens).toBe(2048);
            }
          }
        ),
        { numRuns: 5 }
      );

      aiConfigService.clearAll();
    });
  });
});
