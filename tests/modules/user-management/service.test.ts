/**
 * 用户管理服务测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UserService } from '../../../modules/user-management/backend/service';

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService();
  });

  afterEach(async () => {
    // 清理测试数据
    await userService.clearAll();
  });

  describe('密码验证', () => {
    it('应该验证密码长度', () => {
      const result1 = userService.validatePassword('12345');
      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain('密码长度至少 6 位');

      const result2 = userService.validatePassword('123456');
      expect(result2.valid).toBe(true);
      expect(result2.errors).toHaveLength(0);
    });

    it('应该能够验证密码哈希', async () => {
      const password = 'testPassword123';
      const user = await userService.createUser({
        username: 'testuser',
        password,
        email: 'test@example.com',
      });

      const dbUser = await userService.getUserByUsername('testuser');
      const isValid = await userService.verifyPassword(password, dbUser.password_hash);
      expect(isValid).toBe(true);

      const isInvalid = await userService.verifyPassword('wrongPassword', dbUser.password_hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('用户 CRUD', () => {
    it('应该能够创建用户', async () => {
      const userData = {
        username: 'john',
        password: 'password123',
        email: 'john@example.com',
        fullName: 'John Doe',
        role: 'user' as const,
      };

      const user = await userService.createUser(userData);

      expect(user).toBeDefined();
      expect(user.username).toBe('john');
      expect(user.email).toBe('john@example.com');
      expect(user.fullName).toBe('John Doe');
      expect(user.role).toBe('user');
      expect(user.status).toBe('active');
    });

    it('应该拒绝重复的用户名', async () => {
      await userService.createUser({
        username: 'john',
        password: 'password123',
      });

      await expect(
        userService.createUser({
          username: 'john',
          password: 'password456',
        })
      ).rejects.toThrow('用户名已存在');
    });

    it('应该拒绝弱密码', async () => {
      await expect(
        userService.createUser({
          username: 'john',
          password: '123',
        })
      ).rejects.toThrow('密码强度不足');
    });

    it('应该能够通过 ID 获取用户', async () => {
      const created = await userService.createUser({
        username: 'john',
        password: 'password123',
        email: 'john@example.com',
      });

      const user = await userService.getUserById(created.id);
      expect(user).toBeDefined();
      expect(user?.username).toBe('john');
      expect(user?.email).toBe('john@example.com');
    });

    it('应该能够通过用户名获取用户', async () => {
      await userService.createUser({
        username: 'john',
        password: 'password123',
      });

      const user = await userService.getUserByUsername('john');
      expect(user).toBeDefined();
      expect(user.username).toBe('john');
    });

    it('应该能够更新用户', async () => {
      const user = await userService.createUser({
        username: 'john',
        password: 'password123',
        email: 'john@example.com',
      });

      const updated = await userService.updateUser(user.id, {
        email: 'newemail@example.com',
        fullName: 'John Updated',
      });

      expect(updated.email).toBe('newemail@example.com');
      expect(updated.fullName).toBe('John Updated');
    });

    it('应该能够删除用户', async () => {
      const user = await userService.createUser({
        username: 'john',
        password: 'password123',
      });

      await userService.deleteUser(user.id);

      const deleted = await userService.getUserById(user.id);
      expect(deleted).toBeNull();
    });

    it('删除不存在的用户应该抛出错误', async () => {
      await expect(
        userService.deleteUser('non-existent-id')
      ).rejects.toThrow('用户不存在');
    });
  });

  describe('用户查询', () => {
    beforeEach(async () => {
      // 创建测试数据
      await userService.createUser({
        username: 'john',
        password: 'password123',
        email: 'john@example.com',
        fullName: 'John Doe',
        role: 'user',
        status: 'active',
      });

      await userService.createUser({
        username: 'jane',
        password: 'password123',
        email: 'jane@example.com',
        fullName: 'Jane Smith',
        role: 'admin',
        status: 'active',
      });

      await userService.createUser({
        username: 'bob',
        password: 'password123',
        email: 'bob@example.com',
        fullName: 'Bob Johnson',
        role: 'user',
        status: 'inactive',
      });
    });

    it('应该能够查询所有用户', async () => {
      const result = await userService.queryUsers({
        page: 1,
        pageSize: 10,
      });

      expect(result.list).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('应该能够按关键词搜索', async () => {
      const result = await userService.queryUsers({
        keyword: 'jane',
        page: 1,
        pageSize: 10,
      });

      expect(result.list).toHaveLength(1);
      expect(result.list[0].username).toBe('jane');
    });

    it('应该能够按状态筛选', async () => {
      const result = await userService.queryUsers({
        status: 'active',
        page: 1,
        pageSize: 10,
      });

      expect(result.list).toHaveLength(2);
      expect(result.list.every(u => u.status === 'active')).toBe(true);
    });

    it('应该能够按角色筛选', async () => {
      const result = await userService.queryUsers({
        role: 'admin',
        page: 1,
        pageSize: 10,
      });

      expect(result.list).toHaveLength(1);
      expect(result.list[0].role).toBe('admin');
    });

    it('应该支持分页', async () => {
      const page1 = await userService.queryUsers({
        page: 1,
        pageSize: 2,
      });

      expect(page1.list).toHaveLength(2);
      expect(page1.total).toBe(3);
      expect(page1.page).toBe(1);
      expect(page1.pageSize).toBe(2);

      const page2 = await userService.queryUsers({
        page: 2,
        pageSize: 2,
      });

      expect(page2.list).toHaveLength(1);
      expect(page2.total).toBe(3);
    });
  });

  describe('状态管理', () => {
    it('应该能够更新用户状态', async () => {
      const user = await userService.createUser({
        username: 'john',
        password: 'password123',
        status: 'active',
      });

      const updated = await userService.updateStatus(user.id, 'inactive');
      expect(updated.status).toBe('inactive');
    });

    it('应该能够批量更新状态', async () => {
      const user1 = await userService.createUser({
        username: 'john',
        password: 'password123',
      });

      const user2 = await userService.createUser({
        username: 'jane',
        password: 'password123',
      });

      const count = await userService.batchUpdateStatus(
        [user1.id, user2.id],
        'inactive'
      );

      expect(count).toBe(2);

      const updated1 = await userService.getUserById(user1.id);
      const updated2 = await userService.getUserById(user2.id);

      expect(updated1?.status).toBe('inactive');
      expect(updated2?.status).toBe('inactive');
    });

    it('应该能够批量删除', async () => {
      const user1 = await userService.createUser({
        username: 'john',
        password: 'password123',
      });

      const user2 = await userService.createUser({
        username: 'jane',
        password: 'password123',
      });

      const count = await userService.batchDelete([user1.id, user2.id]);
      expect(count).toBe(2);

      const deleted1 = await userService.getUserById(user1.id);
      const deleted2 = await userService.getUserById(user2.id);

      expect(deleted1).toBeNull();
      expect(deleted2).toBeNull();
    });
  });

  describe('密码管理', () => {
    it('应该能够重置密码', async () => {
      const user = await userService.createUser({
        username: 'john',
        password: 'oldPassword123',
      });

      const newPassword = await userService.resetPassword(user.id);

      expect(newPassword).toBeDefined();
      expect(newPassword.length).toBeGreaterThanOrEqual(10);

      // 验证新密码可以使用
      const dbUser = await userService.getUserByUsername('john');
      const isValid = await userService.verifyPassword(newPassword, dbUser.password_hash);
      expect(isValid).toBe(true);
    });

    it('重置不存在用户的密码应该抛出错误', async () => {
      await expect(
        userService.resetPassword('non-existent-id')
      ).rejects.toThrow('用户不存在');
    });
  });

  describe('登录记录', () => {
    it('应该能够记录登录信息', async () => {
      const user = await userService.createUser({
        username: 'john',
        password: 'password123',
      });

      await userService.recordLogin(user.id, '192.168.1.1');

      const updated = await userService.getUserById(user.id);
      expect(updated?.lastLoginIp).toBe('192.168.1.1');
      expect(updated?.lastLoginAt).toBeDefined();
    });
  });
});
