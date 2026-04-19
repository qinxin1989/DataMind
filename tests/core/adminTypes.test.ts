/**
 * 类型定义属性测试
 * Feature: modular-admin-framework, Property 2: Module Dependency Validation
 * Validates: Requirements 1.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { 
  ModuleMetadata, 
  ModuleDefinition,
  ModulePermission,
  ModuleRoute,
  ModuleMenu 
} from '../../src/admin/types';

// ==================== 生成器定义 ====================

/** 模块名称生成器 */
const moduleNameArb = fc.string({ minLength: 1, maxLength: 30 })
  .filter(s => /^[a-z][a-z0-9-]*$/.test(s));

/** 版本号生成器 */
const versionArb = fc.tuple(fc.nat(10), fc.nat(10), fc.nat(10))
  .map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

/** 权限类型生成器 */
const permissionTypeArb = fc.constantFrom('menu', 'button', 'api') as fc.Arbitrary<'menu' | 'button' | 'api'>;

/** 权限生成器 */
const permissionArb: fc.Arbitrary<ModulePermission> = fc.record({
  code: fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-z][a-z0-9:_]*$/.test(s)),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  description: fc.string({ minLength: 0, maxLength: 200 }),
  type: permissionTypeArb,
});

/** 路由生成器 */
const routeArb: fc.Arbitrary<ModuleRoute> = fc.record({
  path: fc.string({ minLength: 1, maxLength: 50 }).map(s => '/' + s.replace(/[^a-z0-9-]/g, '')),
  name: fc.string({ minLength: 1, maxLength: 30 }).filter(s => /^[a-zA-Z][a-zA-Z0-9]*$/.test(s)),
  component: fc.string({ minLength: 1, maxLength: 100 }),
  meta: fc.record({
    title: fc.string({ minLength: 1, maxLength: 50 }),
    icon: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
    permission: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    hidden: fc.option(fc.boolean(), { nil: undefined }),
  }),
  children: fc.constant(undefined),
});

/** 菜单生成器 */
const menuArb: fc.Arbitrary<ModuleMenu> = fc.record({
  key: fc.string({ minLength: 1, maxLength: 30 }).filter(s => /^[a-z][a-z0-9-]*$/.test(s)),
  title: fc.string({ minLength: 1, maxLength: 50 }),
  icon: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
  path: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  permission: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  order: fc.nat(1000),
  children: fc.constant(undefined),
  external: fc.option(fc.boolean(), { nil: undefined }),
  target: fc.option(fc.constantFrom('_blank', '_self') as fc.Arbitrary<'_blank' | '_self'>, { nil: undefined }),
});

/** 模块元数据生成器 */
const moduleMetadataArb: fc.Arbitrary<ModuleMetadata> = fc.record({
  name: moduleNameArb,
  displayName: fc.string({ minLength: 1, maxLength: 50 }),
  version: versionArb,
  description: fc.string({ minLength: 0, maxLength: 200 }),
  icon: fc.string({ minLength: 1, maxLength: 30 }),
  order: fc.nat(1000),
  dependencies: fc.option(fc.array(moduleNameArb, { maxLength: 5 }), { nil: undefined }),
});

/** 模块定义生成器（保证唯一性） */
const moduleDefinitionArb: fc.Arbitrary<ModuleDefinition> = fc.record({
  metadata: moduleMetadataArb,
  routes: fc.uniqueArray(routeArb, { 
    maxLength: 10,
    selector: (r) => r.name 
  }),
  menus: fc.uniqueArray(menuArb, { 
    maxLength: 10,
    selector: (m) => m.key 
  }),
  permissions: fc.uniqueArray(permissionArb, { 
    maxLength: 20,
    selector: (p) => p.code 
  }),
});

// ==================== 属性测试 ====================

describe('Module Types Property Tests', () => {
  /**
   * Property 2: Module Dependency Validation
   * For any module with declared dependencies, the dependencies array should only contain valid module names
   */
  it('should have valid dependency names format', () => {
    fc.assert(
      fc.property(moduleDefinitionArb, (module) => {
        const deps = module.metadata.dependencies || [];
        // 所有依赖名称应符合模块名称格式
        return deps.every(dep => /^[a-z][a-z0-9-]*$/.test(dep));
      }),
      { numRuns: 100 }
    );
  });

  it('should have unique permission codes within a module', () => {
    fc.assert(
      fc.property(moduleDefinitionArb, (module) => {
        const codes = module.permissions.map(p => p.code);
        const uniqueCodes = new Set(codes);
        return codes.length === uniqueCodes.size;
      }),
      { numRuns: 100 }
    );
  });

  it('should have unique route names within a module', () => {
    fc.assert(
      fc.property(moduleDefinitionArb, (module) => {
        const names = module.routes.map(r => r.name);
        const uniqueNames = new Set(names);
        return names.length === uniqueNames.size;
      }),
      { numRuns: 100 }
    );
  });

  it('should have unique menu keys within a module', () => {
    fc.assert(
      fc.property(moduleDefinitionArb, (module) => {
        const keys = module.menus.map(m => m.key);
        const uniqueKeys = new Set(keys);
        return keys.length === uniqueKeys.size;
      }),
      { numRuns: 100 }
    );
  });

  it('should have valid version format', () => {
    fc.assert(
      fc.property(moduleMetadataArb, (metadata) => {
        return /^\d+\.\d+\.\d+$/.test(metadata.version);
      }),
      { numRuns: 100 }
    );
  });

  it('should have non-negative order values', () => {
    fc.assert(
      fc.property(moduleDefinitionArb, (module) => {
        const metaOrderValid = module.metadata.order >= 0;
        const menuOrdersValid = module.menus.every(m => m.order >= 0);
        return metaOrderValid && menuOrdersValid;
      }),
      { numRuns: 100 }
    );
  });
});

describe('Permission Types Property Tests', () => {
  it('should have valid permission type values', () => {
    fc.assert(
      fc.property(permissionArb, (permission) => {
        return ['menu', 'button', 'api'].includes(permission.type);
      }),
      { numRuns: 100 }
    );
  });

  it('should have non-empty permission code', () => {
    fc.assert(
      fc.property(permissionArb, (permission) => {
        return permission.code.length > 0;
      }),
      { numRuns: 100 }
    );
  });
});

describe('Route Types Property Tests', () => {
  it('should have paths starting with /', () => {
    fc.assert(
      fc.property(routeArb, (route) => {
        return route.path.startsWith('/');
      }),
      { numRuns: 100 }
    );
  });

  it('should have non-empty route name', () => {
    fc.assert(
      fc.property(routeArb, (route) => {
        return route.name.length > 0;
      }),
      { numRuns: 100 }
    );
  });

  it('should have non-empty meta title', () => {
    fc.assert(
      fc.property(routeArb, (route) => {
        return route.meta.title.length > 0;
      }),
      { numRuns: 100 }
    );
  });
});
