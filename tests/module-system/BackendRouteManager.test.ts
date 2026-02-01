/**
 * BackendRouteManager 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BackendRouteManager } from '../../src/module-system/core/BackendRouteManager';
import express, { Router, Express } from 'express';

describe('BackendRouteManager', () => {
  let app: Express;
  let manager: BackendRouteManager;

  beforeEach(() => {
    app = express();
    manager = new BackendRouteManager(app);
  });

  describe('registerRoutes', () => {
    it('should register routes for a module', () => {
      const router = Router();
      router.get('/list', (req, res) => res.json({ success: true }));
      router.post('/create', (req, res) => res.json({ success: true }));

      manager.registerRoutes('test-module', router, '/test');

      expect(manager.hasRoutes('test-module')).toBe(true);
      const routeInfo = manager.getModuleRoutes('test-module');
      expect(routeInfo).not.toBeNull();
      expect(routeInfo?.prefix).toBe('/test');
    });

    it('should throw error when registering duplicate module', () => {
      const router = Router();
      router.get('/list', (req, res) => res.json({ success: true }));

      manager.registerRoutes('test-module', router, '/test');

      expect(() => {
        manager.registerRoutes('test-module', router, '/test');
      }).toThrow('already registered');
    });

    it('should normalize route prefix', () => {
      const router = Router();
      router.get('/list', (req, res) => res.json({ success: true }));

      // 测试各种前缀格式
      manager.registerRoutes('test1', router, 'test1'); // 无前导斜杠
      manager.registerRoutes('test2', Router(), '/test2/'); // 有尾随斜杠
      manager.registerRoutes('test3', Router(), '/test3'); // 标准格式

      expect(manager.getModuleRoutes('test1')?.prefix).toBe('/test1');
      expect(manager.getModuleRoutes('test2')?.prefix).toBe('/test2');
      expect(manager.getModuleRoutes('test3')?.prefix).toBe('/test3');
    });

    it('should register routes without prefix', () => {
      const router = Router();
      router.get('/list', (req, res) => res.json({ success: true }));

      manager.registerRoutes('test-module', router);

      const routeInfo = manager.getModuleRoutes('test-module');
      expect(routeInfo?.prefix).toBe('');
    });
  });

  describe('unregisterRoutes', () => {
    it('should unregister routes for a module', () => {
      const router = Router();
      router.get('/list', (req, res) => res.json({ success: true }));

      manager.registerRoutes('test-module', router, '/test');
      expect(manager.hasRoutes('test-module')).toBe(true);

      manager.unregisterRoutes('test-module');
      expect(manager.hasRoutes('test-module')).toBe(false);
    });

    it('should throw error when unregistering non-existent module', () => {
      expect(() => {
        manager.unregisterRoutes('non-existent');
      }).toThrow('not registered');
    });
  });

  describe('getAllRoutes', () => {
    it('should return all registered routes', () => {
      const router1 = Router();
      router1.get('/list', (req, res) => res.json({ success: true }));

      const router2 = Router();
      router2.get('/list', (req, res) => res.json({ success: true }));

      manager.registerRoutes('module1', router1, '/module1');
      manager.registerRoutes('module2', router2, '/module2');

      const allRoutes = manager.getAllRoutes();
      expect(allRoutes).toHaveLength(2);
      expect(allRoutes.map(r => r.moduleName)).toContain('module1');
      expect(allRoutes.map(r => r.moduleName)).toContain('module2');
    });

    it('should return empty array when no routes registered', () => {
      const allRoutes = manager.getAllRoutes();
      expect(allRoutes).toHaveLength(0);
    });
  });

  describe('getModuleRoutes', () => {
    it('should return route info for existing module', () => {
      const router = Router();
      router.get('/list', (req, res) => res.json({ success: true }));

      manager.registerRoutes('test-module', router, '/test');

      const routeInfo = manager.getModuleRoutes('test-module');
      expect(routeInfo).not.toBeNull();
      expect(routeInfo?.moduleName).toBe('test-module');
      expect(routeInfo?.prefix).toBe('/test');
    });

    it('should return null for non-existent module', () => {
      const routeInfo = manager.getModuleRoutes('non-existent');
      expect(routeInfo).toBeNull();
    });
  });

  describe('hasRoutes', () => {
    it('should return true for registered module', () => {
      const router = Router();
      manager.registerRoutes('test-module', router, '/test');

      expect(manager.hasRoutes('test-module')).toBe(true);
    });

    it('should return false for non-registered module', () => {
      expect(manager.hasRoutes('non-existent')).toBe(false);
    });
  });

  describe('checkConflict', () => {
    it('should detect path conflicts', () => {
      const router = Router();
      router.get('/users', (req, res) => res.json({ success: true }));

      manager.registerRoutes('module1', router, '/api');

      // 检查冲突
      expect(manager.checkConflict('/api/users', 'GET')).toBe(true);
    });

    it('should not detect conflict for different paths', () => {
      const router = Router();
      router.get('/users', (req, res) => res.json({ success: true }));

      manager.registerRoutes('module1', router, '/api');

      expect(manager.checkConflict('/api/posts', 'GET')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all routes', () => {
      const router1 = Router();
      const router2 = Router();

      manager.registerRoutes('module1', router1, '/module1');
      manager.registerRoutes('module2', router2, '/module2');

      expect(manager.getAllRoutes()).toHaveLength(2);

      manager.clear();

      expect(manager.getAllRoutes()).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const router1 = Router();
      router1.get('/list', (req, res) => res.json({ success: true }));
      router1.post('/create', (req, res) => res.json({ success: true }));

      const router2 = Router();
      router2.get('/list', (req, res) => res.json({ success: true }));

      manager.registerRoutes('module1', router1, '/module1');
      manager.registerRoutes('module2', router2, '/module2');

      const stats = manager.getStats();
      expect(stats.totalModules).toBe(2);
      expect(stats.moduleStats).toHaveLength(2);
    });

    it('should return zero stats when no routes', () => {
      const stats = manager.getStats();
      expect(stats.totalModules).toBe(0);
      expect(stats.totalRoutes).toBe(0);
      expect(stats.moduleStats).toHaveLength(0);
    });
  });
});
