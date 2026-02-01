/**
 * AI统计服务测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AIStatsService } from '../../../modules/ai-stats/backend/service';

describe('AIStatsService', () => {
  let aiStatsService: AIStatsService;

  beforeEach(async () => {
    aiStatsService = new AIStatsService();
    await aiStatsService.clearAll();
  });

  afterEach(async () => {
    await aiStatsService.clearAll();
  });

  describe('对话记录管理', () => {
    it('应该记录并检索对话', async () => {
      const conv = await aiStatsService.recordConversation({
        userId: 'user-1',
        datasourceId: 'ds-1',
        question: 'What is SQL?',
        answer: 'SQL is...',
        sqlQuery: 'SELECT * FROM table',
        tokensUsed: 150,
        responseTime: 800,
      });

      expect(conv.id).toBeDefined();
      expect(conv.createdAt).toBeDefined();

      const retrieved = await aiStatsService.getConversationById('user-1', conv.id);
      expect(retrieved?.question).toBe('What is SQL?');
      expect(retrieved?.answer).toBe('SQL is...');
      expect(retrieved?.tokensUsed).toBe(150);
    });

    it('应该删除对话', async () => {
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

    it('删除不存在的对话应该抛出错误', async () => {
      await expect(
        aiStatsService.deleteConversation('user-1', 'non-existent-id')
      ).rejects.toThrow('对话记录不存在');
    });

    it('应该记录完整的对话信息', async () => {
      const conv = await aiStatsService.recordConversation({
        userId: 'user-1',
        username: 'John',
        datasourceId: 'ds-1',
        datasourceName: 'Sales DB',
        question: 'Top products?',
        answer: 'Product A, B, C',
        sqlQuery: 'SELECT * FROM products',
        tokensUsed: 200,
        responseTime: 1000,
        status: 'success',
      });

      const retrieved = await aiStatsService.getConversationById('user-1', conv.id);
      expect(retrieved?.username).toBe('John');
      expect(retrieved?.datasourceName).toBe('Sales DB');
      expect(retrieved?.sqlQuery).toBe('SELECT * FROM products');
      expect(retrieved?.status).toBe('success');
    });
  });

  describe('对话查询', () => {
    beforeEach(async () => {
      // 准备测试数据
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

      await aiStatsService.recordConversation({
        userId: 'user-1',
        datasourceId: 'ds-1',
        question: 'Another question',
        answer: 'Another answer',
        tokensUsed: 150,
        responseTime: 600,
      });
    });

    it('应该按用户过滤', async () => {
      const result = await aiStatsService.queryConversations({
        userId: 'user-1',
        page: 1,
        pageSize: 10,
      });

      expect(result.list.length).toBe(2);
      expect(result.total).toBe(2);
      expect(result.list.every(c => c.userId === 'user-1')).toBe(true);
    });

    it('应该按数据源过滤', async () => {
      const result = await aiStatsService.queryConversations({
        datasourceId: 'ds-2',
        page: 1,
        pageSize: 10,
      });

      expect(result.list.length).toBe(1);
      expect(result.list[0].datasourceId).toBe('ds-2');
    });

    it('应该按关键词过滤', async () => {
      const result = await aiStatsService.queryConversations({
        keyword: 'sales',
        page: 1,
        pageSize: 10,
      });

      expect(result.list.length).toBe(1);
      expect(result.list[0].question).toContain('sales');
    });

    it('应该支持分页', async () => {
      const page1 = await aiStatsService.queryConversations({
        page: 1,
        pageSize: 2,
      });

      expect(page1.list.length).toBe(2);
      expect(page1.total).toBe(3);
      expect(page1.page).toBe(1);
      expect(page1.pageSize).toBe(2);

      const page2 = await aiStatsService.queryConversations({
        page: 2,
        pageSize: 2,
      });

      expect(page2.list.length).toBe(1);
      expect(page2.total).toBe(3);
    });

    it('应该按时间范围过滤', async () => {
      const now = Date.now();
      const result = await aiStatsService.queryConversations({
        startTime: now - 60000,
        endTime: now + 60000,
        page: 1,
        pageSize: 10,
      });

      expect(result.list.length).toBe(3);
    });

    it('应该组合多个过滤条件', async () => {
      const result = await aiStatsService.queryConversations({
        userId: 'user-1',
        keyword: 'sales',
        page: 1,
        pageSize: 10,
      });

      expect(result.list.length).toBe(1);
      expect(result.list[0].userId).toBe('user-1');
      expect(result.list[0].question).toContain('sales');
    });
  });

  describe('使用统计', () => {
    it('应该计算总请求数', async () => {
      const now = Date.now();
      
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

    it('应该计算总Token数', async () => {
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

    it('应该估算成本', async () => {
      const now = Date.now();
      
      await aiStatsService.recordConversation({
        userId: 'user-1',
        datasourceId: 'ds-1',
        question: 'Q',
        answer: 'A',
        tokensUsed: 1000,
        responseTime: 500,
      });

      const stats = await aiStatsService.getUsageStats(now - 60000, now + 60000);
      // 1000 tokens * $0.002 per 1K tokens = $0.002
      expect(stats.estimatedCost).toBeCloseTo(0.002, 6);
    });

    it('应该按天统计', async () => {
      const now = Date.now();
      
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
      
      expect(stats.requestsByDay.length).toBe(1);
      expect(stats.requestsByDay[0].count).toBe(3);
      expect(stats.tokensByDay[0].tokens).toBe(300);
    });

    it('应该统计Top用户', async () => {
      const now = Date.now();
      
      // user-1: 3 requests
      for (let i = 0; i < 3; i++) {
        await aiStatsService.recordConversation({
          userId: 'user-1',
          username: 'User 1',
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
          username: 'User 2',
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

    it('空时间范围应该返回空统计', async () => {
      const futureTime = Date.now() + 365 * 24 * 60 * 60 * 1000;
      const stats = await aiStatsService.getUsageStats(futureTime, futureTime + 60000);
      
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.estimatedCost).toBe(0);
      expect(stats.requestsByDay.length).toBe(0);
      expect(stats.topUsers.length).toBe(0);
    });
  });

  describe('用户统计', () => {
    it('应该计算用户统计', async () => {
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

    it('不存在的用户应该返回零统计', async () => {
      const now = Date.now();
      const stats = await aiStatsService.getUserStats('non-existent-user', now - 60000, now + 60000);
      
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.avgResponseTime).toBe(0);
    });

    it('应该只统计指定时间范围内的数据', async () => {
      const now = Date.now();
      
      await aiStatsService.recordConversation({
        userId: 'user-1',
        datasourceId: 'ds-1',
        question: 'Q',
        answer: 'A',
        tokensUsed: 100,
        responseTime: 500,
      });

      // 查询未来时间范围
      const futureStats = await aiStatsService.getUserStats(
        'user-1',
        now + 60000,
        now + 120000
      );
      
      expect(futureStats.totalRequests).toBe(0);
    });
  });

  describe('边界情况', () => {
    it('应该处理空数据库', async () => {
      const now = Date.now();
      const stats = await aiStatsService.getUsageStats(now - 60000, now + 60000);
      
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.topUsers.length).toBe(0);
    });

    it('应该处理零Token的对话', async () => {
      const now = Date.now();
      
      await aiStatsService.recordConversation({
        userId: 'user-1',
        datasourceId: 'ds-1',
        question: 'Q',
        answer: 'A',
        tokensUsed: 0,
        responseTime: 500,
      });

      const stats = await aiStatsService.getUsageStats(now - 60000, now + 60000);
      expect(stats.totalRequests).toBe(1);
      expect(stats.totalTokens).toBe(0);
      expect(stats.estimatedCost).toBe(0);
    });

    it('应该处理缺失的可选字段', async () => {
      const conv = await aiStatsService.recordConversation({
        userId: 'user-1',
        datasourceId: 'ds-1',
        question: 'Q',
        answer: 'A',
        tokensUsed: 100,
        responseTime: 500,
      });

      const retrieved = await aiStatsService.getConversationById('user-1', conv.id);
      expect(retrieved?.username).toBeUndefined();
      expect(retrieved?.datasourceName).toBeUndefined();
      expect(retrieved?.sqlQuery).toBeUndefined();
    });
  });
});
