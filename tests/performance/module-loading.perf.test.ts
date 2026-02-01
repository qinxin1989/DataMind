/**
 * 模块加载性能测试
 * 测试模块加载、注册、路由注册的性能
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BackendModuleLoader } from '../../src/module-system/core/BackendModuleLoader';
import { ModuleRegistry } from '../../src/module-system/core/ModuleRegistry';
import { BackendRouteManager } from '../../src/module-system/core/BackendRouteManager';
import { ManifestParser } from '../../src/module-system/core/ManifestParser';
import * as path from 'path';
import * as fs from 'fs/promises';
import express from 'express';

describe('模块加载性能测试', () => {
  let moduleLoader: BackendModuleLoader;
  let moduleRegistry: ModuleRegistry;
  let routeManager: BackendRouteManager;
  let app: express.Express;
  
  const modulesDir = path.join(process.cwd(), 'modules');
  const testModules = [
    'user-management',
    'role-management',
    'menu-management',
    'notification',
    'dashboard'
  ];

  beforeAll(async () => {
    app = express();
    moduleLoader = new BackendModuleLoader(modulesDir);
    moduleRegistry = new ModuleRegistry();
    routeManager = new BackendRouteManager(app);
  });

  afterAll(async () => {
    // 清理
    moduleLoader.clearAllCache();
  });

  describe('模块扫描性能', () => {
    it('应该在 100ms 内扫描所有模块', async () => {
      const startTime = performance.now();
      
      // 扫描模块目录
      const moduleNames: string[] = [];
      const entries = await fs.readdir(modulesDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const manifestPath = path.join(modulesDir, entry.name, 'module.json');
          try {
            await fs.access(manifestPath);
            moduleNames.push(entry.name);
          } catch {
            // 跳过没有 module.json 的目录
          }
        }
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`扫描 ${moduleNames.length} 个模块耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100);
      expect(moduleNames.length).toBeGreaterThan(0);
    });
  });

  describe('清单解析性能', () => {
    it('应该在 50ms 内解析单个模块清单', async () => {
      const moduleName = 'user-management';
      const manifestPath = path.join(modulesDir, moduleName, 'module.json');
      
      const startTime = performance.now();
      const manifest = ManifestParser.parseFromFile(manifestPath);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      console.log(`解析 ${moduleName} 清单耗时: ${duration.toFixed(2)}ms`);
      
      expect(duration).toBeLessThan(50);
      expect(manifest).toBeDefined();
      expect(manifest.name).toBe(moduleName);
    });

    it('应该在 200ms 内解析所有模块清单', async () => {
      const startTime = performance.now();
      
      const manifests = [];
      for (const moduleName of testModules) {
        const manifestPath = path.join(modulesDir, moduleName, 'module.json');
        try {
          const manifest = ManifestParser.parseFromFile(manifestPath);
          manifests.push(manifest);
        } catch (error) {
          console.warn(`跳过模块 ${moduleName}: ${error}`);
        }
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`解析 ${manifests.length} 个清单耗时: ${duration.toFixed(2)}ms`);
      console.log(`平均每个清单: ${(duration / manifests.length).toFixed(2)}ms`);
      
      expect(duration).toBeLessThan(200);
      expect(manifests.length).toBeGreaterThan(0);
    });
  });

  describe('模块加载性能', () => {
    it('应该在 100ms 内加载单个模块', async () => {
      const moduleName = 'user-management';
      const manifestPath = path.join(modulesDir, moduleName, 'module.json');
      const manifest = ManifestParser.parseFromFile(manifestPath);
      
      const startTime = performance.now();
      const loadedModule = await moduleLoader.load(moduleName, manifest);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      console.log(`加载 ${moduleName} 模块耗时: ${duration.toFixed(2)}ms`);
      
      expect(duration).toBeLessThan(100);
      expect(loadedModule).toBeDefined();
      expect(loadedModule.name).toBe(moduleName);
    });

    it('应该在 500ms 内加载所有核心模块', async () => {
      // 清理缓存
      moduleLoader.clearAllCache();
      
      const startTime = performance.now();
      
      const loadedModules = [];
      for (const moduleName of testModules) {
        const manifestPath = path.join(modulesDir, moduleName, 'module.json');
        try {
          const manifest = ManifestParser.parseFromFile(manifestPath);
          const loadedModule = await moduleLoader.load(moduleName, manifest);
          loadedModules.push(loadedModule);
        } catch (error) {
          console.warn(`跳过模块 ${moduleName}: ${error}`);
        }
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`加载 ${loadedModules.length} 个模块耗时: ${duration.toFixed(2)}ms`);
      console.log(`平均每个模块: ${(duration / loadedModules.length).toFixed(2)}ms`);
      
      expect(duration).toBeLessThan(500);
      expect(loadedModules.length).toBeGreaterThan(0);
    });

    it('缓存的模块应该在 1ms 内返回', async () => {
      const moduleName = 'user-management';
      const manifestPath = path.join(modulesDir, moduleName, 'module.json');
      const manifest = ManifestParser.parseFromFile(manifestPath);
      
      // 首次加载
      await moduleLoader.load(moduleName, manifest);
      
      // 从缓存加载
      const startTime = performance.now();
      const loadedModule = await moduleLoader.load(moduleName, manifest);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      console.log(`从缓存加载 ${moduleName} 耗时: ${duration.toFixed(2)}ms`);
      
      expect(duration).toBeLessThan(1);
      expect(loadedModule).toBeDefined();
    });
  });

  describe('模块注册性能', () => {
    it('应该在 10ms 内注册单个模块', async () => {
      const moduleName = 'test-perf-module';
      const manifest = {
        name: moduleName,
        version: '1.0.0',
        displayName: '性能测试模块',
        description: '用于性能测试',
        author: 'test',
        dependencies: []
      };
      
      const startTime = performance.now();
      await moduleRegistry.register(manifest as any);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      console.log(`注册 ${moduleName} 耗时: ${duration.toFixed(2)}ms`);
      
      expect(duration).toBeLessThan(10);
      
      // 清理
      await moduleRegistry.unregister(moduleName);
    });

    it('应该在 100ms 内注册所有核心模块', async () => {
      const startTime = performance.now();
      
      let registeredCount = 0;
      for (const moduleName of testModules) {
        const manifestPath = path.join(modulesDir, moduleName, 'module.json');
        try {
          const manifest = ManifestParser.parseFromFile(manifestPath);
          
          // 检查是否已注册
          const existing = await moduleRegistry.getModule(moduleName);
          if (!existing) {
            await moduleRegistry.register(manifest);
            registeredCount++;
          }
        } catch (error) {
          console.warn(`跳过模块 ${moduleName}: ${error}`);
        }
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`注册 ${registeredCount} 个模块耗时: ${duration.toFixed(2)}ms`);
      if (registeredCount > 0) {
        console.log(`平均每个模块: ${(duration / registeredCount).toFixed(2)}ms`);
      }
      
      expect(duration).toBeLessThan(100);
    });
  });

  describe('路由注册性能', () => {
    it('应该在 5ms 内注册单个路由', async () => {
      const moduleName = 'test-route-module';
      const router = express.Router();
      router.get('/test', (req, res) => res.json({ ok: true }));
      
      const startTime = performance.now();
      routeManager.registerRoutes(moduleName, router, '/api/test');
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      console.log(`注册路由耗时: ${duration.toFixed(2)}ms`);
      
      expect(duration).toBeLessThan(5);
      
      // 清理
      routeManager.unregisterRoutes(moduleName);
    });

    it('应该在 50ms 内注册所有模块路由', async () => {
      const startTime = performance.now();
      
      let routeCount = 0;
      for (const moduleName of testModules) {
        try {
          const loadedModule = moduleLoader.getLoadedModule(moduleName);
          if (loadedModule?.router) {
            const manifestPath = path.join(modulesDir, moduleName, 'module.json');
            const manifest = ManifestParser.parseFromFile(manifestPath);
            const basePath = manifest.backend?.routes?.basePath || `/api/${moduleName}`;
            
            if (!routeManager.hasRoutes(moduleName)) {
              routeManager.registerRoutes(moduleName, loadedModule.router, basePath);
              routeCount++;
            }
          }
        } catch (error) {
          console.warn(`跳过模块 ${moduleName}: ${error}`);
        }
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`注册 ${routeCount} 个路由耗时: ${duration.toFixed(2)}ms`);
      if (routeCount > 0) {
        console.log(`平均每个路由: ${(duration / routeCount).toFixed(2)}ms`);
      }
      
      expect(duration).toBeLessThan(50);
    });
  });

  describe('完整启动流程性能', () => {
    it('应该在 1000ms 内完成完整的模块系统启动', async () => {
      // 清理所有缓存
      moduleLoader.clearAllCache();
      
      const startTime = performance.now();
      
      // 1. 扫描模块
      const moduleNames: string[] = [];
      const entries = await fs.readdir(modulesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && testModules.includes(entry.name)) {
          const manifestPath = path.join(modulesDir, entry.name, 'module.json');
          try {
            await fs.access(manifestPath);
            moduleNames.push(entry.name);
          } catch {
            // 跳过
          }
        }
      }
      
      // 2. 解析清单
      const manifests = [];
      for (const moduleName of moduleNames) {
        const manifestPath = path.join(modulesDir, moduleName, 'module.json');
        try {
          const manifest = ManifestParser.parseFromFile(manifestPath);
          manifests.push({ name: moduleName, manifest });
        } catch (error) {
          console.warn(`解析清单失败 ${moduleName}: ${error}`);
        }
      }
      
      // 3. 加载模块
      const loadedModules = [];
      for (const { name, manifest } of manifests) {
        try {
          const loadedModule = await moduleLoader.load(name, manifest);
          loadedModules.push(loadedModule);
        } catch (error) {
          console.warn(`加载模块失败 ${name}: ${error}`);
        }
      }
      
      // 4. 注册路由
      let routeCount = 0;
      for (const loadedModule of loadedModules) {
        if (loadedModule.router) {
          const manifest = manifests.find(m => m.name === loadedModule.name)?.manifest;
          if (manifest) {
            const basePath = manifest.backend?.routes?.basePath || `/api/${loadedModule.name}`;
            if (!routeManager.hasRoutes(loadedModule.name)) {
              routeManager.registerRoutes(loadedModule.name, loadedModule.router, basePath);
              routeCount++;
            }
          }
        }
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log('\n=== 完整启动流程性能报告 ===');
      console.log(`总耗时: ${duration.toFixed(2)}ms`);
      console.log(`扫描模块: ${moduleNames.length} 个`);
      console.log(`解析清单: ${manifests.length} 个`);
      console.log(`加载模块: ${loadedModules.length} 个`);
      console.log(`注册路由: ${routeCount} 个`);
      console.log(`平均每个模块: ${(duration / loadedModules.length).toFixed(2)}ms`);
      console.log('===========================\n');
      
      expect(duration).toBeLessThan(1000);
      expect(loadedModules.length).toBeGreaterThan(0);
    });
  });
});
