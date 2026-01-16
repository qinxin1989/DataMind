/**
 * 审计日志服务测试
 * Property 14: Audit Log Completeness
 * Property 15: Audit Log Search Correctness
 * Property 16: Audit Log Export Format Validity
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { AuditService } from '../../src/admin/modules/audit/auditService';
import type { AuditAction } from '../../src/admin/types';

describe('AuditService', () => {
  let auditService: AuditService;

  beforeEach(() => {
    auditService = new AuditService();
    auditService.clearAll();
  });

  afterEach(() => {
    auditService.clearAll();
  });

  // ==================== Property 14: Audit Log Completeness ====================
  describe('Property 14: Audit Log Completeness', () => {
    it('should create audit log with all required fields', async () => {
      const log = await auditService.log({
        userId: 'user-1',
        username: 'testuser',
        action: 'create',
        resourceType: 'user',
        resourceId: 'res-1',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(log.id).toBeDefined();
      expect(log.userId).toBe('user-1');
      expect(log.username).toBe('testuser');
      expect(log.action).toBe('create');
      expect(log.resourceType).toBe('user');
      expect(log.resourceId).toBe('res-1');
      expect(log.ip).toBe('192.168.1.1');
      expect(log.timestamp).toBeDefined();
      expect(log.timestamp).toBeGreaterThan(0);
    });

    it('should persist audit log and retrieve it', async () => {
      await auditService.log({
        userId: 'user-1',
        username: 'testuser',
        action: 'login',
        resourceType: 'session',
        resourceId: 'user-1',
        ip: '10.0.0.1',
        userAgent: 'Chrome',
      });

      const result = await auditService.query({ page: 1, pageSize: 10 });
      expect(result.list.length).toBe(1);
      expect(result.list[0].action).toBe('login');
    });

    it('should log all CRUD operations', async () => {
      const actions: AuditAction[] = ['create', 'read', 'update', 'delete'];
      
      for (const action of actions) {
        await auditService.log({
          userId: 'user-1',
          username: 'admin',
          action,
          resourceType: 'document',
          resourceId: `doc-${action}`,
          ip: '127.0.0.1',
          userAgent: 'Test',
        });
      }

      const result = await auditService.query({ page: 1, pageSize: 100 });
      expect(result.list.length).toBe(4);
      
      const loggedActions = result.list.map(l => l.action);
      for (const action of actions) {
        expect(loggedActions).toContain(action);
      }
    });

    it('should include old and new values for update operations', async () => {
      const oldValue = { name: 'old' };
      const newValue = { name: 'new' };

      await auditService.logUpdate(
        'user-1', 'admin', 'config', 'cfg-1',
        oldValue, newValue, '127.0.0.1', 'Test'
      );

      const result = await auditService.query({ action: 'update', page: 1, pageSize: 10 });
      expect(result.list.length).toBe(1);
      expect(result.list[0].oldValue).toBe(JSON.stringify(oldValue));
      expect(result.list[0].newValue).toBe(JSON.stringify(newValue));
    });
  });

  // ==================== Property 15: Audit Log Search Correctness ====================
  describe('Property 15: Audit Log Search Correctness', () => {
    beforeEach(async () => {
      // 创建测试数据
      await auditService.log({
        userId: 'user-1',
        username: 'alice',
        action: 'create',
        resourceType: 'user',
        resourceId: 'u-1',
        ip: '10.0.0.1',
        userAgent: 'Chrome',
      });
      await auditService.log({
        userId: 'user-2',
        username: 'bob',
        action: 'update',
        resourceType: 'menu',
        resourceId: 'm-1',
        ip: '10.0.0.2',
        userAgent: 'Firefox',
      });
      await auditService.log({
        userId: 'user-1',
        username: 'alice',
        action: 'delete',
        resourceType: 'user',
        resourceId: 'u-2',
        ip: '10.0.0.1',
        userAgent: 'Chrome',
      });
    });

    it('should filter by userId', async () => {
      const result = await auditService.query({ userId: 'user-1', page: 1, pageSize: 10 });
      expect(result.list.length).toBe(2);
      expect(result.list.every(l => l.userId === 'user-1')).toBe(true);
    });

    it('should filter by action', async () => {
      const result = await auditService.query({ action: 'create', page: 1, pageSize: 10 });
      expect(result.list.length).toBe(1);
      expect(result.list[0].action).toBe('create');
    });

    it('should filter by resourceType', async () => {
      const result = await auditService.query({ resourceType: 'user', page: 1, pageSize: 10 });
      expect(result.list.length).toBe(2);
      expect(result.list.every(l => l.resourceType === 'user')).toBe(true);
    });

    it('should filter by time range', async () => {
      const now = Date.now();
      const result = await auditService.query({
        startTime: now - 60000,
        endTime: now + 60000,
        page: 1,
        pageSize: 10,
      });
      expect(result.list.length).toBe(3);
    });

    it('should combine multiple filters', async () => {
      const result = await auditService.query({
        userId: 'user-1',
        resourceType: 'user',
        page: 1,
        pageSize: 10,
      });
      expect(result.list.length).toBe(2);
      expect(result.list.every(l => l.userId === 'user-1' && l.resourceType === 'user')).toBe(true);
    });

    it('should paginate results correctly', async () => {
      const page1 = await auditService.query({ page: 1, pageSize: 2 });
      const page2 = await auditService.query({ page: 2, pageSize: 2 });

      expect(page1.list.length).toBe(2);
      expect(page2.list.length).toBe(1);
      expect(page1.total).toBe(3);
      expect(page2.total).toBe(3);
    });

    it('should return results in descending order by timestamp', async () => {
      const result = await auditService.query({ page: 1, pageSize: 10 });
      for (let i = 1; i < result.list.length; i++) {
        expect(result.list[i - 1].timestamp).toBeGreaterThanOrEqual(result.list[i].timestamp);
      }
    });
  });

  // ==================== Property 16: Audit Log Export Format Validity ====================
  describe('Property 16: Audit Log Export Format Validity', () => {
    beforeEach(async () => {
      await auditService.log({
        userId: 'user-1',
        username: 'alice',
        action: 'create',
        resourceType: 'document',
        resourceId: 'doc-1',
        ip: '192.168.1.1',
        userAgent: 'Chrome',
      });
      await auditService.log({
        userId: 'user-2',
        username: 'bob',
        action: 'update',
        resourceType: 'document',
        resourceId: 'doc-2',
        ip: '192.168.1.2',
        userAgent: 'Firefox',
      });
    });

    it('should export valid JSON format', async () => {
      const jsonContent = await auditService.export({ page: 1, pageSize: 100 }, 'json');
      
      // 应该能解析为有效 JSON
      const parsed = JSON.parse(jsonContent);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(2);
      
      // 每条记录应包含必要字段
      for (const log of parsed) {
        expect(log.id).toBeDefined();
        expect(log.userId).toBeDefined();
        expect(log.username).toBeDefined();
        expect(log.action).toBeDefined();
        expect(log.resourceType).toBeDefined();
        expect(log.timestamp).toBeDefined();
      }
    });

    it('should export valid CSV format', async () => {
      const csvContent = await auditService.export({ page: 1, pageSize: 100 }, 'csv');
      
      const lines = csvContent.split('\n');
      expect(lines.length).toBe(3); // header + 2 data rows
      
      // 检查 header
      const headers = lines[0].split(',');
      expect(headers).toContain('ID');
      expect(headers).toContain('用户ID');
      expect(headers).toContain('用户名');
      expect(headers).toContain('操作');
      expect(headers).toContain('资源类型');
      
      // 检查数据行格式
      for (let i = 1; i < lines.length; i++) {
        const fields = lines[i].match(/"[^"]*"/g);
        expect(fields).not.toBeNull();
        expect(fields!.length).toBe(headers.length);
      }
    });

    it('should export all matching records', async () => {
      const jsonContent = await auditService.export({ userId: 'user-1', page: 1, pageSize: 100 }, 'json');
      const parsed = JSON.parse(jsonContent);
      
      expect(parsed.length).toBe(1);
      expect(parsed[0].userId).toBe('user-1');
    });
  });

  // ==================== 便捷方法测试 ====================
  describe('Convenience Methods', () => {
    it('logLogin should create login audit log', async () => {
      await auditService.logLogin('user-1', 'alice', '10.0.0.1', 'Chrome', true);
      
      const result = await auditService.query({ action: 'login', page: 1, pageSize: 10 });
      expect(result.list.length).toBe(1);
      expect(result.list[0].resourceType).toBe('session');
    });

    it('logCreate should create create audit log with newValue', async () => {
      const newValue = { name: 'test', value: 123 };
      await auditService.logCreate('user-1', 'alice', 'config', 'cfg-1', newValue, '10.0.0.1', 'Chrome');
      
      const result = await auditService.query({ action: 'create', page: 1, pageSize: 10 });
      expect(result.list.length).toBe(1);
      expect(result.list[0].newValue).toBe(JSON.stringify(newValue));
    });

    it('logDelete should create delete audit log with oldValue', async () => {
      const oldValue = { name: 'deleted', id: 'x' };
      await auditService.logDelete('user-1', 'alice', 'item', 'item-1', oldValue, '10.0.0.1', 'Chrome');
      
      const result = await auditService.query({ action: 'delete', page: 1, pageSize: 10 });
      expect(result.list.length).toBe(1);
      expect(result.list[0].oldValue).toBe(JSON.stringify(oldValue));
    });
  });

  // ==================== 统计测试 ====================
  describe('Statistics', () => {
    beforeEach(async () => {
      await auditService.log({ userId: 'user-1', username: 'alice', action: 'create', resourceType: 'a', resourceId: '1', ip: '1', userAgent: 'x' });
      await auditService.log({ userId: 'user-1', username: 'alice', action: 'create', resourceType: 'b', resourceId: '2', ip: '1', userAgent: 'x' });
      await auditService.log({ userId: 'user-2', username: 'bob', action: 'update', resourceType: 'a', resourceId: '1', ip: '2', userAgent: 'y' });
    });

    it('should calculate stats correctly', async () => {
      const now = Date.now();
      const stats = await auditService.getStats(now - 60000, now + 60000);
      
      expect(stats.totalLogs).toBe(3);
      expect(stats.byAction['create']).toBe(2);
      expect(stats.byAction['update']).toBe(1);
      expect(stats.byUser.length).toBe(2);
    });
  });

  // ==================== 用户轨迹测试 ====================
  describe('User Trail', () => {
    it('should get user operation trail', async () => {
      await auditService.log({ userId: 'user-1', username: 'alice', action: 'login', resourceType: 'session', resourceId: '1', ip: '1', userAgent: 'x' });
      await auditService.log({ userId: 'user-1', username: 'alice', action: 'create', resourceType: 'doc', resourceId: '2', ip: '1', userAgent: 'x' });
      await auditService.log({ userId: 'user-2', username: 'bob', action: 'login', resourceType: 'session', resourceId: '3', ip: '2', userAgent: 'y' });

      const now = Date.now();
      const trail = await auditService.getUserTrail('user-1', now - 60000, now + 60000);
      
      expect(trail.length).toBe(2);
      expect(trail.every(l => l.userId === 'user-1')).toBe(true);
    });
  });

  // ==================== Property-based Tests ====================
  describe('Property-based Tests', () => {
    const actionArb = fc.constantFrom<AuditAction>('login', 'logout', 'create', 'read', 'update', 'delete', 'export', 'import');
    
    it('Property 14: any logged operation should be retrievable', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 20 }),
            username: fc.string({ minLength: 1, maxLength: 20 }),
            action: actionArb,
            resourceType: fc.string({ minLength: 1, maxLength: 20 }),
            resourceId: fc.string({ minLength: 1, maxLength: 20 }),
            ip: fc.ipV4(),
            userAgent: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          async (entry) => {
            auditService.clearAll();
            
            const logged = await auditService.log(entry);
            const result = await auditService.query({ page: 1, pageSize: 100 });
            
            const found = result.list.find(l => l.id === logged.id);
            expect(found).toBeDefined();
            expect(found!.userId).toBe(entry.userId);
            expect(found!.action).toBe(entry.action);
            expect(found!.resourceType).toBe(entry.resourceType);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('Property 15: search results should match all criteria', async () => {
      await fc.assert(
        fc.asyncProperty(
          actionArb,
          fc.string({ minLength: 1, maxLength: 10 }),
          async (action, resourceType) => {
            auditService.clearAll();
            
            // 创建匹配的日志
            await auditService.log({
              userId: 'match-user',
              username: 'matcher',
              action,
              resourceType,
              resourceId: 'r1',
              ip: '1.1.1.1',
              userAgent: 'test',
            });
            
            // 创建不匹配的日志
            await auditService.log({
              userId: 'other-user',
              username: 'other',
              action: action === 'create' ? 'delete' : 'create',
              resourceType: resourceType + '-other',
              resourceId: 'r2',
              ip: '2.2.2.2',
              userAgent: 'test',
            });

            const result = await auditService.query({
              action,
              resourceType,
              page: 1,
              pageSize: 100,
            });

            expect(result.list.every(l => l.action === action && l.resourceType === resourceType)).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('Property 16: exported JSON should be parseable and complete', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              userId: fc.string({ minLength: 1, maxLength: 10 }),
              username: fc.string({ minLength: 1, maxLength: 10 }),
              action: actionArb,
              resourceType: fc.constantFrom('user', 'menu', 'config'),
              resourceId: fc.string({ minLength: 1, maxLength: 10 }),
              ip: fc.ipV4(),
              userAgent: fc.constant('test'),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (entries) => {
            auditService.clearAll();
            
            for (const entry of entries) {
              await auditService.log(entry);
            }

            const jsonContent = await auditService.export({ page: 1, pageSize: 100 }, 'json');
            const parsed = JSON.parse(jsonContent);
            
            expect(parsed.length).toBe(entries.length);
          }
        ),
        { numRuns: 5 }
      );
    });
  });
});
