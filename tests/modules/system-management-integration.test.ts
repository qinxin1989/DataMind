/**
 * 系统管理模块集成测试
 * 测试 system-config, audit-log, system-backup 三个模块的集成
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { SystemConfigService } from '../../modules/system-config/backend/service';
import { AuditLogService } from '../../modules/audit-log/backend/service';
import { SystemBackupService } from '../../modules/system-backup/backend/service';
import * as fs from 'fs';
import * as path from 'path';

// Mock 数据库
class MockDatabase {
  private configs: any[] = [];
  private logs: any[] = [];
  private backups: any[] = [];

  async run(query: string, params: any[]): Promise<{ changes?: number }> {
    if (query.includes('INSERT INTO system_configs')) {
      const [id, key, value, type, desc, group, editable, createdAt, updatedAt] = params;
      this.configs.push({
        id, config_key: key, config_value: value, value_type: type,
        description: desc, config_group: group, is_editable: editable,
        created_at: createdAt, updated_at: updatedAt
      });
      return { changes: 1 };
    } else if (query.includes('INSERT INTO audit_logs')) {
      const [id, userId, username, action, resourceType, resourceId, details, ip, ua, status, error, createdAt] = params;
      this.logs.push({
        id, user_id: userId, username, action, resource_type: resourceType,
        resource_id: resourceId, details, ip_address: ip, user_agent: ua,
        status, error_message: error, created_at: createdAt
      });
      return { changes: 1 };
    } else if (query.includes('INSERT INTO system_backups')) {
      const [id, name, desc, size, count, path, status, createdBy, createdAt, completedAt, error] = params;
      this.backups.push({
        id, name, description: desc, backup_size: size, file_count: count,
        backup_path: path, status, created_by: createdBy, created_at: createdAt,
        completed_at: completedAt, error_message: error
      });
      return { changes: 1 };
    } else if (query.includes('UPDATE system_configs')) {
      const config = this.configs.find(c => c.config_key === params[params.length - 1]);
      if (config) {
        config.config_value = params[0];
        config.updated_at = params[1];
      }
      return { changes: 1 };
    } else if (query.includes('DELETE FROM system_configs')) {
      const beforeLength = this.configs.length;
      this.configs = this.configs.filter(c => c.config_key !== params[0]);
      return { changes: beforeLength - this.configs.length };
    } else if (query.includes('DELETE FROM audit_logs')) {
      const beforeLength = this.logs.length;
      this.logs = this.logs.filter(l => l.id !== params[0]);
      return { changes: beforeLength - this.logs.length };
    } else if (query.includes('DELETE FROM system_backups')) {
      const beforeLength = this.backups.length;
      this.backups = this.backups.filter(b => b.id !== params[0]);
      return { changes: beforeLength - this.backups.length };
    }
    return {};
  }

  async get(query: string, params: any[]): Promise<any> {
    if (query.includes('SELECT * FROM system_configs WHERE config_key')) {
      return this.configs.find(c => c.config_key === params[0]);
    } else if (query.includes('SELECT * FROM audit_logs WHERE id')) {
      return this.logs.find(l => l.id === params[0]);
    } else if (query.includes('SELECT * FROM system_backups WHERE id')) {
      return this.backups.find(b => b.id === params[0]);
    } else if (query.includes('SELECT COUNT(*) as total')) {
      if (query.includes('audit_logs')) {
        return { total: this.logs.length };
      } else if (query.includes('system_backups')) {
        return { total: this.backups.length };
      }
    }
    return null;
  }

  async all(query: string, params: any[]): Promise<any[]> {
    if (query.includes('SELECT * FROM system_configs')) {
      let filtered = [...this.configs];
      if (query.includes('WHERE config_group')) {
        filtered = filtered.filter(c => c.config_group === params[0]);
      }
      return filtered;
    } else if (query.includes('SELECT DISTINCT config_group')) {
      return [...new Set(this.configs.map(c => c.config_group))].map(g => ({ config_group: g }));
    } else if (query.includes('SELECT * FROM audit_logs')) {
      let filtered = [...this.logs];
      filtered.sort((a, b) => b.created_at - a.created_at);
      const pageSize = params[params.length - 2] || 20;
      const offset = params[params.length - 1] || 0;
      return filtered.slice(offset, offset + pageSize);
    } else if (query.includes('SELECT * FROM system_backups')) {
      let filtered = [...this.backups];
      filtered.sort((a, b) => b.created_at - a.created_at);
      const pageSize = params[params.length - 2] || 20;
      const offset = params[params.length - 1] || 0;
      return filtered.slice(offset, offset + pageSize);
    } else if (query.includes('SELECT id FROM system_backups')) {
      const beforeDate = params[0];
      const status = params[1];
      return this.backups.filter(b => b.created_at < beforeDate && b.status === status);
    }
    return [];
  }

  clear() {
    this.configs = [];
    this.logs = [];
    this.backups = [];
  }
}

describe('系统管理模块集成测试', () => {
  let db: MockDatabase;
  let configService: SystemConfigService;
  let auditService: AuditLogService;
  let backupService: SystemBackupService;
  const testBackupDir = path.join(process.cwd(), 'data', 'test-system-backups');

  beforeAll(() => {
    db = new MockDatabase();
    
    // 初始化服务
    configService = new SystemConfigService(db as any);
    auditService = new AuditLogService(db as any);
    backupService = new SystemBackupService(db as any, {
      backupDir: testBackupDir
    });

    // 创建测试目录
    if (!fs.existsSync(testBackupDir)) {
      fs.mkdirSync(testBackupDir, { recursive: true });
    }
  });

  afterAll(() => {
    db.clear();
    
    // 清理测试目录
    if (fs.existsSync(testBackupDir)) {
      const dirs = fs.readdirSync(testBackupDir);
      for (const dir of dirs) {
        const dirPath = path.join(testBackupDir, dir);
        if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
          const files = fs.readdirSync(dirPath);
          for (const file of files) {
            fs.unlinkSync(path.join(dirPath, file));
          }
          fs.rmdirSync(dirPath);
        }
      }
    }
  });

  describe('模块初始化', () => {
    it('应该成功初始化所有系统管理模块', () => {
      expect(configService).toBeDefined();
      expect(auditService).toBeDefined();
      expect(backupService).toBeDefined();
    });

    it('所有服务应该是正确的实例', () => {
      expect(configService).toBeInstanceOf(SystemConfigService);
      expect(auditService).toBeInstanceOf(AuditLogService);
      expect(backupService).toBeInstanceOf(SystemBackupService);
    });
  });

  describe('跨模块功能测试', () => {
    it('应该能够创建配置并记录审计日志', async () => {
      // 1. 创建系统配置
      const config = await configService.createConfig({
        key: 'test.setting',
        value: 'test-value',
        type: 'string',
        description: '测试配置',
        group: 'test',
        isEditable: true
      });

      expect(config).toBeDefined();
      expect(config.key).toBe('test.setting');

      // 2. 记录审计日志
      const log = await auditService.createLog({
        userId: 'admin',
        username: '管理员',
        action: 'config.create',
        resourceType: 'config',
        resourceId: config.id,
        details: `创建配置: ${config.key}`,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        status: 'success'
      });

      expect(log).toBeDefined();
      expect(log.action).toBe('config.create');
      expect(log.resourceId).toBe(config.id);
    });

    it('应该能够创建备份并记录审计日志', async () => {
      // 1. 创建备份
      const backup = await backupService.createBackup({
        name: '集成测试备份',
        description: '测试备份功能',
        createdBy: 'admin'
      });

      expect(backup).toBeDefined();
      expect(backup.name).toBe('集成测试备份');

      // 2. 记录审计日志
      const log = await auditService.createLog({
        userId: 'admin',
        username: '管理员',
        action: 'backup.create',
        resourceType: 'backup',
        resourceId: backup.id,
        details: `创建备份: ${backup.name}`,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        status: 'success'
      });

      expect(log).toBeDefined();
      expect(log.action).toBe('backup.create');
    });

    it('应该能够更新配置、记录日志并创建备份', async () => {
      // 1. 创建配置
      const config = await configService.createConfig({
        key: 'important.setting',
        value: 'original',
        type: 'string',
        description: '重要配置',
        group: 'system',
        isEditable: true
      });

      // 2. 创建备份（重要操作前）
      const backup = await backupService.createBackup({
        name: '配置更新前备份',
        description: '更新重要配置前的备份',
        createdBy: 'admin'
      });

      expect(backup.status).toBe('completed');

      // 3. 更新配置
      const updated = await configService.updateConfig('important.setting', {
        value: 'updated'
      });

      expect(updated.value).toBe('updated');

      // 4. 记录审计日志
      const log = await auditService.createLog({
        userId: 'admin',
        username: '管理员',
        action: 'config.update',
        resourceType: 'config',
        resourceId: config.id,
        details: `更新配置: ${config.key} (original -> updated)`,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        status: 'success'
      });

      expect(log).toBeDefined();
      expect(log.action).toBe('config.update');
    });
  });

  describe('完整工作流测试', () => {
    it('应该支持完整的配置管理-审计-备份流程', async () => {
      // 步骤1: 创建初始配置
      const config1 = await configService.createConfig({
        key: 'workflow.test1',
        value: 'value1',
        type: 'string',
        description: '工作流测试1',
        group: 'workflow',
        isEditable: true
      });

      await auditService.createLog({
        userId: 'admin',
        username: '管理员',
        action: 'config.create',
        resourceType: 'config',
        resourceId: config1.id,
        details: '创建配置',
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        status: 'success'
      });

      // 步骤2: 创建更多配置
      const config2 = await configService.createConfig({
        key: 'workflow.test2',
        value: 'value2',
        type: 'string',
        description: '工作流测试2',
        group: 'workflow',
        isEditable: true
      });

      // 步骤3: 创建备份
      const backup = await backupService.createBackup({
        name: '工作流测试备份',
        description: '完整工作流测试',
        createdBy: 'admin'
      });

      await auditService.createLog({
        userId: 'admin',
        username: '管理员',
        action: 'backup.create',
        resourceType: 'backup',
        resourceId: backup.id,
        details: '创建备份',
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        status: 'success'
      });

      // 步骤4: 验证备份
      const verifyResult = await backupService.verifyBackup(backup.id);
      expect(verifyResult.valid).toBeDefined();

      // 步骤5: 查询审计日志
      const logs = await auditService.queryLogs({ page: 1, pageSize: 10 });
      expect(logs.items.length).toBeGreaterThan(0);

      // 步骤6: 查询配置
      const configs = await configService.getConfigs({ group: 'workflow' });
      expect(configs.length).toBe(2);

      // 步骤7: 导出备份
      const exported = await backupService.exportBackup(backup.id);
      expect(exported).toBeDefined();
      const exportData = JSON.parse(exported);
      expect(exportData.meta).toBeDefined();
      expect(exportData.data).toBeDefined();
    });

    it('应该支持配置恢复流程', async () => {
      // 步骤1: 创建配置
      const config = await configService.createConfig({
        key: 'restore.test',
        value: 'original',
        type: 'string',
        description: '恢复测试',
        group: 'test',
        isEditable: true
      });

      // 步骤2: 创建备份
      const backup = await backupService.createBackup({
        name: '恢复测试备份',
        description: '用于测试恢复功能',
        createdBy: 'admin'
      });

      // 步骤3: 修改配置
      await configService.updateConfig('restore.test', { value: 'modified' });

      // 步骤4: 记录修改日志
      await auditService.createLog({
        userId: 'admin',
        username: '管理员',
        action: 'config.update',
        resourceType: 'config',
        resourceId: config.id,
        details: '修改配置',
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        status: 'success'
      });

      // 步骤5: 恢复备份
      const restoreResult = await backupService.restoreBackup(backup.id);
      expect(restoreResult.success).toBe(true);

      // 步骤6: 记录恢复日志
      await auditService.createLog({
        userId: 'admin',
        username: '管理员',
        action: 'backup.restore',
        resourceType: 'backup',
        resourceId: backup.id,
        details: `恢复备份: ${backup.name}`,
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        status: 'success'
      });

      // 验证日志记录
      const logs = await auditService.queryLogs({ action: 'backup.restore' });
      expect(logs.items.length).toBeGreaterThan(0);
    });
  });

  describe('并发操作测试', () => {
    it('应该支持并发创建配置和日志', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        Promise.all([
          configService.createConfig({
            key: `concurrent.test${i}`,
            value: `value${i}`,
            type: 'string',
            description: `并发测试${i}`,
            group: 'concurrent',
            isEditable: true
          }),
          auditService.createLog({
            userId: 'admin',
            username: '管理员',
            action: 'config.create',
            resourceType: 'config',
            resourceId: `test-${i}`,
            details: `并发创建配置${i}`,
            ipAddress: '127.0.0.1',
            userAgent: 'test',
            status: 'success'
          })
        ])
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(([config, log]) => {
        expect(config).toBeDefined();
        expect(log).toBeDefined();
      });
    });

    it('应该支持并发备份操作', async () => {
      const promises = Array.from({ length: 3 }, (_, i) =>
        backupService.createBackup({
          name: `并发备份${i}`,
          description: `并发测试${i}`,
          createdBy: 'admin'
        })
      );

      const backups = await Promise.all(promises);

      expect(backups).toHaveLength(3);
      backups.forEach((backup, i) => {
        expect(backup.name).toBe(`并发备份${i}`);
        expect(backup.status).toBe('completed');
      });
    });
  });

  describe('错误处理测试', () => {
    it('应该正确处理配置错误并记录日志', async () => {
      // 尝试创建重复的配置
      await configService.createConfig({
        key: 'duplicate.test',
        value: 'value1',
        type: 'string',
        description: '重复测试',
        group: 'test',
        isEditable: true
      });

      try {
        await configService.createConfig({
          key: 'duplicate.test',
          value: 'value2',
          type: 'string',
          description: '重复测试2',
          group: 'test',
          isEditable: true
        });
      } catch (error: any) {
        // 记录失败日志
        const log = await auditService.createLog({
          userId: 'admin',
          username: '管理员',
          action: 'config.create',
          resourceType: 'config',
          resourceId: 'duplicate.test',
          details: '尝试创建重复配置',
          ipAddress: '127.0.0.1',
          userAgent: 'test',
          status: 'failed',
          errorMessage: error.message
        });

        expect(log).toBeDefined();
        expect(log.status).toBe('failed');
        expect(log.errorMessage).toBeDefined();
      }
    });

    it('应该正确处理备份错误', async () => {
      // 尝试恢复不存在的备份
      try {
        await backupService.restoreBackup('non-existent-id');
      } catch (error: any) {
        expect(error.message).toContain('备份不存在');

        // 记录失败日志
        const log = await auditService.createLog({
          userId: 'admin',
          username: '管理员',
          action: 'backup.restore',
          resourceType: 'backup',
          resourceId: 'non-existent-id',
          details: '尝试恢复不存在的备份',
          ipAddress: '127.0.0.1',
          userAgent: 'test',
          status: 'failed',
          errorMessage: error.message
        });

        expect(log).toBeDefined();
        expect(log.status).toBe('failed');
      }
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成多个操作', async () => {
      const startTime = Date.now();

      await Promise.all([
        configService.createConfig({
          key: 'perf.test1',
          value: 'value1',
          type: 'string',
          description: '性能测试1',
          group: 'perf',
          isEditable: true
        }),
        auditService.createLog({
          userId: 'admin',
          username: '管理员',
          action: 'test',
          resourceType: 'test',
          resourceId: 'test-1',
          details: '性能测试',
          ipAddress: '127.0.0.1',
          userAgent: 'test',
          status: 'success'
        }),
        backupService.createBackup({
          name: '性能测试备份',
          description: '性能测试',
          createdBy: 'admin'
        })
      ]);

      const duration = Date.now() - startTime;

      // 所有操作应该在 1 秒内完成
      expect(duration).toBeLessThan(1000);
    });

    it('应该支持批量查询', async () => {
      // 创建多个配置
      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          configService.createConfig({
            key: `batch.test${i}`,
            value: `value${i}`,
            type: 'string',
            description: `批量测试${i}`,
            group: 'batch',
            isEditable: true
          })
        )
      );

      const startTime = Date.now();

      const configs = await configService.getConfigs({ group: 'batch' });

      const duration = Date.now() - startTime;

      // 应该在 100ms 内完成
      expect(duration).toBeLessThan(100);
      expect(configs.length).toBe(10);
    });
  });

  describe('数据一致性测试', () => {
    it('应该保持配置和审计日志的一致性', async () => {
      // 创建配置
      const config = await configService.createConfig({
        key: 'consistency.test',
        value: 'value',
        type: 'string',
        description: '一致性测试',
        group: 'test',
        isEditable: true
      });

      // 记录日志
      await auditService.createLog({
        userId: 'admin',
        username: '管理员',
        action: 'config.create',
        resourceType: 'config',
        resourceId: config.id,
        details: '创建配置',
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        status: 'success'
      });

      // 验证配置存在
      const retrieved = await configService.getConfig('consistency.test');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(config.id);

      // 验证日志存在
      const logs = await auditService.queryLogs({ resourceId: config.id });
      expect(logs.items.length).toBeGreaterThan(0);
      expect(logs.items[0].resourceId).toBe(config.id);
    });

    it('应该保持备份和审计日志的一致性', async () => {
      // 创建备份
      const backup = await backupService.createBackup({
        name: '一致性测试备份',
        description: '测试数据一致性',
        createdBy: 'admin'
      });

      // 记录日志
      await auditService.createLog({
        userId: 'admin',
        username: '管理员',
        action: 'backup.create',
        resourceType: 'backup',
        resourceId: backup.id,
        details: '创建备份',
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        status: 'success'
      });

      // 验证备份存在
      const retrieved = await backupService.getBackup(backup.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(backup.id);

      // 验证日志存在
      const logs = await auditService.queryLogs({ resourceId: backup.id });
      expect(logs.items.length).toBeGreaterThan(0);
      expect(logs.items[0].resourceId).toBe(backup.id);
    });
  });

  describe('系统状态监控', () => {
    it('应该能够获取系统状态', async () => {
      const status = await configService.getSystemStatus();

      expect(status).toBeDefined();
      expect(status.cpu).toBeDefined();
      expect(status.memory).toBeDefined();
      expect(status.disk).toBeDefined();
      expect(status.uptime).toBeDefined();
      expect(status.nodeVersion).toBeDefined();
    });

    it('应该能够记录系统状态查询日志', async () => {
      const status = await configService.getSystemStatus();

      const log = await auditService.createLog({
        userId: 'admin',
        username: '管理员',
        action: 'system.status',
        resourceType: 'system',
        resourceId: 'status',
        details: `查询系统状态: CPU ${status.cpu.usage}%, 内存 ${status.memory.usage}%`,
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        status: 'success'
      });

      expect(log).toBeDefined();
      expect(log.action).toBe('system.status');
    });
  });
});
