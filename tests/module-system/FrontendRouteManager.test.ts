/**
 * FrontendRouteManager 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FrontendRouteManager, FrontendRouteConfig } from '../../src/module-system/core/FrontendRouteManager';

// Mock Vue Router
const createMockRouter = () => {
  const routes: any[] = [];
  return {
    addRoute: (route: any) => routes.push(route),
    removeRoute: (name: string) => {
      const index = routes.findIndex(r => r.name === name);
      if (index !== -1) routes.splice(index, 1);
    },
    getRoutes: () => routes,
    hasRoute: (name: string) => routes.some(r => r.name === name)
  };
};

describe('FrontendRouteManager', () => {
  let manager: FrontendRouteManager;

  beforeEach(() => {
    manager = new FrontendRouteManager();
  });

  describe('registerRoutes', () => {
    it('should register routes for a module', () => {
      const routes: FrontendRouteConfig[] = [
        {
          path: '/test',
          name: 'TestList',
          component: () => Promise.resolve({ default: {} })
        }
      ];

      manager.registerRoutes('test-module', routes);

      expect(manager.hasRoutes('test-module')).toBe(true);
      const moduleRoutes = manager.getModuleRoutes('test-module');
      expect(moduleRoutes).not.toBeNull();
      expect(moduleRoutes).toHaveLength(1);
    });

    it('should throw error when registering duplicate module', () => {
      const routes: FrontendRouteConfig[] = [
        {
          path: '/test',
          name: 'TestList',
          component: () => Promise.resolve({ default: {} })
        }
      ];

      manager.registerRoutes('test-module', routes);

      expect(() => {
        manager.registerRoutes('test-module', routes);
      }).toThrow('already registered');
    });

    it('should add module prefix to route names', () => {
      const routes: FrontendRouteConfig[] = [
        {
          path: '/test',
          name: 'TestList',
          component: () => Promise.resolve({ default: {} })
        }
      ];

      manager.registerRoutes('test-module', routes);

      const moduleRoutes = manager.getModuleRoutes('test-module');
      expect(moduleRoutes?.[0].name).toBe('test-module:TestList');
    });

    it('should handle routes without names', () => {
      const routes: FrontendRouteConfig[] = [
        {
          path: '/test',
          component: () => Promise.resolve({ default: {} })
        }
      ];

      // 应该发出警告但不抛出错误
      expect(() => {
        manager.registerRoutes('test-module', routes);
      }).not.toThrow();
    });

    it('should handle nested routes', () => {
      const routes: FrontendRouteConfig[] = [
        {
          path: '/test',
          name: 'Test',
          component: () => Promise.resolve({ default: {} }),
          children: [
            {
              path: 'list',
              name: 'TestList',
              component: () => Promise.resolve({ default: {} })
            }
          ]
        }
      ];

      manager.registerRoutes('test-module', routes);

      const moduleRoutes = manager.getModuleRoutes('test-module');
      expect(moduleRoutes?.[0].children).toHaveLength(1);
      expect(moduleRoutes?.[0].children?.[0].name).toBe('test-module:TestList');
    });

    it('should throw error for missing path', () => {
      const routes: any[] = [
        {
          name: 'TestList',
          component: () => Promise.resolve({ default: {} })
        }
      ];

      expect(() => {
        manager.registerRoutes('test-module', routes);
      }).toThrow('path is required');
    });
  });

  describe('unregisterRoutes', () => {
    it('should unregister routes for a module', () => {
      const routes: FrontendRouteConfig[] = [
        {
          path: '/test',
          name: 'TestList',
          component: () => Promise.resolve({ default: {} })
        }
      ];

      manager.registerRoutes('test-module', routes);
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
      const routes1: FrontendRouteConfig[] = [
        {
          path: '/test1',
          name: 'Test1',
          component: () => Promise.resolve({ default: {} })
        }
      ];

      const routes2: FrontendRouteConfig[] = [
        {
          path: '/test2',
          name: 'Test2',
          component: () => Promise.resolve({ default: {} })
        }
      ];

      manager.registerRoutes('module1', routes1);
      manager.registerRoutes('module2', routes2);

      const allRoutes = manager.getAllRoutes();
      expect(allRoutes).toHaveLength(2);
    });

    it('should return empty array when no routes registered', () => {
      const allRoutes = manager.getAllRoutes();
      expect(allRoutes).toHaveLength(0);
    });
  });

  describe('getModuleRoutes', () => {
    it('should return routes for existing module', () => {
      const routes: FrontendRouteConfig[] = [
        {
          path: '/test',
          name: 'TestList',
          component: () => Promise.resolve({ default: {} })
        }
      ];

      manager.registerRoutes('test-module', routes);

      const moduleRoutes = manager.getModuleRoutes('test-module');
      expect(moduleRoutes).not.toBeNull();
      expect(moduleRoutes).toHaveLength(1);
    });

    it('should return null for non-existent module', () => {
      const moduleRoutes = manager.getModuleRoutes('non-existent');
      expect(moduleRoutes).toBeNull();
    });
  });

  describe('hasRoutes', () => {
    it('should return true for registered module', () => {
      const routes: FrontendRouteConfig[] = [
        {
          path: '/test',
          name: 'TestList',
          component: () => Promise.resolve({ default: {} })
        }
      ];

      manager.registerRoutes('test-module', routes);

      expect(manager.hasRoutes('test-module')).toBe(true);
    });

    it('should return false for non-registered module', () => {
      expect(manager.hasRoutes('non-existent')).toBe(false);
    });
  });

  describe('addToRouter', () => {
    it('should add routes to Vue Router', () => {
      const mockRouter = createMockRouter() as any;
      const routes: FrontendRouteConfig[] = [
        {
          path: '/test',
          name: 'TestList',
          component: () => Promise.resolve({ default: {} })
        }
      ];

      manager.registerRoutes('test-module', routes);
      manager.addToRouter(mockRouter);

      expect(mockRouter.getRoutes()).toHaveLength(1);
    });

    it('should add all registered routes to router', () => {
      const mockRouter = createMockRouter() as any;
      
      const routes1: FrontendRouteConfig[] = [
        {
          path: '/test1',
          name: 'Test1',
          component: () => Promise.resolve({ default: {} })
        }
      ];

      const routes2: FrontendRouteConfig[] = [
        {
          path: '/test2',
          name: 'Test2',
          component: () => Promise.resolve({ default: {} })
        }
      ];

      manager.registerRoutes('module1', routes1);
      manager.registerRoutes('module2', routes2);
      manager.addToRouter(mockRouter);

      expect(mockRouter.getRoutes()).toHaveLength(2);
    });
  });

  describe('clear', () => {
    it('should clear all routes', () => {
      const routes1: FrontendRouteConfig[] = [
        {
          path: '/test1',
          name: 'Test1',
          component: () => Promise.resolve({ default: {} })
        }
      ];

      const routes2: FrontendRouteConfig[] = [
        {
          path: '/test2',
          name: 'Test2',
          component: () => Promise.resolve({ default: {} })
        }
      ];

      manager.registerRoutes('module1', routes1);
      manager.registerRoutes('module2', routes2);

      expect(manager.getAllRoutes()).toHaveLength(2);

      manager.clear();

      expect(manager.getAllRoutes()).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const routes1: FrontendRouteConfig[] = [
        {
          path: '/test1',
          name: 'Test1',
          component: () => Promise.resolve({ default: {} })
        },
        {
          path: '/test1/detail',
          name: 'Test1Detail',
          component: () => Promise.resolve({ default: {} })
        }
      ];

      const routes2: FrontendRouteConfig[] = [
        {
          path: '/test2',
          name: 'Test2',
          component: () => Promise.resolve({ default: {} })
        }
      ];

      manager.registerRoutes('module1', routes1);
      manager.registerRoutes('module2', routes2);

      const stats = manager.getStats();
      expect(stats.totalModules).toBe(2);
      expect(stats.totalRoutes).toBe(3);
      expect(stats.moduleStats).toHaveLength(2);
    });

    it('should count nested routes correctly', () => {
      const routes: FrontendRouteConfig[] = [
        {
          path: '/test',
          name: 'Test',
          component: () => Promise.resolve({ default: {} }),
          children: [
            {
              path: 'list',
              name: 'TestList',
              component: () => Promise.resolve({ default: {} })
            },
            {
              path: 'detail',
              name: 'TestDetail',
              component: () => Promise.resolve({ default: {} })
            }
          ]
        }
      ];

      manager.registerRoutes('test-module', routes);

      const stats = manager.getStats();
      expect(stats.totalRoutes).toBe(3); // 1 parent + 2 children
    });

    it('should return zero stats when no routes', () => {
      const stats = manager.getStats();
      expect(stats.totalModules).toBe(0);
      expect(stats.totalRoutes).toBe(0);
      expect(stats.moduleStats).toHaveLength(0);
    });
  });

  describe('route name conflicts', () => {
    it('should detect route name conflicts', () => {
      const routes1: FrontendRouteConfig[] = [
        {
          path: '/test1',
          name: 'TestList',
          component: () => Promise.resolve({ default: {} })
        }
      ];

      const routes2: FrontendRouteConfig[] = [
        {
          path: '/test2',
          name: 'TestList', // 相同的名称
          component: () => Promise.resolve({ default: {} })
        }
      ];

      manager.registerRoutes('module1', routes1);

      // 由于添加了模块前缀，实际上不会冲突
      expect(() => {
        manager.registerRoutes('module2', routes2);
      }).not.toThrow();
    });
  });
});
