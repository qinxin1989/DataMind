/**
 * 角色管理服务测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { roleService } from '../../../modules/role-management/backend/service';
import { pool } from '../../../src/admin/core/database';

describe('角色管理服务', () => {
  beforeEach(async () => {
    // 清理测试数据
    await pool.execute('DELETE FROM sys_roles WHERE is_system = FALSE');
    await pool.execute('DELETE FROM sys_role_permissions');
    await pool.execute('DELETE FROM sys_role_menus');
    await pool.execute('DELETE FROM sys_user_roles');
  });

  afterEach(async () => {
    // 清理测试数据
    await pool.execute('DELETE FROM sys_roles WHERE is_system = FALSE');
    await pool.execute('DELETE FROM sys_role_permissions');
    await pool.execute('DELETE FROM sys_role_menus');
    await pool.execute('DELETE FROM sys_user_roles');
  });

  describe('创建角色', () => {
    it('应该成功创建角色', async () => {
      const role = await roleService.createRole({
        name: '测试角色',
        code: 'test_role',
        description: '这是一个测试角色',
        permissionCodes: ['user:view', 'user:create'],
        status: 'active',
      });

      expect(role).toBeDefined();
      expect(role.name).toBe('测试角色');
      expect(role.code).toBe('test_role');
      expect(role.description).toBe('这是一个测试角色');
      expect(role.status).toBe('active');
      expect(role.isSystem).toBe(false);
      expect(role.permissionCodes.sort()).toEqual(['user:create', 'user:view']);
    });

    it('应该拒绝重复的角色编码', async () => {
      await roleService.createRole({
        name: '角色1',
        code: 'duplicate_code',
        description: '第一个角色',
      });

      await expect(
        roleService.createRole({
          name: '角色2',
          code: 'duplicate_code',
          description: '第二个角色',
        })
      ).rejects.toThrow('角色代码已存在');
    });

    it('应该创建带菜单的角色', async () => {
      const role = await roleService.createRole({
        name: '带菜单角色',
        code: 'role_with_menus',
        menuIds: ['menu-1', 'menu-2'],
      });

      expect(role.menuIds).toEqual(['menu-1', 'menu-2']);
    });
  });

  describe('查询角色', () => {
    beforeEach(async () => {
      // 创建测试数据
      await roleService.createRole({
        name: '管理员',
        code: 'query_test_admin',
        description: '系统管理员',
        status: 'active',
      });

      await roleService.createRole({
        name: '编辑员',
        code: 'query_test_editor',
        description: '内容编辑',
        status: 'active',
      });

      await roleService.createRole({
        name: '禁用角色',
        code: 'query_test_disabled',
        description: '已禁用',
        status: 'inactive',
      });
    });

    it('应该获取所有角色', async () => {
      const roles = await roleService.getAllRoles();
      expect(roles.length).toBeGreaterThanOrEqual(3);
    });

    it('应该分页查询角色', async () => {
      const result = await roleService.queryRoles({
        page: 1,
        pageSize: 2,
      });

      expect(result.items.length).toBeLessThanOrEqual(2);
      expect(result.total).toBeGreaterThanOrEqual(3);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
    });

    it('应该按关键词搜索角色', async () => {
      const result = await roleService.queryRoles({
        keyword: '管理',
        page: 1,
        pageSize: 10,
      });

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items.some(r => r.name.includes('管理'))).toBe(true);
    });

    it('应该按状态筛选角色', async () => {
      const result = await roleService.queryRoles({
        status: 'inactive',
        page: 1,
        pageSize: 10,
      });

      expect(result.items.every(r => r.status === 'inactive')).toBe(true);
    });

    it('应该根据ID获取角色', async () => {
      const created = await roleService.createRole({
        name: '测试角色',
        code: 'test_get_by_id',
      });

      const role = await roleService.getRoleById(created.id);
      expect(role).toBeDefined();
      expect(role?.id).toBe(created.id);
      expect(role?.name).toBe('测试角色');
    });

    it('应该根据编码获取角色', async () => {
      await roleService.createRole({
        name: '测试角色',
        code: 'test_get_by_code',
      });

      const role = await roleService.getRoleByCode('test_get_by_code');
      expect(role).toBeDefined();
      expect(role?.code).toBe('test_get_by_code');
    });
  });

  describe('更新角色', () => {
    it('应该成功更新角色', async () => {
      const created = await roleService.createRole({
        name: '原始名称',
        code: 'test_update',
        description: '原始描述',
        status: 'active',
      });

      const updated = await roleService.updateRole(created.id, {
        name: '新名称',
        description: '新描述',
        status: 'inactive',
      });

      expect(updated.name).toBe('新名称');
      expect(updated.description).toBe('新描述');
      expect(updated.status).toBe('inactive');
      expect(updated.code).toBe('test_update'); // 编码不变
    });

    it('应该更新角色权限', async () => {
      const created = await roleService.createRole({
        name: '测试角色',
        code: 'test_update_perms',
        permissionCodes: ['user:view'],
      });

      const updated = await roleService.updateRole(created.id, {
        permissionCodes: ['user:view', 'user:create', 'user:update'],
      });

      expect(updated.permissionCodes.sort()).toEqual(['user:create', 'user:update', 'user:view']);
    });

    it('应该更新角色菜单', async () => {
      const created = await roleService.createRole({
        name: '测试角色',
        code: 'test_update_menus',
        menuIds: ['menu-1'],
      });

      const updated = await roleService.updateRole(created.id, {
        menuIds: ['menu-1', 'menu-2', 'menu-3'],
      });

      expect(updated.menuIds).toEqual(['menu-1', 'menu-2', 'menu-3']);
    });

    it('应该拒绝更新不存在的角色', async () => {
      await expect(
        roleService.updateRole('non-existent-id', { name: '新名称' })
      ).rejects.toThrow('角色不存在');
    });
  });

  describe('删除角色', () => {
    it('应该成功删除角色', async () => {
      const created = await roleService.createRole({
        name: '待删除角色',
        code: 'test_delete',
      });

      await roleService.deleteRole(created.id);

      const role = await roleService.getRoleById(created.id);
      expect(role).toBeNull();
    });

    it('应该拒绝删除不存在的角色', async () => {
      await expect(
        roleService.deleteRole('non-existent-id')
      ).rejects.toThrow('角色不存在');
    });

    it('应该批量删除角色', async () => {
      const role1 = await roleService.createRole({
        name: '角色1',
        code: 'batch_delete_1',
      });

      const role2 = await roleService.createRole({
        name: '角色2',
        code: 'batch_delete_2',
      });

      await roleService.batchDeleteRoles([role1.id, role2.id]);

      const check1 = await roleService.getRoleById(role1.id);
      const check2 = await roleService.getRoleById(role2.id);
      expect(check1).toBeNull();
      expect(check2).toBeNull();
    });
  });

  describe('权限管理', () => {
    it('应该获取角色权限', async () => {
      const role = await roleService.createRole({
        name: '测试角色',
        code: 'test_get_perms',
        permissionCodes: ['user:view', 'user:create'],
      });

      const permissions = await roleService.getRolePermissions(role.id);
      expect(permissions.sort()).toEqual(['user:create', 'user:view']);
    });

    it('应该设置角色权限', async () => {
      const role = await roleService.createRole({
        name: '测试角色',
        code: 'test_set_perms',
      });

      await roleService.setRolePermissions(role.id, ['role:view', 'role:create']);

      const permissions = await roleService.getRolePermissions(role.id);
      expect(permissions.sort()).toEqual(['role:create', 'role:view']);
    });
  });

  describe('菜单管理', () => {
    it('应该获取角色菜单', async () => {
      const role = await roleService.createRole({
        name: '测试角色',
        code: 'test_get_menus',
        menuIds: ['menu-1', 'menu-2'],
      });

      const menus = await roleService.getRoleMenus(role.id);
      expect(menus).toEqual(['menu-1', 'menu-2']);
    });

    it('应该设置角色菜单', async () => {
      const role = await roleService.createRole({
        name: '测试角色',
        code: 'test_set_menus',
      });

      await roleService.setRoleMenus(role.id, ['menu-3', 'menu-4']);

      const menus = await roleService.getRoleMenus(role.id);
      expect(menus).toEqual(['menu-3', 'menu-4']);
    });
  });

  describe('用户角色关联', () => {
    it('应该分配角色给用户', async () => {
      const role1 = await roleService.createRole({
        name: '角色1',
        code: 'user_role_1',
      });

      const role2 = await roleService.createRole({
        name: '角色2',
        code: 'user_role_2',
      });

      const userId = 'test-user-id';
      await roleService.assignRolesToUser(userId, [role1.id, role2.id]);

      const userRoles = await roleService.getUserRoles(userId);
      expect(userRoles.length).toBe(2);
      expect(userRoles.map(r => r.id)).toContain(role1.id);
      expect(userRoles.map(r => r.id)).toContain(role2.id);
    });

    it('应该替换用户的角色', async () => {
      const role1 = await roleService.createRole({
        name: '角色1',
        code: 'replace_role_1',
      });

      const role2 = await roleService.createRole({
        name: '角色2',
        code: 'replace_role_2',
      });

      const userId = 'test-user-id-2';
      
      // 先分配角色1
      await roleService.assignRolesToUser(userId, [role1.id]);
      let userRoles = await roleService.getUserRoles(userId);
      expect(userRoles.length).toBe(1);

      // 替换为角色2
      await roleService.assignRolesToUser(userId, [role2.id]);
      userRoles = await roleService.getUserRoles(userId);
      expect(userRoles.length).toBe(1);
      expect(userRoles[0].id).toBe(role2.id);
    });
  });
});
