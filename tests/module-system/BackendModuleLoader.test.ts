/**
 * 后端模块加载器单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BackendModuleLoader } from '../../src/module-system/core/BackendModuleLoader';
import type { ModuleManifest } from '../../src/module-system/types';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs 模块
vi.mock('fs/promises');

describe('BackendModuleLoader', () => {
  let loader: BackendModuleLoader;
  const testModulesDir = 'test-modules';

  beforeEach(() => {
    loader = new BackendModuleLoader(testModulesDir);
    vi.clearAllMocks();
  });

  afterEach(() => {
    loader.clearAllCache();
  });

  describe('load', () => {
    it('should load a module successfully', async () => {
      const manifest: ModuleManifest = {
        name: 'test-module',
        displayName: 'Test Module',
        version: '1.0.0'
      };

      // Mock 文件系统
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true
      } as any);

      // 不加载任何文件，只测试基本逻辑
      const result = await loader.load('test-module', manifest);

      expect(result.name).toBe('test-module');
      expect(loader.isLoaded('test-module')).toBe(true);
    });

    it('should return cached module if already loaded', async () => {
      const manifest: ModuleManifest = {
        name: 'test-module',
        displayName: 'Test Module',
        version: '1.0.0'
      };

      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true
      } as any);

      const result1 = await loader.load('test-module', manifest);
      const result2 = await loader.load('test-module', manifest);

      expect(result1).toBe(result2);
    });

    it('should throw error if module directory not found', async () => {
      const manifest: ModuleManifest = {
        name: 'non-existent',
        displayName: 'Non Existent',
        version: '1.0.0'
      };

      vi.mocked(fs.stat).mockRejectedValue({ code: 'ENOENT' });

      await expect(loader.load('non-existent', manifest)).rejects.toThrow('Module directory not found');
    });

    it('should throw error if module path is not a directory', async () => {
      const manifest: ModuleManifest = {
        name: 'test-module',
        displayName: 'Test Module',
        version: '1.0.0'
      };

      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => false
      } as any);

      await expect(loader.load('test-module', manifest)).rejects.toThrow('Module path is not a directory');
    });
  });

  describe('unload', () => {
    it('should unload a loaded module', async () => {
      const manifest: ModuleManifest = {
        name: 'test-module',
        displayName: 'Test Module',
        version: '1.0.0'
      };

      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true
      } as any);

      await loader.load('test-module', manifest);
      expect(loader.isLoaded('test-module')).toBe(true);

      await loader.unload('test-module');
      expect(loader.isLoaded('test-module')).toBe(false);
    });

    it('should not throw error when unloading non-existent module', async () => {
      await expect(loader.unload('non-existent')).resolves.not.toThrow();
    });
  });

  describe('reload', () => {
    it('should reload a module', async () => {
      const manifest: ModuleManifest = {
        name: 'test-module',
        displayName: 'Test Module',
        version: '1.0.0'
      };

      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true
      } as any);

      await loader.load('test-module', manifest);
      const result = await loader.reload('test-module', manifest);

      expect(result.name).toBe('test-module');
      expect(loader.isLoaded('test-module')).toBe(true);
    });
  });

  describe('getLoadedModule', () => {
    it('should return loaded module', async () => {
      const manifest: ModuleManifest = {
        name: 'test-module',
        displayName: 'Test Module',
        version: '1.0.0'
      };

      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true
      } as any);

      await loader.load('test-module', manifest);
      const result = loader.getLoadedModule('test-module');

      expect(result).toBeDefined();
      expect(result?.name).toBe('test-module');
    });

    it('should return undefined for non-loaded module', () => {
      const result = loader.getLoadedModule('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('getAllLoadedModules', () => {
    it('should return all loaded modules', async () => {
      const manifest1: ModuleManifest = {
        name: 'module1',
        displayName: 'Module 1',
        version: '1.0.0'
      };

      const manifest2: ModuleManifest = {
        name: 'module2',
        displayName: 'Module 2',
        version: '1.0.0'
      };

      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true
      } as any);

      await loader.load('module1', manifest1);
      await loader.load('module2', manifest2);

      const modules = loader.getAllLoadedModules();
      expect(modules).toHaveLength(2);
      expect(modules.map(m => m.name)).toContain('module1');
      expect(modules.map(m => m.name)).toContain('module2');
    });

    it('should return empty array when no modules loaded', () => {
      const modules = loader.getAllLoadedModules();
      expect(modules).toHaveLength(0);
    });
  });

  describe('isLoaded', () => {
    it('should return true for loaded module', async () => {
      const manifest: ModuleManifest = {
        name: 'test-module',
        displayName: 'Test Module',
        version: '1.0.0'
      };

      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true
      } as any);

      await loader.load('test-module', manifest);
      expect(loader.isLoaded('test-module')).toBe(true);
    });

    it('should return false for non-loaded module', () => {
      expect(loader.isLoaded('non-existent')).toBe(false);
    });
  });

  describe('clearAllCache', () => {
    it('should clear all loaded modules and cache', async () => {
      const manifest: ModuleManifest = {
        name: 'test-module',
        displayName: 'Test Module',
        version: '1.0.0'
      };

      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true
      } as any);

      await loader.load('test-module', manifest);
      expect(loader.isLoaded('test-module')).toBe(true);

      loader.clearAllCache();
      expect(loader.isLoaded('test-module')).toBe(false);
      expect(loader.getAllLoadedModules()).toHaveLength(0);
    });
  });
});
