/**
 * 用户管理测试
 * Feature: modular-admin-framework
 * Property 3: User Query Consistency
 * Property 4: Username Uniqueness Enforcement
 * Property 5: User Status Transition Validity
 * Property 6: Batch Operation Atomicity
 * Validates: Requirements 3.1, 3.2, 3.3, 3.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { UserService } from '../../src/admin/modules/user/userService';

describe('UserService Unit Tests', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService();
    service.clearAll();
  });

  // Property 4: Username Uniqueness Enforcement
  it('should validate password strength', () => {
    expect(service.validatePassword('Abc1').valid).toBe(false);
    expect(service.validatePassword('abcdefgh1').valid).toBe(false);
    expect(service.validatePassword('ABCDEFGH1').valid).toBe(false);
    expect(service.validatePassword('Abcdefgh').valid).toBe(false);
    expect(service.validatePassword('Abcdefgh1').valid).toBe(true);
  });

  // Property 4: Username Uniqueness Enforcement
  it('should reject duplicate username', async () => {
    await service.createUser({
      username: 'testuser',
      password: 'TestPass123',
    });

    await expect(service.createUser({
      username: 'testuser',
      password: 'TestPass456',
    })).rejects.toThrow(/已存在/);
  });

  it('should create and retrieve user', async () => {
    const user = await service.createUser({
      username: 'testuser',
      password: 'TestPass123',
      email: 'test@example.com',
    });

    expect(user.username).toBe('testuser');
    expect(user.email).toBe('test@example.com');
    expect((user as any).passwordHash).toBeUndefined();

    const retrieved = await service.getUserById(user.id);
    expect(retrieved?.username).toBe('testuser');
  });

  // Property 5: User Status Transition Validity
  it('should update user status', async () => {
    const user = await service.createUser({
      username: 'testuser',
      password: 'TestPass123',
    });

    const updated = await service.updateStatus(user.id, 'suspended');
    expect(updated.status).toBe('suspended');

    const retrieved = await service.getUserById(user.id);
    expect(retrieved?.status).toBe('suspended');
  });

  it('should update user', async () => {
    const user = await service.createUser({
      username: 'testuser',
      password: 'TestPass123',
    });

    const updated = await service.updateUser(user.id, {
      fullName: 'Test User',
      department: 'Engineering',
    });

    expect(updated.fullName).toBe('Test User');
    expect(updated.department).toBe('Engineering');
  });

  it('should delete user', async () => {
    const user = await service.createUser({
      username: 'testuser',
      password: 'TestPass123',
    });

    await service.deleteUser(user.id);

    const retrieved = await service.getUserById(user.id);
    expect(retrieved).toBeNull();
  });

  // Property 3: User Query Consistency
  it('should query users with filters', async () => {
    await service.createUser({ username: 'user1', password: 'TestPass123', status: 'active' });
    await service.createUser({ username: 'user2', password: 'TestPass123', status: 'inactive' });
    await service.createUser({ username: 'user3', password: 'TestPass123', status: 'active' });

    const activeUsers = await service.queryUsers({ status: 'active', page: 1, pageSize: 10 });
    expect(activeUsers.list.length).toBe(2);
    expect(activeUsers.list.every(u => u.status === 'active')).toBe(true);

    const inactiveUsers = await service.queryUsers({ status: 'inactive', page: 1, pageSize: 10 });
    expect(inactiveUsers.list.length).toBe(1);
  });

  it('should query users with keyword search', async () => {
    await service.createUser({ username: 'alice', password: 'TestPass123', email: 'alice@test.com' });
    await service.createUser({ username: 'bob', password: 'TestPass123', email: 'bob@test.com' });

    const result = await service.queryUsers({ keyword: 'alice', page: 1, pageSize: 10 });
    expect(result.list.length).toBe(1);
    expect(result.list[0].username).toBe('alice');
  });

  it('should paginate results', async () => {
    await service.createUser({ username: 'user1', password: 'TestPass123' });
    await service.createUser({ username: 'user2', password: 'TestPass123' });
    await service.createUser({ username: 'user3', password: 'TestPass123' });

    const page1 = await service.queryUsers({ page: 1, pageSize: 2 });
    expect(page1.list.length).toBe(2);
    expect(page1.total).toBe(3);

    const page2 = await service.queryUsers({ page: 2, pageSize: 2 });
    expect(page2.list.length).toBe(1);
  });

  // Property 6: Batch Operation Atomicity
  it('should batch update status', async () => {
    const user1 = await service.createUser({ username: 'user1', password: 'TestPass123' });
    const user2 = await service.createUser({ username: 'user2', password: 'TestPass123' });
    const user3 = await service.createUser({ username: 'user3', password: 'TestPass123' });

    const count = await service.batchUpdateStatus([user1.id, user2.id], 'suspended');
    expect(count).toBe(2);

    expect((await service.getUserById(user1.id))?.status).toBe('suspended');
    expect((await service.getUserById(user2.id))?.status).toBe('suspended');
    expect((await service.getUserById(user3.id))?.status).toBe('active');
  });

  it('should batch delete users', async () => {
    const user1 = await service.createUser({ username: 'user1', password: 'TestPass123' });
    const user2 = await service.createUser({ username: 'user2', password: 'TestPass123' });
    const user3 = await service.createUser({ username: 'user3', password: 'TestPass123' });

    const count = await service.batchDelete([user1.id, user2.id]);
    expect(count).toBe(2);

    expect(await service.getUserById(user1.id)).toBeNull();
    expect(await service.getUserById(user2.id)).toBeNull();
    expect(await service.getUserById(user3.id)).not.toBeNull();
  });

  it('should reset password', async () => {
    const user = await service.createUser({
      username: 'testuser',
      password: 'TestPass123',
    });

    const newPassword = await service.resetPassword(user.id);
    expect(newPassword.length).toBeGreaterThanOrEqual(8);
  });
});
