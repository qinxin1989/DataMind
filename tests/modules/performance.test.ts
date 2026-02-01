/**
 * 模块性能测试
 * 测试模块加载速度和性能指标
 */

import { describe, it, expect } from 'vitest';
import { performance } from 'perf_hooks';

describe('模块性能测试', () => {
  describe('模块加载性能', () => {
    it('example模块应该在100ms内加载', async () => {
      const start = performance.now();
      await import('../../modules/example/backend/service');
      const end = performance.now();
      const loadTime = end - start;
      
      expect(loadTime).toBeLessThan(100);
      console.log(`example模块加载时间: ${loadTime.toFixed(2)}ms`);
    });

    it('user-management模块应该在600ms内加载', async () => {
      const start = performance.now();
      await import('../../modules/user-management/backend/service');
      const end = performance.now();
      const loadTime = end - start;
      
      expect(loadTime).toBeLessThan(600);
      console.log(`user-management模块加载时间: ${loadTime.toFixed(2)}ms`);
    });

    it('role-management模块应该在100ms内加载', async () => {
      const start = performance.now();
      await import('../../modules/role-management/backend/service');
      const end = performance.now();
      const loadTime = end - start;
      
      expect(loadTime).toBeLessThan(100);
      console.log(`role-management模块加载时间: ${loadTime.toFixed(2)}ms`);
    });

    it('menu-management模块应该在100ms内加载', async () => {
      const start = performance.now();
      await import('../../modules/menu-management/backend/service');
      const end = performance.now();
      const loadTime = end - start;
      
      expect(loadTime).toBeLessThan(100);
      console.log(`menu-management模块加载时间: ${loadTime.toFixed(2)}ms`);
    });

    it('所有核心模块应该在500ms内全部加载', async () => {
      const start = performance.now();
      
      await Promise.all([
        import('../../modules/example/backend/service'),
        import('../../modules/user-management/backend/service'),
        import('../../modules/role-management/backend/service'),
        import('../../modules/menu-management/backend/service'),
      ]);
      
      const end = performance.now();
      const totalLoadTime = end - start;
      
      expect(totalLoadTime).toBeLessThan(500);
      console.log(`所有核心模块总加载时间: ${totalLoadTime.toFixed(2)}ms`);
    });
  });

  describe('服务操作性能', () => {
    it('用户查询操作应该在100ms内完成', async () => {
      const { userService } = await import('../../modules/user-management/backend/service');
      
      const start = performance.now();
      await userService.queryUsers({ page: 1, pageSize: 10 });
      const end = performance.now();
      const queryTime = end - start;
      
      expect(queryTime).toBeLessThan(100);
      console.log(`用户查询时间: ${queryTime.toFixed(2)}ms`);
    });

    it('角色查询操作应该在100ms内完成', async () => {
      const { roleService } = await import('../../modules/role-management/backend/service');
      
      const start = performance.now();
      await roleService.queryRoles({ page: 1, pageSize: 10 });
      const end = performance.now();
      const queryTime = end - start;
      
      expect(queryTime).toBeLessThan(100);
      console.log(`角色查询时间: ${queryTime.toFixed(2)}ms`);
    });

    it('菜单树构建应该在100ms内完成', async () => {
      const { menuService } = await import('../../modules/menu-management/backend/service');
      
      const start = performance.now();
      await menuService.getMenuTree();
      const end = performance.now();
      const buildTime = end - start;
      
      expect(buildTime).toBeLessThan(100);
      console.log(`菜单树构建时间: ${buildTime.toFixed(2)}ms`);
    });
  });

  describe('批量操作性能', () => {
    it('批量创建10个用户应该在500ms内完成', async () => {
      const { userService } = await import('../../modules/user-management/backend/service');
      const testUserIds: string[] = [];
      
      try {
        const start = performance.now();
        
        const createPromises = Array.from({ length: 10 }, (_, i) => 
          userService.createUser({
            username: `perf-test-user-${i}-${Date.now()}`,
            password: 'Test123456',
            email: `perf-test-${i}@test.com`,
          })
        );
        
        const users = await Promise.all(createPromises);
        testUserIds.push(...users.map(u => u.id));
        
        const end = performance.now();
        const batchTime = end - start;
        
        expect(batchTime).toBeLessThan(500);
        console.log(`批量创建10个用户时间: ${batchTime.toFixed(2)}ms`);
      } finally {
        // 清理测试数据
        for (const id of testUserIds) {
          try {
            await userService.deleteUser(id);
          } catch (e) {
            // 忽略删除错误
          }
        }
      }
    });

    it('批量查询100次应该在5000ms内完成', async () => {
      const { userService } = await import('../../modules/user-management/backend/service');
      
      const start = performance.now();
      
      const queryPromises = Array.from({ length: 100 }, () => 
        userService.queryUsers({ page: 1, pageSize: 10 })
      );
      
      await Promise.all(queryPromises);
      
      const end = performance.now();
      const batchQueryTime = end - start;
      
      expect(batchQueryTime).toBeLessThan(5000);
      console.log(`批量查询100次时间: ${batchQueryTime.toFixed(2)}ms`);
      console.log(`平均每次查询: ${(batchQueryTime / 100).toFixed(2)}ms`);
    });
  });

  describe('内存使用', () => {
    it('模块加载不应该导致内存泄漏', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // 加载所有模块多次
      for (let i = 0; i < 10; i++) {
        await import(`../../modules/example/backend/service?t=${i}`);
        await import(`../../modules/user-management/backend/service?t=${i}`);
        await import(`../../modules/role-management/backend/service?t=${i}`);
        await import(`../../modules/menu-management/backend/service?t=${i}`);
      }
      
      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;
      
      // 内存增长不应超过50MB
      expect(memoryIncreaseMB).toBeLessThan(50);
      console.log(`内存增长: ${memoryIncreaseMB.toFixed(2)}MB`);
    });
  });
});
