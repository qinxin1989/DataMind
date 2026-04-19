/**
 * 模块注册中心属性测试
 * Feature: modular-admin-framework, Property 1: Module Registration Round-Trip
 * Validates: Requirements 1.2, 1.3, 1.4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ModuleRegistry } from '../../src/admin/core/moduleRegistry';
import type { ModuleDefinition, ModulePermission, ModuleRoute, ModuleMenu } from '../../src/admin/types';

// ==================== 生成器定义 ====================

const moduleNameArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => /^[a-z][a-z0-9-]*$/.test(s));

const versionArb = fc.tuple(fc.nat(10), fc.nat(10), fc.nat(10))
  .map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

const permissionTypeArb = fc.constantFrom('menu', 'button', 'api') as fc.Arbitrary<'menu' | 'button' | 'api'>;

const permissionArb: fc.Arbitrary<ModulePermission> = fc.record({
  code: fc.string({ minLength: 1, maxLength: 30 }).filter(s => /^[a-z][a-z0-9:_]*$/.test(s)),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  description: fc.string({ minLength: 0, maxLength: 100 }),
  type: permissionTypeArb,
});

const routeArb: fc.Arbitrary<ModuleRoute> = fc.record({
  path: fc.string({ minLength: 1, maxLength: 30 }).map(s => '/' + s.replace(/[^a-z0-9-]/g, '')),
  name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s)),
  component: fc.string({ minLength: 1, maxLength: 50 }),
  meta: fc.record({
    title: fc.string({ minLength: 1, maxLength: 30 }),
    icon: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
    permission: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
    hidden: fc.option(fc.boolean(), { nil: undefined }),
  }),
  children: fc.constant(undefined),
});

const menuArb: fc.Arbitrary<ModuleMenu> = fc.record({
  key: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z][a-z0-9-]*$/.test(s)),
  title: fc.string({ minLength: 1, maxLength: 30 }),
  icon: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  path: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  permission: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
  order: fc.nat(100),
  children: fc.constant(undefined),
  external: fc.option(fc.boolean(), { nil: undefined }),
  target: fc.option(fc.constantFrom('_blank', '_self') as fc.Arbitrary<'_blank' | '_self'>, { nil: undefined }),
});

const moduleDefinitionArb: fc.Arbitrary<ModuleDefinition> = fc.record({
  metadata: fc.record({
    name: moduleNameArb,
    displayName: fc.string({ minLength: 1, maxLength: 30 }),
    version: versionArb,
    description: fc.string({ minLength: 0, maxLength: 100 }),
    icon: fc.string({ minLength: 1, maxLength: 20 }),
    order: fc.nat(100),
    dependencies: fc.constant(undefined), // 无依赖的模块
  }),
  routes: fc.uniqueArray(routeArb, { maxLength: 5, selector: r => r.name }),
  menus: fc.uniqueArray(menuArb, { maxLength: 5, selector: m => m.key }),
  permissions: fc.uniqueArray(permissionArb, { maxLength: 10, selector: p => p.code }),
});

// 生成多个不同名称的模块
const uniqueModulesArb = fc.array(moduleDefinitionArb, { minLength: 1, maxLength: 5 })
  .map(modules => {
    // 确保模块名称唯一
    const seen = new Set<string>();
    return modules.filter(m => {
      if (seen.has(m.metadata.name)) return false;
      seen.add(m.metadata.name);
      return true;
    });
  })
  .filter(modules => modules.length > 0);

// ==================== 属性测试 ====================

describe('ModuleRegistry Property Tests', () => {
  let registry: ModuleRegistry;

  beforeEach(() => {
    registry = new ModuleRegistry();
  });

  /**
   * Property 1: Module Registration Round-Trip
   * For any valid module definition, registering the module and then unregistering it
   * should leave the system in its original state
   */
  it('should return to original state after register and unregister (round-trip)', async () => {
    await fc.assert(
      fc.asyncProperty(moduleDefinitionArb, async (module) => {
        const registry = new ModuleRegistry();
        
        // 记录初始状态
        const initialModuleCount = registry.getModuleCount();
        const initialMenuCount = registry.getMenus().length;
        const initialPermCount = registry.getPermissions().length;
        const initialRouteCount = registry.getRoutes().length;

        // 注册模块
        await registry.register(module);

        // 验证模块已注册
        expect(registry.isRegistered(module.metadata.name)).toBe(true);
        expect(registry.getModuleCount()).toBe(initialModuleCount + 1);

        // 卸载模块
        await registry.unregister(module.metadata.name);

        // 验证回到初始状态
        expect(registry.isRegistered(module.metadata.name)).toBe(false);
        expect(registry.getModuleCount()).toBe(initialModuleCount);
        expect(registry.getMenus().length).toBe(initialMenuCount);
        expect(registry.getPermissions().length).toBe(initialPermCount);
        expect(registry.getRoutes().length).toBe(initialRouteCount);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Module Dependency Validation
   * For any module with declared dependencies, if any dependency is not registered,
   * the registration should fail
   */
  it('should reject registration when dependencies are missing', async () => {
    await fc.assert(
      fc.asyncProperty(
        moduleDefinitionArb,
        fc.array(moduleNameArb, { minLength: 1, maxLength: 3 }),
        async (module, missingDeps) => {
          const registry = new ModuleRegistry();
          
          // 创建带有不存在依赖的模块
          const moduleWithDeps: ModuleDefinition = {
            ...module,
            metadata: {
              ...module.metadata,
              dependencies: missingDeps.filter(d => d !== module.metadata.name),
            },
          };

          // 如果有依赖，注册应该失败
          if (moduleWithDeps.metadata.dependencies && moduleWithDeps.metadata.dependencies.length > 0) {
            await expect(registry.register(moduleWithDeps)).rejects.toThrow(/missing dependencies/);
            
            // 验证依赖检查结果
            const depCheck = registry.checkDependencies(moduleWithDeps);
            expect(depCheck.valid).toBe(false);
            expect(depCheck.missing.length).toBeGreaterThan(0);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Registering multiple modules should accumulate menus and permissions
   */
  it('should accumulate menus and permissions from multiple modules', async () => {
    await fc.assert(
      fc.asyncProperty(uniqueModulesArb, async (modules) => {
        const registry = new ModuleRegistry();
        
        let expectedMenuCount = 0;
        let expectedPermCount = 0;

        for (const module of modules) {
          await registry.register(module);
          expectedMenuCount += module.menus.length;
          expectedPermCount += module.permissions.length;
        }

        expect(registry.getMenus().length).toBe(expectedMenuCount);
        expect(registry.getPermissions().length).toBe(expectedPermCount);
        expect(registry.getModuleCount()).toBe(modules.length);

        return true;
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Cannot register the same module twice
   */
  it('should reject duplicate module registration', async () => {
    await fc.assert(
      fc.asyncProperty(moduleDefinitionArb, async (module) => {
        const registry = new ModuleRegistry();
        
        // 第一次注册应该成功
        await registry.register(module);
        
        // 第二次注册应该失败
        await expect(registry.register(module)).rejects.toThrow(/already registered/);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Module status should be 'loaded' after successful registration
   */
  it('should set status to loaded after successful registration', async () => {
    await fc.assert(
      fc.asyncProperty(moduleDefinitionArb, async (module) => {
        const registry = new ModuleRegistry();
        
        await registry.register(module);
        
        expect(registry.getModuleStatus(module.metadata.name)).toBe('loaded');

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Menus should be sorted by order
   */
  it('should return menus sorted by order', async () => {
    await fc.assert(
      fc.asyncProperty(uniqueModulesArb, async (modules) => {
        const registry = new ModuleRegistry();
        
        for (const module of modules) {
          await registry.register(module);
        }

        const menus = registry.getMenus();
        
        // 验证菜单按 order 排序
        for (let i = 1; i < menus.length; i++) {
          expect(menus[i].order).toBeGreaterThanOrEqual(menus[i - 1].order);
        }

        return true;
      }),
      { numRuns: 50 }
    );
  });
});

describe('ModuleRegistry Unit Tests', () => {
  let registry: ModuleRegistry;

  beforeEach(() => {
    registry = new ModuleRegistry();
  });

  it('should start with no modules', () => {
    expect(registry.getModuleCount()).toBe(0);
    expect(registry.getAllModules()).toHaveLength(0);
  });

  it('should return undefined for non-existent module', () => {
    expect(registry.getModule('non-existent')).toBeUndefined();
    expect(registry.getModuleStatus('non-existent')).toBeUndefined();
  });

  it('should throw when unregistering non-existent module', async () => {
    await expect(registry.unregister('non-existent')).rejects.toThrow(/not registered/);
  });

  it('should clear all modules', async () => {
    const module: ModuleDefinition = {
      metadata: {
        name: 'test-module',
        displayName: 'Test',
        version: '1.0.0',
        description: 'Test module',
        icon: 'test',
        order: 1,
      },
      routes: [],
      menus: [{ key: 'test', title: 'Test', order: 1 }],
      permissions: [{ code: 'test:view', name: 'View', description: '', type: 'menu' }],
    };

    await registry.register(module);
    expect(registry.getModuleCount()).toBe(1);

    registry.clear();
    expect(registry.getModuleCount()).toBe(0);
    expect(registry.getMenus()).toHaveLength(0);
    expect(registry.getPermissions()).toHaveLength(0);
  });
});
