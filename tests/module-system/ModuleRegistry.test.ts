/**
 * ModuleRegistry 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ModuleRegistry } from '../../src/module-system/core/ModuleRegistry';
import { ModuleManifest } from '../../src/module-system/types';
import { pool } from '../../src/admin/core/database';

describe('ModuleRegistry', () => {
  let registry: ModuleRegistry;

  beforeEach(async () => {
    registry = new ModuleRegistry();
    await registry.initialize();
    
    // 清理测试数据
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM sys_modules WHERE name LIKE "test-%"');
    } finally {
      connection.release();
    }
  });

  afterEach(async () => {
    // 清理测试数据
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM sys_modules WHERE name LIKE "test-%"');
    } finally {
      connection.release();
    }
  });

  describe('register', () => {
    it('should register a valid module', async () => {
      const manifest: ModuleManifest = {
        name: 'test-module',
        displayName: 'Test Module',
        version: '1.0.0',
        description: 'A test module'
      };

      await registry.register(manifest);

      const moduleInfo = await registry.getModule('test-module');
      expect(moduleInfo).not.toBeNull();
      expect(moduleInfo?.manifest.name).toBe('test-module');
      expect(moduleInfo?.status).toBe('installed');
    });

    it('should throw error when registering duplicate module', async () => {
      const manifest: ModuleManifest = {
        name: 'test-duplicate',
        displayName: 'Test Duplicate',
        version: '1.0.0'
      };

      await registry.register(manifest);

      await expect(registry.register(manifest)).rejects.toThrow(
        'Module test-duplicate is already registered'
      );
    });

    it('should throw error for invalid module name', async () => {
      const manifest: ModuleManifest = {
        name: 'Test_Module', // Invalid: should be kebab-case
        displayName: 'Test Module',
        version: '1.0.0'
      };

      await expect(registry.register(manifest)).rejects.toThrow(
        'Invalid module name'
      );
    });

    it('should throw error for invalid version', async () => {
      const manifest: ModuleManifest = {
        name: 'test-module',
        displayName: 'Test Module',
        version: 'invalid-version'
      };

      await expect(registry.register(manifest)).rejects.toThrow(
        'Invalid version format'
      );
    });

    it('should register module with dependencies', async () => {
      // 先注册依赖模块
      const depManifest: ModuleManifest = {
        name: 'test-dependency',
        displayName: 'Test Dependency',
        version: '1.0.0'
      };
      await registry.register(depManifest);

      // 注册主模块
      const manifest: ModuleManifest = {
        name: 'test-with-deps',
        displayName: 'Test With Dependencies',
        version: '1.0.0',
        dependencies: {
          'test-dependency': '^1.0.0'
        }
      };

      await registry.register(manifest);

      const moduleInfo = await registry.getModule('test-with-deps');
      expect(moduleInfo).not.toBeNull();
      expect(moduleInfo?.manifest.dependencies).toEqual({
        'test-dependency': '^1.0.0'
      });
    });
  });

  describe('unregister', () => {
    it('should unregister a module', async () => {
      const manifest: ModuleManifest = {
        name: 'test-unregister',
        displayName: 'Test Unregister',
        version: '1.0.0'
      };

      await registry.register(manifest);
      await registry.unregister('test-unregister');

      const moduleInfo = await registry.getModule('test-unregister');
      expect(moduleInfo).toBeNull();
    });

    it('should throw error when unregistering non-existent module', async () => {
      await expect(registry.unregister('non-existent')).rejects.toThrow(
        'Module non-existent is not registered'
      );
    });

    it('should throw error when unregistering module with dependents', async () => {
      // 注册依赖模块
      const depManifest: ModuleManifest = {
        name: 'test-base',
        displayName: 'Test Base',
        version: '1.0.0'
      };
      await registry.register(depManifest);

      // 注册依赖此模块的模块
      const manifest: ModuleManifest = {
        name: 'test-dependent',
        displayName: 'Test Dependent',
        version: '1.0.0',
        dependencies: {
          'test-base': '^1.0.0'
        }
      };
      await registry.register(manifest);

      // 尝试卸载被依赖的模块
      await expect(registry.unregister('test-base')).rejects.toThrow(
        'It is required by: test-dependent'
      );
    });
  });

  describe('getModule', () => {
    it('should return module info for existing module', async () => {
      const manifest: ModuleManifest = {
        name: 'test-get',
        displayName: 'Test Get',
        version: '1.0.0'
      };

      await registry.register(manifest);

      const moduleInfo = await registry.getModule('test-get');
      expect(moduleInfo).not.toBeNull();
      expect(moduleInfo?.manifest.name).toBe('test-get');
    });

    it('should return null for non-existent module', async () => {
      const moduleInfo = await registry.getModule('non-existent');
      expect(moduleInfo).toBeNull();
    });
  });

  describe('getAllModules', () => {
    it('should return all registered modules', async () => {
      const manifest1: ModuleManifest = {
        name: 'test-all-1',
        displayName: 'Test All 1',
        version: '1.0.0'
      };

      const manifest2: ModuleManifest = {
        name: 'test-all-2',
        displayName: 'Test All 2',
        version: '1.0.0'
      };

      await registry.register(manifest1);
      await registry.register(manifest2);

      const modules = await registry.getAllModules();
      const testModules = modules.filter(m => m.manifest.name.startsWith('test-all-'));
      
      expect(testModules.length).toBe(2);
    });
  });

  describe('getEnabledModules', () => {
    it('should return only enabled modules', async () => {
      const manifest: ModuleManifest = {
        name: 'test-enabled',
        displayName: 'Test Enabled',
        version: '1.0.0'
      };

      await registry.register(manifest);
      await registry.updateModuleStatus('test-enabled', 'enabled');

      const enabledModules = await registry.getEnabledModules();
      const testModule = enabledModules.find(m => m.manifest.name === 'test-enabled');
      
      expect(testModule).not.toBeUndefined();
      expect(testModule?.status).toBe('enabled');
    });
  });

  describe('checkDependencies', () => {
    it('should return satisfied for module with met dependencies', async () => {
      // 注册依赖模块
      const depManifest: ModuleManifest = {
        name: 'test-dep-check-base',
        displayName: 'Test Dep Check Base',
        version: '1.0.0'
      };
      await registry.register(depManifest);

      // 注册主模块
      const manifest: ModuleManifest = {
        name: 'test-dep-check',
        displayName: 'Test Dep Check',
        version: '1.0.0',
        dependencies: {
          'test-dep-check-base': '^1.0.0'
        }
      };
      await registry.register(manifest);

      const result = await registry.checkDependencies('test-dep-check');
      expect(result.satisfied).toBe(true);
      expect(result.missing).toHaveLength(0);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should return missing dependencies', async () => {
      const manifest: ModuleManifest = {
        name: 'test-missing-dep',
        displayName: 'Test Missing Dep',
        version: '1.0.0',
        dependencies: {
          'non-existent-module': '^1.0.0'
        }
      };
      await registry.register(manifest);

      const result = await registry.checkDependencies('test-missing-dep');
      expect(result.satisfied).toBe(false);
      expect(result.missing).toContain('non-existent-module');
    });

    it('should return version conflicts', async () => {
      // 注册依赖模块（版本 1.0.0）
      const depManifest: ModuleManifest = {
        name: 'test-conflict-base',
        displayName: 'Test Conflict Base',
        version: '1.0.0'
      };
      await registry.register(depManifest);

      // 注册主模块（要求版本 ^2.0.0）
      const manifest: ModuleManifest = {
        name: 'test-conflict',
        displayName: 'Test Conflict',
        version: '1.0.0',
        dependencies: {
          'test-conflict-base': '^2.0.0'
        }
      };
      await registry.register(manifest);

      const result = await registry.checkDependencies('test-conflict');
      expect(result.satisfied).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].module).toBe('test-conflict-base');
    });
  });

  describe('getDependencyTree', () => {
    it('should build dependency tree', async () => {
      // 注册基础模块
      const baseManifest: ModuleManifest = {
        name: 'test-tree-base',
        displayName: 'Test Tree Base',
        version: '1.0.0'
      };
      await registry.register(baseManifest);

      // 注册中间模块
      const midManifest: ModuleManifest = {
        name: 'test-tree-mid',
        displayName: 'Test Tree Mid',
        version: '1.0.0',
        dependencies: {
          'test-tree-base': '^1.0.0'
        }
      };
      await registry.register(midManifest);

      // 注册顶层模块
      const topManifest: ModuleManifest = {
        name: 'test-tree-top',
        displayName: 'Test Tree Top',
        version: '1.0.0',
        dependencies: {
          'test-tree-mid': '^1.0.0'
        }
      };
      await registry.register(topManifest);

      const tree = await registry.getDependencyTree('test-tree-top');
      expect(tree.name).toBe('test-tree-top');
      expect(tree.dependencies).toHaveLength(1);
      expect(tree.dependencies[0].name).toBe('test-tree-mid');
      expect(tree.dependencies[0].dependencies).toHaveLength(1);
      expect(tree.dependencies[0].dependencies[0].name).toBe('test-tree-base');
    });
  });
});
