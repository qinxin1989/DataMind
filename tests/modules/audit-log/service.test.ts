/**
 * 审计日志服务测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuditLogService } from '../../../modules/audit-log/backend/service';
import type { CreateLogRequest } from '../../../modules/audit-log/backend/types';

// 模拟数据库
class MockDatabase {
  private logs: any[] = [];
  private idCounter = 1;

  async run(query: string, params: any[]): Promise<{ changes?: number }> {
    if (query.includes('INSERT INTO audit_logs')) {
      const [id, userId, username, action, resourceType, resourceId, details, ipAddress, userAgent, status, errorMessage, createdAt] = params;
      this.logs.push({
        id,
        user_id: userId,
        username,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        details,
        ip_address: ipAddress,
        user_agent: userAgent,
        status,
        error_message: errorMessage,
        created_at: createdAt
      });
      return { changes: 1 };
    } else if (query.includes('DELETE FROM audit_logs')) {
      const beforeLength = this.logs.length;
      if (query.includes('WHERE id = ?')) {
        this.logs = this.logs.filter(log => log.id !== params[0]);
      } else if (query.includes('WHERE created_at < ?')) {
        this.logs = this.logs.filter(log => log.created_at >= params[0]);
      }
      return { changes: beforeLength - this.logs.length };
    }
    return {};
  }

  async get(query: string, params: any[]): Promise<any> {
    if (query.includes('SELECT * FROM audit_logs WHERE id = ?')) {
      return this.logs.find(log => log.id === params[0]);
    } else if (query.includes('SELECT COUNT(*) as total')) {
      // 应用WHERE条件过滤
      let filtered = [...this.logs];
      if (query.includes('WHERE')) {
        let paramIndex = 0;
        if (query.includes('user_id = ?')) {
          const userId = params[paramIndex++];
          filtered = filtered.filter(log => log.user_id === userId);
        }
        if (query.includes('action = ?')) {
          const action = params[paramIndex++];
          filtered = filtered.filter(log => log.action === action);
        }
        if (query.includes('resource_type = ?')) {
          const resourceType = params[paramIndex++];
          filtered = filtered.filter(log => log.resource_type === resourceType);
        }
        if (query.includes('status = ?')) {
          const status = params[paramIndex++];
          filtered = filtered.filter(log => log.status === status);
        }
      }
      return { total: filtered.length };
    } else if (query.includes('SELECT COUNT(*) as count')) {
      if (query.includes("status = 'success'")) {
        return { count: this.logs.filter(log => log.status === 'success').length };
      }
    }
    return null;
  }

  async all(query: string, params: any[]): Promise<any[]> {
    if (query.includes('SELECT * FROM audit_logs')) {
      let filtered = [...this.logs];
      
      // 解析WHERE条件并过滤
      if (query.includes('WHERE')) {
        let paramIndex = 0;
        if (query.includes('user_id = ?')) {
          const userId = params[paramIndex++];
          filtered = filtered.filter(log => log.user_id === userId);
        }
        if (query.includes('action = ?')) {
          const action = params[paramIndex++];
          filtered = filtered.filter(log => log.action === action);
        }
        if (query.includes('resource_type = ?')) {
          const resourceType = params[paramIndex++];
          filtered = filtered.filter(log => log.resource_type === resourceType);
        }
        if (query.includes('status = ?')) {
          const status = params[paramIndex++];
          filtered = filtered.filter(log => log.status === status);
        }
        if (query.includes('created_at >= ?')) {
          const startDate = params[paramIndex++];
          filtered = filtered.filter(log => log.created_at >= startDate);
        }
        if (query.includes('created_at <= ?')) {
          const endDate = params[paramIndex++];
          filtered = filtered.filter(log => log.created_at <= endDate);
        }
      }
      
      // 排序
      filtered.sort((a, b) => b.created_at - a.created_at);
      
      // 分页
      const pageSize = params[params.length - 2] || 20;
      const offset = params[params.length - 1] || 0;
      return filtered.slice(offset, offset + pageSize);
    } else if (query.includes('GROUP BY action')) {
      const actionCounts: { [key: string]: number } = {};
      this.logs.forEach(log => {
        actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      });
      return Object.entries(actionCounts)
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    } else if (query.includes('GROUP BY user_id')) {
      const userCounts: { [key: string]: { username: string; count: number } } = {};
      this.logs.forEach(log => {
        if (!userCounts[log.user_id]) {
          userCounts[log.user_id] = { username: log.username, count: 0 };
        }
        userCounts[log.user_id].count++;
      });
      return Object.entries(userCounts)
        .map(([user_id, data]) => ({ user_id, username: data.username, count: data.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    } else if (query.includes('GROUP BY date')) {
      return [];
    }
    return [];
  }

  clear() {
    this.logs = [];
  }
}

describe('AuditLogService', () => {
  let service: AuditLogService;
  let db: MockDatabase;

  beforeEach(() => {
    db = new MockDatabase();
    service = new AuditLogService(db as any);
  });

  afterEach(() => {
    db.clear();
  });

  describe('createLog', () => {
    it('应该成功创建审计日志', async () => {
      const request: CreateLogRequest = {
        userId: 'user-1',
        username: 'testuser',
        action: 'login',
        status: 'success'
      };

      const log = await service.createLog(request);

      expect(log).toBeDefined();
      expect(log.userId).toBe('user-1');
      expect(log.username).toBe('testuser');
      expect(log.action).toBe('login');
      expect(log.status).toBe('success');
      expect(log.id).toBeDefined();
      expect(log.createdAt).toBeDefined();
    });

    it('应该记录完整的日志信息', async () => {
      const request: CreateLogRequest = {
        userId: 'user-1',
        username: 'testuser',
        action: 'update_config',
        resourceType: 'config',
        resourceId: 'config-1',
        details: 'Updated system config',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        status: 'success'
      };

      const log = await service.createLog(request);

      expect(log.resourceType).toBe('config');
      expect(log.resourceId).toBe('config-1');
      expect(log.details).toBe('Updated system config');
      expect(log.ipAddress).toBe('192.168.1.1');
      expect(log.userAgent).toBe('Mozilla/5.0');
    });

    it('应该记录失败日志', async () => {
      const request: CreateLogRequest = {
        userId: 'user-1',
        username: 'testuser',
        action: 'delete_user',
        status: 'failed',
        errorMessage: 'Permission denied'
      };

      const log = await service.createLog(request);

      expect(log.status).toBe('failed');
      expect(log.errorMessage).toBe('Permission denied');
    });
  });

  describe('getLog', () => {
    it('应该获取指定日志', async () => {
      const request: CreateLogRequest = {
        userId: 'user-1',
        username: 'testuser',
        action: 'login',
        status: 'success'
      };

      const created = await service.createLog(request);
      const log = await service.getLog(created.id);

      expect(log).toBeDefined();
      expect(log?.id).toBe(created.id);
    });

    it('应该返回null当日志不存在', async () => {
      const log = await service.getLog('non-existent-id');
      expect(log).toBeNull();
    });
  });

  describe('queryLogs', () => {
    beforeEach(async () => {
      // 创建测试数据
      await service.createLog({
        userId: 'user-1',
        username: 'user1',
        action: 'login',
        status: 'success'
      });
      await service.createLog({
        userId: 'user-2',
        username: 'user2',
        action: 'logout',
        status: 'success'
      });
      await service.createLog({
        userId: 'user-1',
        username: 'user1',
        action: 'update_config',
        resourceType: 'config',
        status: 'failed',
        errorMessage: 'Invalid value'
      });
    });

    it('应该查询所有日志', async () => {
      const result = await service.queryLogs();

      expect(result.total).toBe(3);
      expect(result.items.length).toBe(3);
    });

    it('应该按用户ID过滤', async () => {
      const result = await service.queryLogs({ userId: 'user-1' });

      expect(result.total).toBe(2);
      expect(result.items.every(log => log.userId === 'user-1')).toBe(true);
    });

    it('应该按操作过滤', async () => {
      const result = await service.queryLogs({ action: 'login' });

      expect(result.total).toBe(1);
      expect(result.items[0].action).toBe('login');
    });

    it('应该按状态过滤', async () => {
      const result = await service.queryLogs({ status: 'failed' });

      expect(result.total).toBe(1);
      expect(result.items[0].status).toBe('failed');
    });

    it('应该支持分页', async () => {
      const result = await service.queryLogs({ page: 1, pageSize: 2 });

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
      expect(result.items.length).toBe(2);
    });
  });

  describe('deleteLog', () => {
    it('应该删除指定日志', async () => {
      const log = await service.createLog({
        userId: 'user-1',
        username: 'testuser',
        action: 'login',
        status: 'success'
      });

      await service.deleteLog(log.id);

      const deleted = await service.getLog(log.id);
      expect(deleted).toBeNull();
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      // 创建测试数据
      await service.createLog({
        userId: 'user-1',
        username: 'user1',
        action: 'login',
        status: 'success'
      });
      await service.createLog({
        userId: 'user-1',
        username: 'user1',
        action: 'login',
        status: 'success'
      });
      await service.createLog({
        userId: 'user-2',
        username: 'user2',
        action: 'logout',
        status: 'success'
      });
      await service.createLog({
        userId: 'user-1',
        username: 'user1',
        action: 'update_config',
        status: 'failed'
      });
    });

    it('应该获取日志统计', async () => {
      const stats = await service.getStats();

      expect(stats.totalLogs).toBe(4);
      expect(stats.successLogs).toBe(3);
      expect(stats.failedLogs).toBe(1);
    });

    it('应该统计热门操作', async () => {
      const stats = await service.getStats();

      expect(stats.topActions.length).toBeGreaterThan(0);
      expect(stats.topActions[0].action).toBe('login');
      expect(stats.topActions[0].count).toBe(2);
    });

    it('应该统计热门用户', async () => {
      const stats = await service.getStats();

      expect(stats.topUsers.length).toBeGreaterThan(0);
      expect(stats.topUsers[0].userId).toBe('user-1');
      expect(stats.topUsers[0].count).toBe(3);
    });
  });

  describe('exportLogs', () => {
    beforeEach(async () => {
      await service.createLog({
        userId: 'user-1',
        username: 'testuser',
        action: 'login',
        status: 'success'
      });
    });

    it('应该导出JSON格式', async () => {
      const content = await service.exportLogs({ format: 'json' });

      expect(content).toBeDefined();
      const logs = JSON.parse(content);
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBe(1);
    });

    it('应该导出CSV格式', async () => {
      const content = await service.exportLogs({ format: 'csv' });

      expect(content).toBeDefined();
      expect(content).toContain('ID');
      expect(content).toContain('用户ID');
      expect(content).toContain('login');
    });

    it('应该抛出错误当格式不支持', async () => {
      await expect(
        service.exportLogs({ format: 'xml' as any })
      ).rejects.toThrow('不支持的导出格式');
    });
  });

  describe('cleanupLogs', () => {
    it('应该清理过期日志', async () => {
      const oldDate = Date.now() - 100 * 24 * 60 * 60 * 1000; // 100天前
      
      // 创建旧日志
      await db.run(
        'INSERT INTO audit_logs (id, user_id, username, action, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        ['old-log', 'user-1', 'testuser', 'login', 'success', oldDate]
      );

      // 创建新日志
      await service.createLog({
        userId: 'user-1',
        username: 'testuser',
        action: 'login',
        status: 'success'
      });

      const count = await service.cleanupLogs({
        beforeDate: Date.now() - 90 * 24 * 60 * 60 * 1000
      });

      expect(count).toBe(1);
    });

    it('应该按状态清理日志', async () => {
      await service.createLog({
        userId: 'user-1',
        username: 'testuser',
        action: 'login',
        status: 'failed'
      });

      const count = await service.cleanupLogs({
        beforeDate: Date.now() + 1000,
        status: 'failed'
      });

      expect(count).toBe(1);
    });
  });

  describe('autoCleanup', () => {
    it('应该自动清理过期日志', async () => {
      const oldDate = Date.now() - 100 * 24 * 60 * 60 * 1000;
      
      await db.run(
        'INSERT INTO audit_logs (id, user_id, username, action, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        ['old-log', 'user-1', 'testuser', 'login', 'success', oldDate]
      );

      const count = await service.autoCleanup();

      expect(count).toBe(1);
    });
  });
});
