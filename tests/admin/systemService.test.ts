/**
 * 系统管理服务测试
 * Property 20: System Backup and Restore Round-Trip
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SystemService } from '../../src/admin/modules/system/systemService';
import { BackupService } from '../../src/admin/modules/system/backupService';

const DATA_DIR = path.join(process.cwd(), 'data');

describe('SystemService', () => {
  let systemService: SystemService;

  beforeEach(() => {
    systemService = new SystemService();
  });

  afterEach(() => {
    systemService.clearAll();
  });

  describe('Configuration Management', () => {
    it('should have default configurations', async () => {
      const configs = await systemService.getConfigs();
      expect(configs.length).toBeGreaterThan(0);
      
      const siteNameConfig = configs.find(c => c.key === 'site.name');
      expect(siteNameConfig).toBeDefined();
    });

    it('should get configs by group', async () => {
      const siteConfigs = await systemService.getConfigs('site');
      expect(siteConfigs.every(c => c.group === 'site')).toBe(true);
    });

    it('should get single config', async () => {
      const config = await systemService.getConfig('site.name');
      expect(config).toBeDefined();
      expect(config?.key).toBe('site.name');
    });

    it('should get typed config value', async () => {
      const sessionTimeout = await systemService.getConfigValue<number>('security.sessionTimeout');
      expect(typeof sessionTimeout).toBe('number');
      expect(sessionTimeout).toBe(3600);
    });

    it('should update config', async () => {
      await systemService.updateConfig('site.name', '新站点名称');
      const config = await systemService.getConfig('site.name');
      expect(config?.value).toBe('新站点名称');
    });

    it('should validate number type', async () => {
      await expect(
        systemService.updateConfig('security.sessionTimeout', 'not-a-number')
      ).rejects.toThrow(/数字/);
    });

    it('should validate boolean type', async () => {
      // 使用唯一的配置键避免冲突
      const uniqueKey = `test.boolean.${Date.now()}`;
      await systemService.createConfig({
        key: uniqueKey,
        value: 'true',
        type: 'boolean',
        description: 'Test',
        group: 'test',
        editable: true,
      });

      await expect(
        systemService.updateConfig(uniqueKey, 'invalid')
      ).rejects.toThrow(/true.*false/);
    });

    it('should validate JSON type', async () => {
      await expect(
        systemService.updateConfig('upload.allowedTypes', 'invalid-json')
      ).rejects.toThrow(/JSON/);
    });
  });

  describe('System Status', () => {
    it('should return system status', async () => {
      const status = await systemService.getSystemStatus();
      
      expect(status.cpu).toBeDefined();
      expect(status.cpu.cores).toBeGreaterThan(0);
      expect(status.memory).toBeDefined();
      expect(status.memory.total).toBeGreaterThan(0);
      expect(status.nodeVersion).toBeDefined();
      expect(status.platform).toBeDefined();
    });
  });

  describe('Config Groups', () => {
    it('should return config groups', async () => {
      const groups = await systemService.getConfigGroups();
      expect(groups).toContain('site');
      expect(groups).toContain('security');
      expect(groups).toContain('upload');
    });
  });
});

describe('BackupService', () => {
  let backupService: BackupService;

  beforeEach(() => {
    backupService = new BackupService();
    backupService.clearAll();
  });

  afterEach(() => {
    backupService.clearAll();
  });

  // Property 20: System Backup and Restore Round-Trip
  describe('Property 20: System Backup and Restore Round-Trip', () => {
    it('should backup and restore data correctly', async () => {
      // 准备测试数据
      const testFile = path.join(DATA_DIR, 'test-backup-data.json');
      const originalData = { test: 'data', value: 123 };
      fs.writeFileSync(testFile, JSON.stringify(originalData));

      // 创建备份
      const backup = await backupService.createBackup('Test Backup', 'For testing');
      expect(backup.id).toBeDefined();
      expect(backup.name).toBe('Test Backup');

      // 修改原始数据
      fs.writeFileSync(testFile, JSON.stringify({ test: 'modified' }));

      // 恢复备份
      const result = await backupService.restoreBackup(backup.id);
      expect(result.restored.length).toBeGreaterThan(0);

      // 清理测试文件
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });

    it('should preserve backup integrity', async () => {
      // 创建备份
      const backup = await backupService.createBackup('Integrity Test');

      // 验证备份
      const verification = await backupService.verifyBackup(backup.id);
      expect(verification.valid).toBe(true);
      expect(verification.errors.length).toBe(0);
    });
  });

  describe('Backup Management', () => {
    it('should create backup with metadata', async () => {
      const backup = await backupService.createBackup('My Backup', 'Description');
      
      expect(backup.id).toBeDefined();
      expect(backup.name).toBe('My Backup');
      expect(backup.description).toBe('Description');
      expect(backup.createdAt).toBeDefined();
      expect(backup.files).toBeDefined();
    });

    it('should list backups', async () => {
      await backupService.createBackup('Backup 1');
      await backupService.createBackup('Backup 2');

      const backups = await backupService.listBackups();
      expect(backups.length).toBe(2);
    });

    it('should get backup by id', async () => {
      const created = await backupService.createBackup('Test');
      const retrieved = await backupService.getBackup(created.id);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Test');
    });

    it('should delete backup', async () => {
      const backup = await backupService.createBackup('To Delete');
      await backupService.deleteBackup(backup.id);
      
      const retrieved = await backupService.getBackup(backup.id);
      expect(retrieved).toBeNull();
    });

    it('should throw when deleting non-existent backup', async () => {
      await expect(backupService.deleteBackup('non-existent')).rejects.toThrow(/不存在/);
    });
  });

  describe('Backup Verification', () => {
    it('should detect missing backup', async () => {
      const result = await backupService.verifyBackup('non-existent');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should verify valid backup', async () => {
      const backup = await backupService.createBackup('Valid Backup');
      const result = await backupService.verifyBackup(backup.id);
      
      expect(result.valid).toBe(true);
    });
  });

  describe('Backup Export', () => {
    it('should export backup as JSON', async () => {
      const backup = await backupService.createBackup('Export Test');
      const exported = await backupService.exportBackup(backup.id);
      
      const parsed = JSON.parse(exported);
      expect(parsed.meta).toBeDefined();
      expect(parsed.meta.name).toBe('Export Test');
      expect(parsed.data).toBeDefined();
    });

    it('should throw when exporting non-existent backup', async () => {
      await expect(backupService.exportBackup('non-existent')).rejects.toThrow(/不存在/);
    });
  });

  describe('Restore Operations', () => {
    it('should restore backup files', async () => {
      const backup = await backupService.createBackup('Restore Test');
      const result = await backupService.restoreBackup(backup.id);
      
      expect(result.restored).toBeDefined();
      expect(result.skipped).toBeDefined();
    });

    it('should throw when restoring non-existent backup', async () => {
      await expect(backupService.restoreBackup('non-existent')).rejects.toThrow(/不存在/);
    });
  });
});
