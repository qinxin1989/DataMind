/**
 * 核心服务安全测试
 * 测试权限隔离、数据安全、越权访问等安全问题
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { permissionService } from '../../src/admin/services/permissionService';
import { menuService } from '../../src/admin/modules/menu/menuService';
import { userService } from '../../src/admin/modules/user/userService';
import type { Role } from '../../src/admin/types';

describe('安全测试 - 权限隔离', () => {
  beforeEach(async () => {
    await permissionService.clearAll();
    await menuService.clearAll();
    await userService.clearAll();
  });

  describe('权限服务安全', () => {
    it('应该防止循环继承攻击', async () => {
      // 创建角色A
      const roleA: Role = {
        id: 'role-a-id',
        name: '角色A',
        code: 'role_a',
        permissionCodes: ['perm1'],
        menuIds: [],
        status: 'active',
        isSystem: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // 创建角色B，继承A
      const roleB: Role = {
        id: 'role-b-id',
        name: '角色B',
        code: 'role_b',
        parentId: roleA.id,
        permissionCodes: ['perm2'],
        menuIds: [],
        status: 'active',
        isSystem: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // 设置测试数据
      permissionService.setRoleForTest(roleA);
      permissionService.setRoleForTest(roleB);

      // 让A继承B，形成循环
      roleA.parentId = roleB.id;
      permissionService.setRoleForTest(roleA);

      // 尝试获取权限应该抛出错误
      await expect(
        permissionService.getRolePermissions(roleA.id)
      ).rejects.toThrow('检测到角色循环继承');
    });

    it('应该正确隔离不同角色的权限', async () => {
      // 创建两个独立的角色
      const role1 = await permissionService.createRole({
        name: '角色1',
        code: 'role_1',
        permissionCodes: ['perm1', 'perm2'],
      });

      const role2 = await permissionService.createRole({
        name: '角色2',
        code: 'role_2',
        permissionCodes: ['perm3', 'perm4'],
      });

      // 获取角色1的权限
      const perms1 = await permissionService.getRolePermissions(role1.id);
      expect(perms1).toEqual(['perm1', 'perm2']);
      expect(perms1).not.toContain('perm3');
      expect(perms1).not.toContain('perm4');

      // 获取角色2的权限
      const perms2 = await permissionService.getRolePermissions(role2.id);
      expect(perms2).toEqual(['perm3', 'perm4']);
      expect(perms2).not.toContain('perm1');
      expect(perms2).not.toContain('perm2');
    });

    it('应该防止未授权用户访问其他用户的权限', async () => {
      // 创建角色
      const role = await permissionService.createRole({
        name: '测试角色',
        code: 'test_role',
        permissionCodes: ['test:read'],
      });

      // 创建用户1并分配角色
      const user1 = await userService.createUser({
        username: 'user1',
        password: 'Password123',
        email: 'user1@test.com',
      });
      await permissionService.assignRolesToUser(user1.id, [role.id]);

      // 创建用户2，不分配角色
      const user2 = await userService.createUser({
        username: 'user2',
        password: 'Password123',
        email: 'user2@test.com',
      });

      // 用户1应该有权限
      const hasPermUser1 = await permissionService.hasPermission(user1.id, 'test:read');
      expect(hasPermUser1).toBe(true);

      // 用户2不应该有权限
      const hasPermUser2 = await permissionService.hasPermission(user2.id, 'test:read');
      expect(hasPermUser2).toBe(false);
    });
  });

  describe('菜单服务安全', () => {
    it('应该防止菜单层级过深攻击', async () => {
      // 创建第1层菜单
      const menu1 = await menuService.createMenu({
        title: '菜单1',
        path: '/menu1',
        order: 1,
      });

      // 创建第2层菜单
      const menu2 = await menuService.createMenu({
        title: '菜单2',
        path: '/menu2',
        parentId: menu1.id,
        order: 1,
      });

      // 创建第3层菜单
      const menu3 = await menuService.createMenu({
        title: '菜单3',
        path: '/menu3',
        parentId: menu2.id,
        order: 1,
      });

      // 尝试创建第4层菜单应该失败
      await expect(
        menuService.createMenu({
          title: '菜单4',
          path: '/menu4',
          parentId: menu3.id,
          order: 1,
        })
      ).rejects.toThrow('菜单层级不能超过3层');
    });

    it('应该防止删除有子菜单的菜单', async () => {
      // 创建父菜单
      const parent = await menuService.createMenu({
        title: '父菜单',
        path: '/parent',
        order: 1,
      });

      // 创建子菜单
      await menuService.createMenu({
        title: '子菜单',
        path: '/child',
        parentId: parent.id,
        order: 1,
      });

      // 尝试删除父菜单应该失败
      await expect(
        menuService.deleteMenu(parent.id)
      ).rejects.toThrow('不能删除有子菜单的菜单');
    });

    it('应该防止删除系统菜单', async () => {
      // 创建系统菜单（直接插入数据库）
      const menu = await menuService.createMenu({
        title: '系统菜单',
        path: '/system',
        order: 1,
      });

      // 手动标记为系统菜单
      const { pool } = await import('../../src/admin/core/database');
      await pool.execute('UPDATE sys_menus SET is_system = TRUE WHERE id = ?', [menu.id]);

      // 尝试删除系统菜单应该失败
      await expect(
        menuService.deleteMenu(menu.id)
      ).rejects.toThrow('系统菜单不能删除');
    });
  });
});

describe('安全测试 - 数据安全', () => {
  beforeEach(async () => {
    await userService.clearAll();
  });

  describe('密码安全', () => {
    it('应该拒绝弱密码', async () => {
      const weakPasswords = [
        'short',           // 太短
        'alllowercase',    // 只有小写
        'ALLUPPERCASE',    // 只有大写
        'NoNumbers',       // 没有数字
        'nonumber123',     // 没有大写
        'NONUMBER123',     // 没有小写
      ];

      for (const password of weakPasswords) {
        await expect(
          userService.createUser({
            username: `user_${password}`,
            password,
            email: `${password}@test.com`,
          })
        ).rejects.toThrow(/密码强度不足|密码必须包含/);
      }
    });

    it('应该接受强密码', async () => {
      const strongPasswords = [
        'Password123',
        'MyP@ssw0rd',
        'Secure123Pass',
        'Test1234Pass',
      ];

      for (const password of strongPasswords) {
        const user = await userService.createUser({
          username: `user_${password}`,
          password,
          email: `${password}@test.com`,
        });
        expect(user.id).toBeDefined();
      }
    });

    it('应该使用bcrypt哈希存储密码', async () => {
      const user = await userService.createUser({
        username: 'testuser',
        password: 'Password123',
        email: 'test@test.com',
      });

      // 从数据库获取密码哈希
      const { pool } = await import('../../src/admin/core/database');
      const [rows] = await pool.execute(
        'SELECT password_hash FROM sys_users WHERE id = ?',
        [user.id]
      );
      const passwordHash = (rows as any)[0].password_hash;

      // 验证是bcrypt哈希（以$2b$开头）
      expect(passwordHash).toMatch(/^\$2[aby]\$/);
      
      // 验证不是明文密码
      expect(passwordHash).not.toBe('Password123');
      
      // 验证密码验证功能正常
      const isValid = await userService.verifyPassword('Password123', passwordHash);
      expect(isValid).toBe(true);
      
      const isInvalid = await userService.verifyPassword('WrongPassword', passwordHash);
      expect(isInvalid).toBe(false);
    });

    it('应该验证密码强度规则', () => {
      // 测试密码验证函数
      const testCases = [
        { password: 'short', valid: false, errors: ['密码长度至少 8 位', '密码必须包含至少一个大写字母', '密码必须包含至少一个数字'] },
        { password: 'alllowercase', valid: false, errors: ['密码必须包含至少一个大写字母', '密码必须包含至少一个数字'] },
        { password: 'ALLUPPERCASE', valid: false, errors: ['密码必须包含至少一个小写字母', '密码必须包含至少一个数字'] },
        { password: 'NoNumbers', valid: false, errors: ['密码必须包含至少一个数字'] },
        { password: 'Password123', valid: true, errors: [] },
      ];

      for (const testCase of testCases) {
        const result = userService.validatePassword(testCase.password);
        expect(result.valid).toBe(testCase.valid);
        expect(result.errors).toEqual(testCase.errors);
      }
    });
  });

  describe('数据访问控制', () => {
    it('应该防止SQL注入攻击', async () => {
      // 尝试通过用户名进行SQL注入
      const maliciousUsername = "admin' OR '1'='1";
      
      const user = await userService.createUser({
        username: maliciousUsername,
        password: 'Password123',
        email: 'test@test.com',
      });

      // 查询应该只返回这个用户，而不是所有用户
      const foundUser = await userService.getUserByUsername(maliciousUsername);
      expect(foundUser).toBeDefined();
      expect(foundUser.username).toBe(maliciousUsername);

      // 验证没有返回其他用户
      const allUsers = await userService.queryUsers({ page: 1, pageSize: 100 });
      expect(allUsers.list.length).toBe(1);
    });

    it('应该防止通过ID注入访问其他用户数据', async () => {
      // 创建两个用户
      const user1 = await userService.createUser({
        username: 'user1',
        password: 'Password123',
        email: 'user1@test.com',
      });

      const user2 = await userService.createUser({
        username: 'user2',
        password: 'Password123',
        email: 'user2@test.com',
      });

      // 尝试使用恶意ID访问
      const maliciousId = `${user1.id}' OR '1'='1`;
      const result = await userService.getUserById(maliciousId);
      
      // 应该返回null，而不是返回所有用户
      expect(result).toBeNull();
    });

    it('应该正确处理特殊字符', async () => {
      const specialChars = [
        "user'name",
        'user"name',
        'user<name>',
        'user&name',
        'user;name',
      ];

      for (const username of specialChars) {
        const user = await userService.createUser({
          username,
          password: 'Password123',
          email: `${username}@test.com`,
        });

        const foundUser = await userService.getUserByUsername(username);
        expect(foundUser).toBeDefined();
        expect(foundUser.username).toBe(username);
      }
    });
  });

  describe('敏感数据保护', () => {
    it('不应该在API响应中返回密码哈希', async () => {
      const user = await userService.createUser({
        username: 'testuser',
        password: 'Password123',
        email: 'test@test.com',
      });

      // 验证返回的用户对象不包含密码相关字段
      expect(user).not.toHaveProperty('password');
      expect(user).not.toHaveProperty('passwordHash');
      expect(user).not.toHaveProperty('password_hash');
    });

    it('应该在查询用户列表时不返回密码', async () => {
      await userService.createUser({
        username: 'user1',
        password: 'Password123',
        email: 'user1@test.com',
      });

      const result = await userService.queryUsers({ page: 1, pageSize: 10 });
      
      for (const user of result.list) {
        expect(user).not.toHaveProperty('password');
        expect(user).not.toHaveProperty('passwordHash');
        expect(user).not.toHaveProperty('password_hash');
      }
    });
  });
});

describe('安全测试 - 越权访问', () => {
  beforeEach(async () => {
    await permissionService.clearAll();
    await userService.clearAll();
  });

  describe('角色权限验证', () => {
    it('应该防止普通用户访问管理员功能', async () => {
      // 创建普通用户角色
      const userRole = await permissionService.createRole({
        name: '普通用户',
        code: 'normal_user',
        permissionCodes: ['read:data'],
      });

      // 创建用户并分配普通角色
      const user = await userService.createUser({
        username: 'normaluser',
        password: 'Password123',
        email: 'user@test.com',
      });
      await permissionService.assignRolesToUser(user.id, [userRole.id]);

      // 验证用户没有管理员权限
      const hasAdminPerm = await permissionService.hasPermission(user.id, 'admin:manage');
      expect(hasAdminPerm).toBe(false);

      const hasDeletePerm = await permissionService.hasPermission(user.id, 'delete:data');
      expect(hasDeletePerm).toBe(false);

      // 验证用户只有读取权限
      const hasReadPerm = await permissionService.hasPermission(user.id, 'read:data');
      expect(hasReadPerm).toBe(true);
    });

    it('应该正确验证管理员权限', async () => {
      // 创建管理员角色
      const adminRole = await permissionService.createRole({
        name: '管理员',
        code: 'super_admin_role',
        permissionCodes: ['*'], // 所有权限
      });

      // 创建管理员用户
      const admin = await userService.createUser({
        username: 'admin',
        password: 'Password123',
        email: 'admin@test.com',
      });
      await permissionService.assignRolesToUser(admin.id, [adminRole.id]);

      // 验证管理员拥有所有权限
      const hasAnyPerm = await permissionService.hasPermission(admin.id, 'any:permission');
      expect(hasAnyPerm).toBe(true);

      const hasAdminPerm = await permissionService.hasPermission(admin.id, 'admin:manage');
      expect(hasAdminPerm).toBe(true);
    });

    it('应该防止删除系统角色', async () => {
      // 创建系统角色
      const role = await permissionService.createRole({
        name: '系统角色',
        code: 'system_role_test',
        permissionCodes: ['system:access'],
      });

      // 手动标记为系统角色
      const { pool } = await import('../../src/admin/core/database');
      await pool.execute('UPDATE sys_roles SET is_system = TRUE WHERE id = ?', [role.id]);

      // 尝试删除系统角色应该失败
      await expect(
        permissionService.deleteRole(role.id)
      ).rejects.toThrow('系统角色不能删除');
    });
  });

  describe('用户状态验证', () => {
    it('应该防止禁用用户访问系统', async () => {
      // 创建用户
      const user = await userService.createUser({
        username: 'testuser',
        password: 'Password123',
        email: 'test@test.com',
        status: 'active',
      });

      // 禁用用户
      await userService.updateStatus(user.id, 'inactive');

      // 验证用户状态
      const updatedUser = await userService.getUserById(user.id);
      expect(updatedUser?.status).toBe('inactive');
    });

    it('应该支持批量更新用户状态', async () => {
      // 创建多个用户
      const user1 = await userService.createUser({
        username: 'user1',
        password: 'Password123',
        email: 'user1@test.com',
      });

      const user2 = await userService.createUser({
        username: 'user2',
        password: 'Password123',
        email: 'user2@test.com',
      });

      // 批量禁用
      const affected = await userService.batchUpdateStatus([user1.id, user2.id], 'inactive');
      expect(affected).toBe(2);

      // 验证状态
      const updatedUser1 = await userService.getUserById(user1.id);
      const updatedUser2 = await userService.getUserById(user2.id);
      expect(updatedUser1?.status).toBe('inactive');
      expect(updatedUser2?.status).toBe('inactive');
    });
  });
});
