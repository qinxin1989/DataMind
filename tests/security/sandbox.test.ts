/**
 * 沙箱隔离测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PermissionManager,
  PermissionLevel,
  PermissionType,
  permissionManager
} from '../../src/module-system/security/PermissionManager';
import { FileSystemProxy } from '../../src/module-system/security/FileSystemProxy';
import { NetworkProxy } from '../../src/module-system/security/NetworkProxy';
import { ResourceMonitor } from '../../src/module-system/security/ResourceMonitor';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

describe('PermissionManager', () => {
  let testPermissionManager: PermissionManager;

  beforeEach(() => {
    testPermissionManager = new PermissionManager();
  });

  afterEach(() => {
    testPermissionManager.clearAll();
  });

  describe('权限级别', () => {
    it('应该正确设置和获取模块权限', () => {
      testPermissionManager.setModulePermissions('test-module', {
        level: PermissionLevel.STANDARD
      });

      const permissions = testPermissionManager.getModulePermissions('test-module');
      expect(permissions).toBeDefined();
      expect(permissions?.level).toBe(PermissionLevel.STANDARD);
    });

    it('MINIMAL 权限应该只允许文件读取', () => {
      testPermissionManager.setModulePermissions('test-module', {
        level: PermissionLevel.MINIMAL
      });

      expect(testPermissionManager.hasPermission('test-module', PermissionType.FILE_READ)).toBe(true);
      expect(testPermissionManager.hasPermission('test-module', PermissionType.FILE_WRITE)).toBe(false);
      expect(testPermissionManager.hasPermission('test-module', PermissionType.NETWORK_HTTP)).toBe(false);
    });

    it('STANDARD 权限应该允许基本操作', () => {
      testPermissionManager.setModulePermissions('test-module', {
        level: PermissionLevel.STANDARD
      });

      expect(testPermissionManager.hasPermission('test-module', PermissionType.FILE_READ)).toBe(true);
      expect(testPermissionManager.hasPermission('test-module', PermissionType.FILE_WRITE)).toBe(true);
      expect(testPermissionManager.hasPermission('test-module', PermissionType.NETWORK_HTTPS)).toBe(true);
      expect(testPermissionManager.hasPermission('test-module', PermissionType.DATABASE_READ)).toBe(true);
    });

    it('ELEVATED 权限应该允许高级操作', () => {
      testPermissionManager.setModulePermissions('test-module', {
        level: PermissionLevel.ELEVATED
      });

      expect(testPermissionManager.hasPermission('test-module', PermissionType.FILE_DELETE)).toBe(true);
      expect(testPermissionManager.hasPermission('test-module', PermissionType.NETWORK_HTTP)).toBe(true);
      expect(testPermissionManager.hasPermission('test-module', PermissionType.DATABASE_WRITE)).toBe(true);
    });

    it('FULL 权限应该允许所有操作', () => {
      testPermissionManager.setModulePermissions('test-module', {
        level: PermissionLevel.FULL
      });

      expect(testPermissionManager.hasPermission('test-module', PermissionType.FILE_DELETE)).toBe(true);
      expect(testPermissionManager.hasPermission('test-module', PermissionType.PROCESS_SPAWN)).toBe(true);
      expect(testPermissionManager.hasPermission('test-module', PermissionType.SYSTEM_INFO)).toBe(true);
    });
  });

  describe('权限授予和撤销', () => {
    it('应该能够授予额外权限', () => {
      testPermissionManager.setModulePermissions('test-module', {
        level: PermissionLevel.MINIMAL
      });

      expect(testPermissionManager.hasPermission('test-module', PermissionType.FILE_WRITE)).toBe(false);

      testPermissionManager.grantPermission('test-module', PermissionType.FILE_WRITE);
      expect(testPermissionManager.hasPermission('test-module', PermissionType.FILE_WRITE)).toBe(true);
    });

    it('应该能够撤销权限', () => {
      testPermissionManager.setModulePermissions('test-module', {
        level: PermissionLevel.STANDARD
      });

      expect(testPermissionManager.hasPermission('test-module', PermissionType.FILE_WRITE)).toBe(true);

      testPermissionManager.revokePermission('test-module', PermissionType.FILE_WRITE);
      expect(testPermissionManager.hasPermission('test-module', PermissionType.FILE_WRITE)).toBe(false);
    });

    it('显式拒绝的权限应该优先于级别权限', () => {
      testPermissionManager.setModulePermissions('test-module', {
        level: PermissionLevel.FULL,
        deniedPermissions: [PermissionType.FILE_DELETE]
      });

      expect(testPermissionManager.hasPermission('test-module', PermissionType.FILE_DELETE)).toBe(false);
    });
  });

  describe('路径访问控制', () => {
    it('应该允许访问模块自己的目录', () => {
      testPermissionManager.setModulePermissions('test-module', {
        level: PermissionLevel.STANDARD
      });

      expect(testPermissionManager.canAccessPath('test-module', 'modules/test-module/file.txt')).toBe(true);
    });

    it('应该拒绝访问其他模块的目录', () => {
      testPermissionManager.setModulePermissions('test-module', {
        level: PermissionLevel.STANDARD
      });

      expect(testPermissionManager.canAccessPath('test-module', 'modules/other-module/file.txt')).toBe(false);
    });

    it('应该允许访问白名单路径', () => {
      testPermissionManager.setModulePermissions('test-module', {
        level: PermissionLevel.STANDARD,
        allowedPaths: ['uploads', 'data']
      });

      expect(testPermissionManager.canAccessPath('test-module', 'uploads/file.txt')).toBe(true);
      expect(testPermissionManager.canAccessPath('test-module', 'data/config.json')).toBe(true);
    });

    it('FULL 权限应该允许访问任何路径', () => {
      testPermissionManager.setModulePermissions('test-module', {
        level: PermissionLevel.FULL
      });

      expect(testPermissionManager.canAccessPath('test-module', '/etc/passwd')).toBe(true);
    });
  });

  describe('域名访问控制', () => {
    it('应该允许访问白名单域名', () => {
      testPermissionManager.setModulePermissions('test-module', {
        level: PermissionLevel.STANDARD,
        allowedDomains: ['api.example.com']
      });

      expect(testPermissionManager.canAccessDomain('test-module', 'api.example.com')).toBe(true);
    });

    it('应该拒绝访问非白名单域名', () => {
      testPermissionManager.setModulePermissions('test-module', {
        level: PermissionLevel.STANDARD,
        allowedDomains: ['api.example.com']
      });

      expect(testPermissionManager.canAccessDomain('test-module', 'evil.com')).toBe(false);
    });

    it('应该支持通配符域名', () => {
      testPermissionManager.setModulePermissions('test-module', {
        level: PermissionLevel.STANDARD,
        allowedDomains: ['*.example.com']
      });

      expect(testPermissionManager.canAccessDomain('test-module', 'api.example.com')).toBe(true);
      expect(testPermissionManager.canAccessDomain('test-module', 'cdn.example.com')).toBe(true);
      expect(testPermissionManager.canAccessDomain('test-module', 'example.com')).toBe(false);
    });

    it('FULL 权限应该允许访问任何域名', () => {
      testPermissionManager.setModulePermissions('test-module', {
        level: PermissionLevel.FULL
      });

      expect(testPermissionManager.canAccessDomain('test-module', 'any-domain.com')).toBe(true);
    });
  });
});

describe('FileSystemProxy', () => {
  let fileSystemProxy: FileSystemProxy;
  let testDir: string;

  beforeEach(async () => {
    // 使用全局的 permissionManager
    fileSystemProxy = new FileSystemProxy('modules');
    
    // 创建测试目录
    testDir = path.join(os.tmpdir(), 'sandbox-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(path.join(testDir, 'test-module'), { recursive: true });
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (err) {
      // 忽略清理错误
    }
  });

  describe('文件读取', () => {
    it('有权限时应该能够读取文件', async () => {
      const testFile = path.join(testDir, 'test-module', 'test.txt');
      await fs.writeFile(testFile, 'test content');

      permissionManager.setModulePermissions('test-module', {
        level: PermissionLevel.STANDARD,
        allowedPaths: [testDir]
      });

      const content = await fileSystemProxy.readFile('test-module', testFile);
      expect(content).toBe('test content');
    });

    it('无权限时应该拒绝读取文件', async () => {
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'test content');

      permissionManager.setModulePermissions('test-module', {
        level: PermissionLevel.MINIMAL
      });

      await expect(
        fileSystemProxy.readFile('test-module', testFile)
      ).rejects.toThrow('Access denied');
    });
  });

  describe('文件写入', () => {
    it('有权限时应该能够写入文件', async () => {
      const testFile = path.join(testDir, 'test-module', 'test.txt');

      permissionManager.setModulePermissions('test-module', {
        level: PermissionLevel.STANDARD,
        allowedPaths: [testDir]
      });

      await fileSystemProxy.writeFile('test-module', testFile, 'new content');
      
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('new content');
    });

    it('无写权限时应该拒绝写入文件', async () => {
      const testFile = path.join(testDir, 'test-module', 'test.txt');

      permissionManager.setModulePermissions('test-module', {
        level: PermissionLevel.MINIMAL,
        allowedPaths: [testDir]
      });

      await expect(
        fileSystemProxy.writeFile('test-module', testFile, 'new content')
      ).rejects.toThrow('Permission denied');
    });
  });

  describe('路径遍历防护', () => {
    it('应该检测路径遍历攻击', async () => {
      permissionManager.setModulePermissions('test-module', {
        level: PermissionLevel.STANDARD,
        allowedPaths: [testDir]
      });

      await expect(
        fileSystemProxy.readFile('test-module', '../../../etc/passwd')
      ).rejects.toThrow('Path traversal detected');
    });
  });
});

describe('NetworkProxy', () => {
  let networkProxy: NetworkProxy;

  beforeEach(() => {
    // 使用全局的 permissionManager
    networkProxy = new NetworkProxy();
  });

  afterEach(() => {
    networkProxy.clearRequestLog();
  });

  describe('域名访问控制', () => {
    it('应该拒绝访问非白名单域名', async () => {
      permissionManager.setModulePermissions('test-module-net', {
        level: PermissionLevel.STANDARD,
        allowedDomains: ['api.example.com']
      });

      await expect(
        networkProxy.get('test-module-net', 'https://evil.com')
      ).rejects.toThrow();
    });

    it('应该检查协议权限', async () => {
      permissionManager.setModulePermissions('test-module-net2', {
        level: PermissionLevel.MINIMAL,
        allowedDomains: ['api.example.com']
      });

      await expect(
        networkProxy.get('test-module-net2', 'https://api.example.com')
      ).rejects.toThrow('Permission denied');
    });
  });

  describe('请求频率限制', () => {
    it('应该记录请求次数', async () => {
      permissionManager.setModulePermissions('test-module-net3', {
        level: PermissionLevel.STANDARD,
        allowedDomains: ['api.example.com']
      });

      const initialCount = networkProxy.getRequestLog('test-module-net3');
      expect(initialCount).toBe(0);
    });

    it('应该清理请求日志', () => {
      networkProxy.clearRequestLog('test-module-net4');
      expect(networkProxy.getRequestLog('test-module-net4')).toBe(0);
    });
  });
});

describe('ResourceMonitor', () => {
  let resourceMonitor: ResourceMonitor;

  beforeEach(() => {
    resourceMonitor = new ResourceMonitor();
  });

  afterEach(() => {
    resourceMonitor.clearAll();
  });

  describe('资源限制', () => {
    it('应该设置和获取资源限制', () => {
      resourceMonitor.setResourceLimits('test-module', {
        maxMemoryMB: 256,
        maxCpuPercent: 50
      });

      const limits = resourceMonitor.getResourceLimits('test-module');
      expect(limits.maxMemoryMB).toBe(256);
      expect(limits.maxCpuPercent).toBe(50);
    });

    it('应该使用默认限制', () => {
      const limits = resourceMonitor.getResourceLimits('test-module');
      expect(limits.maxMemoryMB).toBeDefined();
      expect(limits.maxCpuPercent).toBeDefined();
    });
  });

  describe('资源监控', () => {
    it('应该记录资源使用', () => {
      resourceMonitor.startMonitoring('test-module');
      const usage = resourceMonitor.recordUsage('test-module');

      expect(usage).toBeDefined();
      expect(usage.memoryMB).toBeGreaterThan(0);
      expect(usage.timestamp).toBeGreaterThan(0);
    });

    it('应该获取当前资源使用', () => {
      resourceMonitor.startMonitoring('test-module');
      resourceMonitor.recordUsage('test-module');

      const current = resourceMonitor.getCurrentUsage('test-module');
      expect(current).toBeDefined();
      expect(current?.memoryMB).toBeGreaterThan(0);
    });

    it('应该获取资源使用历史', () => {
      resourceMonitor.startMonitoring('test-module');
      resourceMonitor.recordUsage('test-module');
      resourceMonitor.recordUsage('test-module');

      const history = resourceMonitor.getUsageHistory('test-module');
      expect(history.length).toBe(2);
    });

    it('应该计算平均资源使用', () => {
      resourceMonitor.startMonitoring('test-module');
      resourceMonitor.recordUsage('test-module');
      resourceMonitor.recordUsage('test-module');

      const average = resourceMonitor.getAverageUsage('test-module');
      expect(average).toBeDefined();
      expect(average?.memoryMB).toBeGreaterThan(0);
    });

    it('应该获取峰值资源使用', () => {
      resourceMonitor.startMonitoring('test-module');
      resourceMonitor.recordUsage('test-module');
      resourceMonitor.recordUsage('test-module');

      const peak = resourceMonitor.getPeakUsage('test-module');
      expect(peak).toBeDefined();
      expect(peak?.memoryMB).toBeGreaterThan(0);
    });
  });

  describe('资源限制检查', () => {
    it('应该检测内存超限', () => {
      resourceMonitor.setResourceLimits('test-module', {
        maxMemoryMB: 0.001 // 设置极小的限制
      });

      resourceMonitor.startMonitoring('test-module');
      resourceMonitor.recordUsage('test-module');

      const check = resourceMonitor.checkLimits('test-module');
      expect(check.exceeded).toBe(true);
      expect(check.reason).toContain('Memory limit exceeded');
    });

    it('未超限时应该返回 false', () => {
      resourceMonitor.setResourceLimits('test-module', {
        maxMemoryMB: 10000 // 设置很大的限制
      });

      resourceMonitor.startMonitoring('test-module');
      resourceMonitor.recordUsage('test-module');

      const check = resourceMonitor.checkLimits('test-module');
      expect(check.exceeded).toBe(false);
    });
  });

  describe('清理', () => {
    it('应该清理模块资源记录', () => {
      resourceMonitor.startMonitoring('test-module');
      resourceMonitor.recordUsage('test-module');

      resourceMonitor.clearModuleResources('test-module');

      const usage = resourceMonitor.getCurrentUsage('test-module');
      expect(usage).toBeUndefined();
    });

    it('应该清理所有资源记录', () => {
      resourceMonitor.startMonitoring('test-module-1');
      resourceMonitor.startMonitoring('test-module-2');
      resourceMonitor.recordUsage('test-module-1');
      resourceMonitor.recordUsage('test-module-2');

      resourceMonitor.clearAll();

      const allUsage = resourceMonitor.getAllModuleUsage();
      expect(allUsage.size).toBe(0);
    });
  });
});
