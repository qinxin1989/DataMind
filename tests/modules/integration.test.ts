/**
 * 模块集成测试
 * 验证模块间的依赖关系和协作
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { userService } from '../../modules/user-management/backend/service';
import { roleService } from '../../modules/role-management/backend/service';
import { menuService } from '../../modules/menu-management/backend/service';

describe('模块集成测试', () => {
  let testUserIds: string[] = [];
  let testRoleIds: string[] = [];
  let testMenuIds: string[] = [];

  beforeEach(async () => {
    // 清理测试数据
    testUserIds = [];
    testRoleIds = [];
    testMenuIds = [];
  });

  afterEach(async () => {
    // 清理测试数据
    for (const id of testUserIds) {
      try {
        await userService.deleteUser(id);
      } catch (e) {
        // 忽略删除错误
      }
    }
    for (const id of testRoleIds) {
      try {
        await roleService.deleteRole(id);
      } catch (e) {
        // 忽略删除错误
      }
    }
    for (const id of testMenuIds) {
      try {
        await menuService.deleteMenu(id);
      } catch (e) {
        // 忽略删除错误
      }
    }
  });

  describe('用户-角色集成', () => {
    it('应该能够创建用户并分配角色', async () => {
      // 创建角色
      const role = await roleService.createRole({
        name: '测试角色',
        code: 'test-role-integration',
        description: '集成测试角色',
        permissionCodes: ['user:view', 'user:create'],
      });
      testRoleIds.push(role.id);

      // 创建用户
      const user = await userService.createUser({
        username: 'integration-test-user',
        password: 'Test123456',
        email: 'integration@test.com',
        fullName: '集成测试用户',
      });
      testUserIds.push(user.id);

      // 分配角色给用户
      await roleService.assignRolesToUser(user.id, [role.id]);

      // 验证用户角色
      const userRoles = await roleService.getUserRoles(user.id);
      expect(userRoles.length).toBe(1);
      expect(userRoles[0].id).toBe(role.id);
      expect(userRoles[0].code).toBe('test-role-integration');
    });

    it('应该能够通过角色获取权限', async () => {
      // 创建带权限的角色
      const role = await roleService.createRole({
        name: '权限测试角色',
        code: 'perm-test-role',
        permissionCodes: ['menu:view', 'menu:create', 'menu:update'],
      });
      testRoleIds.push(role.id);

      // 验证角色权限
      const permissions = await roleService.getRolePermissions(role.id);
      expect(permissions).toContain('menu:view');
      expect(permissions).toContain('menu:create');
      expect(permissions).toContain('menu:update');
      expect(permissions.length).toBe(3);
    });
  });

  describe('角色-菜单集成', () => {
    it('应该能够为角色分配菜单', async () => {
      // 创建菜单
      const menu1 = await menuService.createMenu({
        title: '集成测试菜单1',
        path: '/integration-test-1',
        visible: true,
      });
      testMenuIds.push(menu1.id);

      const menu2 = await menuService.createMenu({
        title: '集成测试菜单2',
        path: '/integration-test-2',
        visible: true,
      });
      testMenuIds.push(menu2.id);

      // 创建角色
      const role = await roleService.createRole({
        name: '菜单测试角色',
        code: 'menu-test-role',
        menuIds: [menu1.id, menu2.id],
      });
      testRoleIds.push(role.id);

      // 验证角色菜单
      const roleMenus = await roleService.getRoleMenus(role.id);
      expect(roleMenus.length).toBe(2);
      expect(roleMenus).toContain(menu1.id);
      expect(roleMenus).toContain(menu2.id);
    });

    it('应该能够更新角色的菜单权限', async () => {
      // 创建菜单
      const menu = await menuService.createMenu({
        title: '更新测试菜单',
        path: '/update-test',
        visible: true,
      });
      testMenuIds.push(menu.id);

      // 创建角色(不分配菜单)
      const role = await roleService.createRole({
        name: '更新测试角色',
        code: 'update-test-role',
      });
      testRoleIds.push(role.id);

      // 验证初始状态
      let roleMenus = await roleService.getRoleMenus(role.id);
      expect(roleMenus.length).toBe(0);

      // 更新角色,添加菜单
      await roleService.updateRole(role.id, {
        menuIds: [menu.id],
      });

      // 验证更新后的状态
      roleMenus = await roleService.getRoleMenus(role.id);
      expect(roleMenus.length).toBe(1);
      expect(roleMenus[0]).toBe(menu.id);
    });
  });

  describe('完整流程集成', () => {
    it('应该能够完成用户-角色-菜单的完整流程', async () => {
      // 1. 创建菜单
      const parentMenu = await menuService.createMenu({
        title: '系统管理',
        path: '/system',
        icon: 'SettingOutlined',
        visible: true,
      });
      testMenuIds.push(parentMenu.id);

      const childMenu = await menuService.createMenu({
        title: '用户管理',
        path: '/system/users',
        icon: 'UserOutlined',
        parentId: parentMenu.id,
        visible: true,
        permission: 'user:view',
      });
      testMenuIds.push(childMenu.id);

      // 2. 创建角色并分配菜单和权限
      const role = await roleService.createRole({
        name: '系统管理员',
        code: 'system-admin-test',
        description: '系统管理员角色',
        permissionCodes: ['user:view', 'user:create', 'user:update', 'user:delete'],
        menuIds: [parentMenu.id, childMenu.id],
      });
      testRoleIds.push(role.id);

      // 3. 创建用户
      const user = await userService.createUser({
        username: 'system-admin',
        password: 'Admin123456',
        email: 'admin@test.com',
        fullName: '系统管理员',
      });
      testUserIds.push(user.id);

      // 4. 分配角色给用户
      await roleService.assignRolesToUser(user.id, [role.id]);

      // 5. 验证完整流程
      // 验证用户角色
      const userRoles = await roleService.getUserRoles(user.id);
      expect(userRoles.length).toBe(1);
      expect(userRoles[0].code).toBe('system-admin-test');

      // 验证角色权限
      expect(userRoles[0].permissionCodes).toContain('user:view');
      expect(userRoles[0].permissionCodes).toContain('user:create');

      // 验证角色菜单
      expect(userRoles[0].menuIds).toContain(parentMenu.id);
      expect(userRoles[0].menuIds).toContain(childMenu.id);

      // 验证菜单树结构
      const menuTree = await menuService.getMenuTree();
      const testParent = menuTree.find(m => m.id === parentMenu.id);
      expect(testParent).toBeDefined();
      expect(testParent?.children?.length).toBe(1);
      expect(testParent?.children?.[0].id).toBe(childMenu.id);
    });
  });

  describe('模块依赖验证', () => {
    it('角色管理模块应该依赖用户管理模块', async () => {
      // 创建用户
      const user = await userService.createUser({
        username: 'dep-test-user',
        password: 'Test123456',
        email: 'dep@test.com',
        fullName: '依赖测试',
      });
      testUserIds.push(user.id);

      // 创建角色
      const role = await roleService.createRole({
        name: '依赖测试角色',
        code: 'dep-test-role',
      });
      testRoleIds.push(role.id);

      // 角色服务应该能够操作用户角色关系
      await roleService.assignRolesToUser(user.id, [role.id]);
      const userRoles = await roleService.getUserRoles(user.id);
      expect(userRoles.length).toBe(1);
    });

    it('菜单管理模块应该能够独立工作', async () => {
      // 菜单管理不依赖其他模块,应该能够独立创建和管理菜单
      const menu = await menuService.createMenu({
        title: '独立测试菜单',
        path: '/independent-test',
        visible: true,
      });
      testMenuIds.push(menu.id);

      const retrieved = await menuService.getMenuById(menu.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.title).toBe('独立测试菜单');
    });
  });

  describe('数据一致性验证', () => {
    it('删除角色时应该阻止删除正在使用的角色', async () => {
      // 创建用户和角色
      const user = await userService.createUser({
        username: 'cleanup-test-user',
        password: 'Test123456',
        email: 'cleanup@test.com',
        fullName: '清理测试',
      });
      testUserIds.push(user.id);

      const role = await roleService.createRole({
        name: '清理测试角色',
        code: 'cleanup-test-role',
      });
      testRoleIds.push(role.id);

      // 分配角色
      await roleService.assignRolesToUser(user.id, [role.id]);

      // 验证角色已分配
      let userRoles = await roleService.getUserRoles(user.id);
      expect(userRoles.length).toBe(1);

      // 尝试删除正在使用的角色,应该抛出错误
      await expect(
        roleService.deleteRole(role.id)
      ).rejects.toThrow('个用户使用');

      // 先取消用户的角色分配
      await roleService.assignRolesToUser(user.id, []);

      // 验证用户角色关联已清理
      userRoles = await roleService.getUserRoles(user.id);
      expect(userRoles.length).toBe(0);

      // 现在应该可以删除角色
      await roleService.deleteRole(role.id);
      testRoleIds = testRoleIds.filter(id => id !== role.id);

      // 验证角色已删除
      const deletedRole = await roleService.getRoleById(role.id);
      expect(deletedRole).toBeNull();
    });

    it('删除父菜单时应该级联删除子菜单', async () => {
      // 创建父子菜单
      const parent = await menuService.createMenu({
        title: '父菜单',
        path: '/parent',
        visible: true,
      });
      testMenuIds.push(parent.id);

      const child = await menuService.createMenu({
        title: '子菜单',
        path: '/parent/child',
        parentId: parent.id,
        visible: true,
      });
      testMenuIds.push(child.id);

      // 验证菜单已创建
      let childMenu = await menuService.getMenuById(child.id);
      expect(childMenu).toBeDefined();

      // 删除父菜单
      await menuService.deleteMenu(parent.id);
      testMenuIds = testMenuIds.filter(id => id !== parent.id && id !== child.id);

      // 验证子菜单也被删除
      childMenu = await menuService.getMenuById(child.id);
      expect(childMenu).toBeNull();
    });
  });
});
