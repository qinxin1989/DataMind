/**
 * 核心服务性能测试
 * Task 23.2 - 性能测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { performance } from 'perf_hooks';
import { PermissionService } from '../../src/admin/services/permissionService';
import { MenuService } from '../../src/admin/modules/menu/menuService';
import { UserService } from '../../src/admin/modules/user/userService';
import type { Role } from '../../src/admin/types';

// 性能测试辅助函数
function measurePerformance<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  return new Promise(async (resolve) => {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    const duration = end - start;
    resolve({ result, duration });
  });
}

// 性能数据收集
const performanceData: any[] = [];

function recordPerformance(service: string, operation: string, duration: number, target: number) {
  const status = duration < target ? 'PASS' : 'FAIL';
  performanceData.push({
    service,
    operation,
    duration: Math.round(duration * 100) / 100,
    target,
    status,
  });
  console.log(`[${status}] ${service}.${operation}: ${Math.round(duration)}ms (target: ${target}ms)`);
}

describe('Core Services Performance Tests', () => {
  let permissionService: PermissionService;
  let menuService: MenuService;
  let userService: UserService;

  beforeAll(async () => {
    permissionService = new PermissionService();
    menuService = new MenuService();
    userService = new UserService();

    // 准备测试数据
    await permissionService.clearAll();
    await menuService.clearAll();
    await userService.clearAll();

    // 创建测试角色
    const role: Role = {
      id: 'perf-test-role',
      name: 'Performance Test Role',
      code: 'perf_test',
      description: 'Role for performance testing',
      permissionCodes: ['user:view', 'user:create', 'user:update', 'user:delete'],
      menuIds: [],
      status: 'active',
      isSystem: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    permissionService.setRoleForTest(role);
    permissionService.setUserRolesForTest('perf-test-user', ['perf-test-role']);

    // 创建测试菜单
    for (let i = 0; i < 10; i++) {
      await menuService.createMenu({
        title: `Test Menu ${i}`,
        order: i,
        visible: true,
      });
    }

    // 创建测试用户
    for (let i = 0; i < 10; i++) {
      await userService.createUser({
        username: `perfuser${i}`,
        password: 'TestPass123',
        email: `perfuser${i}@test.com`,
      });
    }
  });

  afterAll(async () => {
    // 清理测试数据
    await permissionService.clearAll();
    await menuService.clearAll();
    await userService.clearAll();

    // 输出性能报告
    console.log('\n=== Performance Test Summary ===');
    console.log(JSON.stringify(performanceData, null, 2));
  });

  describe('PermissionService Performance', () => {
    it('should get role permissions quickly', async () => {
      const { duration } = await measurePerformance(async () => {
        return await permissionService.getRolePermissions('perf-test-role');
      });

      recordPerformance('PermissionService', 'getRolePermissions', duration, 50);
      expect(duration).toBeLessThan(100); // 宽松的限制
    });

    it('should check permission quickly', async () => {
      const { duration } = await measurePerformance(async () => {
        return await permissionService.hasPermission('perf-test-user', 'user:view');
      });

      recordPerformance('PermissionService', 'hasPermission', duration, 10);
      expect(duration).toBeLessThan(50); // 宽松的限制
    });

    it('should get user permissions quickly', async () => {
      const { duration } = await measurePerformance(async () => {
        return await permissionService.getUserPermissions('perf-test-user');
      });

      recordPerformance('PermissionService', 'getUserPermissions', duration, 50);
      expect(duration).toBeLessThan(100); // 宽松的限制
    });
  });

  describe('MenuService Performance', () => {
    it('should get menu tree quickly', async () => {
      const { duration } = await measurePerformance(async () => {
        return await menuService.getMenuTree();
      });

      recordPerformance('MenuService', 'getMenuTree', duration, 100);
      expect(duration).toBeLessThan(200); // 宽松的限制
    });

    it('should get user menu tree quickly', async () => {
      const { duration } = await measurePerformance(async () => {
        return await menuService.getUserMenuTree('perf-test-user');
      });

      recordPerformance('MenuService', 'getUserMenuTree', duration, 150);
      expect(duration).toBeLessThan(300); // 宽松的限制
    });

    it('should get menu by id quickly', async () => {
      const menus = await menuService.getAllMenus();
      const testMenuId = menus[0]?.id;

      if (testMenuId) {
        const { duration } = await measurePerformance(async () => {
          return await menuService.getMenuById(testMenuId);
        });

        recordPerformance('MenuService', 'getMenuById', duration, 50);
        expect(duration).toBeLessThan(100); // 宽松的限制
      }
    });
  });

  describe('UserService Performance', () => {
    it('should query users quickly', async () => {
      const { duration } = await measurePerformance(async () => {
        return await userService.queryUsers({ page: 1, pageSize: 10 });
      });

      recordPerformance('UserService', 'queryUsers', duration, 100);
      expect(duration).toBeLessThan(200); // 宽松的限制
    });

    it('should get user by id quickly', async () => {
      const users = await userService.queryUsers({ page: 1, pageSize: 1 });
      const testUserId = users.list[0]?.id;

      if (testUserId) {
        const { duration } = await measurePerformance(async () => {
          return await userService.getUserById(testUserId);
        });

        recordPerformance('UserService', 'getUserById', duration, 50);
        expect(duration).toBeLessThan(100); // 宽松的限制
      }
    });

    it('should create user with acceptable performance', async () => {
      const { duration } = await measurePerformance(async () => {
        return await userService.createUser({
          username: `perfuser_new_${Date.now()}`,
          password: 'TestPass123',
          email: 'newuser@test.com',
        });
      });

      recordPerformance('UserService', 'createUser', duration, 200);
      expect(duration).toBeLessThan(500); // 宽松的限制（包含密码哈希）
    });
  });

  describe('Batch Operations Performance', () => {
    it('should handle batch permission checks efficiently', async () => {
      const permissions = ['user:view', 'user:create', 'user:update', 'user:delete'];
      
      const { duration } = await measurePerformance(async () => {
        const results = await Promise.all(
          permissions.map(perm => permissionService.hasPermission('perf-test-user', perm))
        );
        return results;
      });

      recordPerformance('PermissionService', 'batchPermissionCheck', duration, 50);
      expect(duration).toBeLessThan(200); // 宽松的限制
    });

    it('should handle batch user queries efficiently', async () => {
      const { duration } = await measurePerformance(async () => {
        const results = await Promise.all([
          userService.queryUsers({ page: 1, pageSize: 5 }),
          userService.queryUsers({ page: 2, pageSize: 5 }),
        ]);
        return results;
      });

      recordPerformance('UserService', 'batchQuery', duration, 200);
      expect(duration).toBeLessThan(400); // 宽松的限制
    });
  });
});
