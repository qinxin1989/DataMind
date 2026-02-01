/**
 * 权限系统属性测试
 * Feature: modular-admin-framework
 * Property 7: Permission Inheritance Completeness
 * Property 8: Permission Verification Correctness
 * Validates: Requirements 4.2, 4.3, 4.6
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { PermissionService } from '../../src/admin/services/permissionService';
import type { Role } from '../../src/admin/types';

// ==================== 生成器定义 ====================

const roleCodeArb = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => /^[a-z][a-z0-9_]*$/.test(s));

const permissionCodeArb = fc.string({ minLength: 1, maxLength: 30 })
  .filter(s => /^[a-z][a-z0-9:_]*$/.test(s));

const userIdArb = fc.uuid();

// 生成唯一权限列表
const uniquePermissionsArb = fc.uniqueArray(permissionCodeArb, { minLength: 1, maxLength: 10 });

// 生成角色（无父角色）
const roleArb = (id: string, code: string): fc.Arbitrary<Role> => fc.record({
  id: fc.constant(id),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  code: fc.constant(code),
  description: fc.string({ minLength: 0, maxLength: 100 }),
  permissionCodes: uniquePermissionsArb,
  parentId: fc.constant(undefined),
  status: fc.constant('active' as const),
  isSystem: fc.boolean(),
  createdAt: fc.constant(Date.now()),
  updatedAt: fc.constant(Date.now()),
});

// ==================== 属性测试 ====================

describe('PermissionService Property Tests', () => {
  let service: PermissionService;

  beforeEach(() => {
    service = new PermissionService();
    service.clearAll();
  });

  /**
   * Property 7: Permission Inheritance Completeness
   * For any role with a parent role, the effective permissions should include
   * all permissions from the parent role plus the role's own permissions
   */
  it('should inherit all permissions from parent role', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniquePermissionsArb,
        uniquePermissionsArb,
        async (parentPerms, childPerms) => {
          const service = new PermissionService();
          service.clearAll();

          // 创建父角色
          const parentRole: Role = {
            id: 'parent-role',
            name: 'Parent Role',
            code: 'parent',
            description: 'Parent role',
            permissionCodes: parentPerms,
            status: 'active',
            isSystem: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          service.setRoleForTest(parentRole);

          // 创建子角色（继承父角色）
          const childRole: Role = {
            id: 'child-role',
            name: 'Child Role',
            code: 'child',
            description: 'Child role',
            permissionCodes: childPerms,
            parentId: 'parent-role',
            status: 'active',
            isSystem: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          service.setRoleForTest(childRole);

          // 获取子角色的所有权限
          const effectivePerms = await service.getRolePermissions('child-role');

          // 验证包含所有父角色权限
          for (const perm of parentPerms) {
            expect(effectivePerms).toContain(perm);
          }

          // 验证包含所有子角色自身权限
          for (const perm of childPerms) {
            expect(effectivePerms).toContain(perm);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8: Permission Verification Correctness
   * For any user attempting to access a protected resource, access should be granted
   * if and only if the user has the required permission
   */
  it('should grant access only when user has required permission', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        uniquePermissionsArb,
        permissionCodeArb,
        async (userId, rolePerms, checkPerm) => {
          const service = new PermissionService();
          service.clearAll();

          // 创建角色
          const role: Role = {
            id: 'test-role',
            name: 'Test Role',
            code: 'test',
            description: 'Test role',
            permissionCodes: rolePerms,
            status: 'active',
            isSystem: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          service.setRoleForTest(role);

          // 分配角色给用户
          service.setUserRolesForTest(userId, ['test-role']);

          // 检查权限
          const hasPermission = await service.hasPermission(userId, checkPerm);
          const shouldHavePermission = rolePerms.includes(checkPerm);

          // 验证：有权限当且仅当角色包含该权限
          expect(hasPermission).toBe(shouldHavePermission);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Super admin (*) should have all permissions
   */
  it('should grant all permissions to super admin', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        permissionCodeArb,
        async (userId, anyPerm) => {
          const service = new PermissionService();
          service.clearAll();

          // 创建超级管理员角色
          const superAdminRole: Role = {
            id: 'super-admin',
            name: 'Super Admin',
            code: 'super_admin',
            description: 'Super admin',
            permissionCodes: ['*'],
            status: 'active',
            isSystem: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          service.setRoleForTest(superAdminRole);
          service.setUserRolesForTest(userId, ['super-admin']);

          // 超级管理员应该有任何权限
          const hasPermission = await service.hasPermission(userId, anyPerm);
          expect(hasPermission).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * hasAnyPermission should return true if user has at least one permission
   */
  it('should return true for hasAnyPermission when user has at least one', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        uniquePermissionsArb,
        uniquePermissionsArb,
        async (userId, rolePerms, checkPerms) => {
          const service = new PermissionService();
          service.clearAll();

          const role: Role = {
            id: 'test-role',
            name: 'Test Role',
            code: 'test',
            description: 'Test role',
            permissionCodes: rolePerms,
            status: 'active',
            isSystem: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          service.setRoleForTest(role);
          service.setUserRolesForTest(userId, ['test-role']);

          const hasAny = await service.hasAnyPermission(userId, checkPerms);
          const shouldHaveAny = checkPerms.some(p => rolePerms.includes(p));

          expect(hasAny).toBe(shouldHaveAny);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * hasAllPermissions should return true only if user has all permissions
   */
  it('should return true for hasAllPermissions only when user has all', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        uniquePermissionsArb,
        uniquePermissionsArb,
        async (userId, rolePerms, checkPerms) => {
          const service = new PermissionService();
          service.clearAll();

          const role: Role = {
            id: 'test-role',
            name: 'Test Role',
            code: 'test',
            description: 'Test role',
            permissionCodes: rolePerms,
            status: 'active',
            isSystem: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          service.setRoleForTest(role);
          service.setUserRolesForTest(userId, ['test-role']);

          const hasAll = await service.hasAllPermissions(userId, checkPerms);
          const shouldHaveAll = checkPerms.every(p => rolePerms.includes(p));

          expect(hasAll).toBe(shouldHaveAll);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * User with no roles should have no permissions
   */
  it('should have no permissions when user has no roles', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        permissionCodeArb,
        async (userId, anyPerm) => {
          const service = new PermissionService();
          service.clearAll();

          // 用户没有分配任何角色
          const hasPermission = await service.hasPermission(userId, anyPerm);
          expect(hasPermission).toBe(false);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('PermissionService Unit Tests', () => {
  let service: PermissionService;

  beforeEach(async () => {
    service = new PermissionService();
    await service.clearAll();
  });

  it('should handle multi-level inheritance', async () => {
    // 创建三级角色继承
    const grandparentRole: Role = {
      id: 'grandparent',
      name: 'Grandparent',
      code: 'grandparent',
      description: '',
      permissionCodes: ['perm:a'],
      status: 'active',
      isSystem: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const parentRole: Role = {
      id: 'parent',
      name: 'Parent',
      code: 'parent',
      description: '',
      permissionCodes: ['perm:b'],
      parentId: 'grandparent',
      status: 'active',
      isSystem: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const childRole: Role = {
      id: 'child',
      name: 'Child',
      code: 'child',
      description: '',
      permissionCodes: ['perm:c'],
      parentId: 'parent',
      status: 'active',
      isSystem: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    service.setRoleForTest(grandparentRole);
    service.setRoleForTest(parentRole);
    service.setRoleForTest(childRole);

    const perms = await service.getRolePermissions('child');

    expect(perms).toContain('perm:a');
    expect(perms).toContain('perm:b');
    expect(perms).toContain('perm:c');
  });

  it('should handle circular inheritance gracefully', async () => {
    // 创建循环继承（不应该发生，但要处理）
    const roleA: Role = {
      id: 'role-a',
      name: 'Role A',
      code: 'role_a',
      description: '',
      permissionCodes: ['perm:a'],
      parentId: 'role-b',
      status: 'active',
      isSystem: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const roleB: Role = {
      id: 'role-b',
      name: 'Role B',
      code: 'role_b',
      description: '',
      permissionCodes: ['perm:b'],
      parentId: 'role-a',
      status: 'active',
      isSystem: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    service.setRoleForTest(roleA);
    service.setRoleForTest(roleB);

    // 应该检测到循环继承并抛出错误
    await expect(service.getRolePermissions('role-a')).rejects.toThrow('检测到角色循环继承');
  });

  it('should combine permissions from multiple roles', async () => {
    const role1: Role = {
      id: 'role-1',
      name: 'Role 1',
      code: 'role_1',
      description: '',
      permissionCodes: ['perm:a', 'perm:b'],
      status: 'active',
      isSystem: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const role2: Role = {
      id: 'role-2',
      name: 'Role 2',
      code: 'role_2',
      description: '',
      permissionCodes: ['perm:c', 'perm:d'],
      status: 'active',
      isSystem: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    service.setRoleForTest(role1);
    service.setRoleForTest(role2);
    service.setUserRolesForTest('user-1', ['role-1', 'role-2']);

    const perms = await service.getUserPermissions('user-1');

    expect(perms).toContain('perm:a');
    expect(perms).toContain('perm:b');
    expect(perms).toContain('perm:c');
    expect(perms).toContain('perm:d');
  });
});
