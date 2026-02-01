/**
 * 数据库查询性能测试
 * 测试数据库查询性能和缓存效果
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { PermissionService } from '../../src/admin/services/PermissionService';
import { MenuService } from '../../src/admin/services/MenuService';
import { UserService } from '../../src/admin/services/UserService';
import { RoleService } from '../../src/admin/services/RoleService';
import { getDatabase } from '../../src/admin/core/database';
import { permissionCache, menuCache, userCache, roleCache } from '../../src/core/cache/CacheManager';

describe('数据库查询性能测试', () => {
  let permissionService: PermissionService;
  let menuService: MenuService;
  let userService: UserService;
  let roleService: RoleService;
  let db: any;

  beforeAll(async () => {
    db = await getDatabase();
    permissionService = new PermissionService(db);
    menuService = new MenuService(db);
    userService = new UserService(db);
    roleService = new RoleService(db);

    // 清空缓存
    await permissionCache.clear();
    await menuCache.clear();
    await userCache.clear();
    await roleCache.clear();
  });

  afterAll(async () => {
    if (db) {
      await db.end();
    }
  });

  describe('权限查询性能', () => {
    test('查询所有权限 < 50ms', async () => {
      const start = performance.now();
      const permissions = await permissionService.getAll();
      const duration = performance.now() - start;

      console.log(`权限查询耗时: ${duration.toFixed(2)}ms, 数量: ${permissions.length}`);
      expect(duration).toBeLessThan(50);
      expect(permissions).toBeDefined();
    });

    test('按ID查询权限 < 10ms', async () => {
      const permissions = await permissionService.getAll();
      if (permissions.length === 0) {
        console.log('跳过测试: 没有权限数据');
        return;
      }

      const testId = permissions[0].id;
      const start = performance.now();
      const permission = await permissionService.getById(testId);
      const duration = performance.now() - start;

      console.log(`按ID查询权限耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(10);
      expect(permission).toBeDefined();
    });

    test('按code查询权限 < 10ms', async () => {
      const permissions = await permissionService.getAll();
      if (permissions.length === 0) {
        console.log('跳过测试: 没有权限数据');
        return;
      }

      const testCode = permissions[0].code;
      const start = performance.now();
      const permission = await permissionService.getByCode(testCode);
      const duration = performance.now() - start;

      console.log(`按code查询权限耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(10);
      expect(permission).toBeDefined();
    });

    test('查询权限树 < 50ms', async () => {
      const start = performance.now();
      const tree = await permissionService.getTree();
      const duration = performance.now() - start;

      console.log(`权限树查询耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(50);
      expect(tree).toBeDefined();
    });
  });

  describe('菜单查询性能', () => {
    test('查询所有菜单 < 50ms', async () => {
      const start = performance.now();
      const menus = await menuService.getAll();
      const duration = performance.now() - start;

      console.log(`菜单查询耗时: ${duration.toFixed(2)}ms, 数量: ${menus.length}`);
      expect(duration).toBeLessThan(50);
      expect(menus).toBeDefined();
    });

    test('查询菜单树 < 50ms', async () => {
      const start = performance.now();
      const tree = await menuService.getTree();
      const duration = performance.now() - start;

      console.log(`菜单树查询耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(50);
      expect(tree).toBeDefined();
    });

    test('按ID查询菜单 < 10ms', async () => {
      const menus = await menuService.getAll();
      if (menus.length === 0) {
        console.log('跳过测试: 没有菜单数据');
        return;
      }

      const testId = menus[0].id;
      const start = performance.now();
      const menu = await menuService.getById(testId);
      const duration = performance.now() - start;

      console.log(`按ID查询菜单耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(10);
      expect(menu).toBeDefined();
    });

    test('查询子菜单 < 20ms', async () => {
      const menus = await menuService.getAll();
      const parentMenu = menus.find(m => m.parent_id === null);
      if (!parentMenu) {
        console.log('跳过测试: 没有父菜单');
        return;
      }

      const start = performance.now();
      const children = await menuService.getChildren(parentMenu.id);
      const duration = performance.now() - start;

      console.log(`查询子菜单耗时: ${duration.toFixed(2)}ms, 数量: ${children.length}`);
      expect(duration).toBeLessThan(20);
      expect(children).toBeDefined();
    });
  });

  describe('用户查询性能', () => {
    test('查询所有用户 < 50ms', async () => {
      const start = performance.now();
      const users = await userService.getAll();
      const duration = performance.now() - start;

      console.log(`用户查询耗时: ${duration.toFixed(2)}ms, 数量: ${users.length}`);
      expect(duration).toBeLessThan(50);
      expect(users).toBeDefined();
    });

    test('按ID查询用户 < 10ms', async () => {
      const users = await userService.getAll();
      if (users.length === 0) {
        console.log('跳过测试: 没有用户数据');
        return;
      }

      const testId = users[0].id;
      const start = performance.now();
      const user = await userService.getById(testId);
      const duration = performance.now() - start;

      console.log(`按ID查询用户耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(10);
      expect(user).toBeDefined();
    });

    test('按用户名查询用户 < 10ms', async () => {
      const users = await userService.getAll();
      if (users.length === 0) {
        console.log('跳过测试: 没有用户数据');
        return;
      }

      const testUsername = users[0].username;
      const start = performance.now();
      const user = await userService.getByUsername(testUsername);
      const duration = performance.now() - start;

      console.log(`按用户名查询用户耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(10);
      expect(user).toBeDefined();
    });

    test('分页查询用户 < 50ms', async () => {
      const start = performance.now();
      const result = await userService.getPage(1, 10);
      const duration = performance.now() - start;

      console.log(`分页查询用户耗时: ${duration.toFixed(2)}ms, 数量: ${result.items.length}`);
      expect(duration).toBeLessThan(50);
      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
    });
  });

  describe('角色查询性能', () => {
    test('查询所有角色 < 50ms', async () => {
      const start = performance.now();
      const roles = await roleService.getAll();
      const duration = performance.now() - start;

      console.log(`角色查询耗时: ${duration.toFixed(2)}ms, 数量: ${roles.length}`);
      expect(duration).toBeLessThan(50);
      expect(roles).toBeDefined();
    });

    test('按ID查询角色 < 10ms', async () => {
      const roles = await roleService.getAll();
      if (roles.length === 0) {
        console.log('跳过测试: 没有角色数据');
        return;
      }

      const testId = roles[0].id;
      const start = performance.now();
      const role = await roleService.getById(testId);
      const duration = performance.now() - start;

      console.log(`按ID查询角色耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(10);
      expect(role).toBeDefined();
    });

    test('按code查询角色 < 10ms', async () => {
      const roles = await roleService.getAll();
      if (roles.length === 0) {
        console.log('跳过测试: 没有角色数据');
        return;
      }

      const testCode = roles[0].code;
      const start = performance.now();
      const role = await roleService.getByCode(testCode);
      const duration = performance.now() - start;

      console.log(`按code查询角色耗时: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(10);
      expect(role).toBeDefined();
    });
  });

  describe('复杂查询性能', () => {
    test('查询用户的所有角色 < 20ms', async () => {
      const users = await userService.getAll();
      if (users.length === 0) {
        console.log('跳过测试: 没有用户数据');
        return;
      }

      const testUserId = users[0].id;
      const start = performance.now();
      const roles = await userService.getUserRoles(testUserId);
      const duration = performance.now() - start;

      console.log(`查询用户角色耗时: ${duration.toFixed(2)}ms, 数量: ${roles.length}`);
      expect(duration).toBeLessThan(20);
      expect(roles).toBeDefined();
    });

    test('查询角色的所有权限 < 20ms', async () => {
      const roles = await roleService.getAll();
      if (roles.length === 0) {
        console.log('跳过测试: 没有角色数据');
        return;
      }

      const testRoleId = roles[0].id;
      const start = performance.now();
      const permissions = await roleService.getRolePermissions(testRoleId);
      const duration = performance.now() - start;

      console.log(`查询角色权限耗时: ${duration.toFixed(2)}ms, 数量: ${permissions.length}`);
      expect(duration).toBeLessThan(20);
      expect(permissions).toBeDefined();
    });

    test('查询用户的所有权限 < 30ms', async () => {
      const users = await userService.getAll();
      if (users.length === 0) {
        console.log('跳过测试: 没有用户数据');
        return;
      }

      const testUserId = users[0].id;
      const start = performance.now();
      const permissions = await userService.getUserPermissions(testUserId);
      const duration = performance.now() - start;

      console.log(`查询用户权限耗时: ${duration.toFixed(2)}ms, 数量: ${permissions.length}`);
      expect(duration).toBeLessThan(30);
      expect(permissions).toBeDefined();
    });
  });

  describe('批量查询性能', () => {
    test('批量查询用户 < 50ms', async () => {
      const users = await userService.getAll();
      if (users.length < 3) {
        console.log('跳过测试: 用户数据不足');
        return;
      }

      const testIds = users.slice(0, 3).map(u => u.id);
      const start = performance.now();
      const result = await userService.getByIds(testIds);
      const duration = performance.now() - start;

      console.log(`批量查询用户耗时: ${duration.toFixed(2)}ms, 数量: ${result.length}`);
      expect(duration).toBeLessThan(50);
      expect(result).toBeDefined();
      expect(result.length).toBe(testIds.length);
    });

    test('批量查询角色 < 50ms', async () => {
      const roles = await roleService.getAll();
      if (roles.length < 3) {
        console.log('跳过测试: 角色数据不足');
        return;
      }

      const testIds = roles.slice(0, 3).map(r => r.id);
      const start = performance.now();
      const result = await roleService.getByIds(testIds);
      const duration = performance.now() - start;

      console.log(`批量查询角色耗时: ${duration.toFixed(2)}ms, 数量: ${result.length}`);
      expect(duration).toBeLessThan(50);
      expect(result).toBeDefined();
      expect(result.length).toBe(testIds.length);
    });
  });
});
