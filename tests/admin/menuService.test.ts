/**
 * 菜单管理测试
 * Feature: modular-admin-framework
 * Property 9: Menu Hierarchy Depth Limit
 * Property 10: Menu Permission Filtering
 * Property 11: Disabled Menu Preservation
 * Validates: Requirements 5.1, 5.3, 5.6
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MenuService } from '../../src/admin/modules/menu/menuService';
import { permissionService } from '../../src/admin/services/permissionService';
import type { MenuItem, Role } from '../../src/admin/types';

describe('MenuService Unit Tests', () => {
  let menuService: MenuService;

  beforeEach(async () => {
    menuService = new MenuService();
    await menuService.clearAll();
    await permissionService.clearAll();
  });

  // Property 9: Menu Hierarchy Depth Limit
  describe('Menu Hierarchy Depth Limit', () => {
    it('should allow creating menu up to 3 levels', async () => {
      // Level 1
      const level1 = await menuService.createMenu({ title: 'Level 1', order: 1 });
      expect(level1.id).toBeDefined();

      // Level 2
      const level2 = await menuService.createMenu({ title: 'Level 2', parentId: level1.id, order: 1 });
      expect(level2.id).toBeDefined();

      // Level 3
      const level3 = await menuService.createMenu({ title: 'Level 3', parentId: level2.id, order: 1 });
      expect(level3.id).toBeDefined();
    });

    it('should reject creating menu beyond 3 levels', async () => {
      const level1 = await menuService.createMenu({ title: 'Level 1', order: 1 });
      const level2 = await menuService.createMenu({ title: 'Level 2', parentId: level1.id, order: 1 });
      const level3 = await menuService.createMenu({ title: 'Level 3', parentId: level2.id, order: 1 });

      // Level 4 should fail
      await expect(menuService.createMenu({ 
        title: 'Level 4', 
        parentId: level3.id, 
        order: 1 
      })).rejects.toThrow(/层级/);
    });
  });

  // Property 10: Menu Permission Filtering
  describe('Menu Permission Filtering', () => {
    it('should filter menus based on user permissions', async () => {
      // 创建菜单
      const menu1 = await menuService.createMenu({ title: 'Public', order: 1 });
      const menu2 = await menuService.createMenu({ title: 'Admin Only', permission: 'admin:access', order: 2 });
      const menu3 = await menuService.createMenu({ title: 'User Only', permission: 'user:access', order: 3 });

      // 创建角色并分配菜单
      const userRole: Role = {
        id: 'user-role',
        name: 'User',
        code: 'user',
        description: '',
        permissionCodes: ['user:access'],
        menuIds: [menu1.id, menu3.id], // 分配 Public 和 User Only 菜单
        status: 'active',
        isSystem: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      permissionService.setRoleForTest(userRole);
      permissionService.setUserRolesForTest('user-1', ['user-role']);

      // 获取用户菜单
      const userMenus = await menuService.getUserMenuTree('user-1');

      // 应该只看到 Public 和 User Only
      const titles = userMenus.map(m => m.title);
      expect(titles).toContain('Public');
      expect(titles).toContain('User Only');
      expect(titles).not.toContain('Admin Only');
    });

    it('should show all menus to super admin', async () => {
      const menu1 = await menuService.createMenu({ title: 'Public', order: 1 });
      const menu2 = await menuService.createMenu({ title: 'Admin Only', permission: 'admin:access', order: 2 });
      const menu3 = await menuService.createMenu({ title: 'Secret', permission: 'secret:access', order: 3 });

      const superAdminRole: Role = {
        id: 'super-admin',
        name: 'Super Admin',
        code: 'super_admin',
        description: '',
        permissionCodes: ['*'],
        status: 'active',
        isSystem: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      permissionService.setRoleForTest(superAdminRole);
      permissionService.setUserRolesForTest('admin-1', ['super-admin']);

      const adminMenus = await menuService.getUserMenuTree('admin-1');
      
      // 超级管理员应该能看到所有可见菜单（包括我们创建的3个）
      const titles = adminMenus.map(m => m.title);
      expect(titles).toContain('Public');
      expect(titles).toContain('Admin Only');
      expect(titles).toContain('Secret');
    });
  });

  // Property 11: Disabled Menu Preservation
  describe('Disabled Menu Preservation', () => {
    it('should hide disabled menu from user navigation', async () => {
      const menu = await menuService.createMenu({ title: 'Test Menu', order: 1, visible: true });
      
      // 设置为不可见
      await menuService.setMenuVisibility(menu.id, false);

      // 用户菜单不应包含
      const userMenus = await menuService.getUserMenuTree('any-user');
      expect(userMenus.find(m => m.id === menu.id)).toBeUndefined();
    });

    it('should preserve disabled menu in admin view', async () => {
      const menu = await menuService.createMenu({ title: 'Test Menu', order: 1, visible: true });
      await menuService.setMenuVisibility(menu.id, false);

      // 管理视图应该包含
      const fullTree = await menuService.getFullMenuTree();
      expect(fullTree.find(m => m.id === menu.id)).toBeDefined();
    });
  });

  describe('Basic CRUD Operations', () => {
    it('should create and retrieve menu', async () => {
      const menu = await menuService.createMenu({
        title: 'Test Menu',
        icon: 'test',
        path: '/test',
        order: 1,
      });

      expect(menu.title).toBe('Test Menu');
      expect(menu.icon).toBe('test');

      const retrieved = await menuService.getMenuById(menu.id);
      expect(retrieved?.title).toBe('Test Menu');
    });

    it('should update menu', async () => {
      const menu = await menuService.createMenu({ title: 'Original', order: 1 });
      
      const updated = await menuService.updateMenu(menu.id, { title: 'Updated' });
      expect(updated.title).toBe('Updated');
    });

    it('should delete menu', async () => {
      const menu = await menuService.createMenu({ title: 'To Delete', order: 1 });
      
      await menuService.deleteMenu(menu.id);
      
      const retrieved = await menuService.getMenuById(menu.id);
      expect(retrieved).toBeNull();
    });

    it('should not delete menu with children', async () => {
      const parent = await menuService.createMenu({ title: 'Parent', order: 1 });
      await menuService.createMenu({ title: 'Child', parentId: parent.id, order: 1 });

      await expect(menuService.deleteMenu(parent.id)).rejects.toThrow(/子菜单/);
    });

    it('should update menu order', async () => {
      const menu1 = await menuService.createMenu({ title: 'Menu 1', order: 1 });
      const menu2 = await menuService.createMenu({ title: 'Menu 2', order: 2 });

      await menuService.updateMenuOrder([
        { id: menu1.id, order: 2 },
        { id: menu2.id, order: 1 },
      ]);

      const menu1Updated = await menuService.getMenuById(menu1.id);
      const menu2Updated = await menuService.getMenuById(menu2.id);
      
      expect(menu1Updated?.sortOrder).toBe(2);
      expect(menu2Updated?.sortOrder).toBe(1);
    });
  });

  describe('Menu Tree Building', () => {
    it('should build correct tree structure', async () => {
      const parent = await menuService.createMenu({ title: 'Parent', order: 1 });
      const child1 = await menuService.createMenu({ title: 'Child 1', parentId: parent.id, order: 1 });
      const child2 = await menuService.createMenu({ title: 'Child 2', parentId: parent.id, order: 2 });

      const tree = await menuService.getFullMenuTree();
      
      // 找到我们创建的父菜单
      const parentMenu = tree.find(m => m.id === parent.id);
      expect(parentMenu).toBeDefined();
      expect(parentMenu?.title).toBe('Parent');
      expect(parentMenu?.children?.length).toBe(2);
      expect(parentMenu?.children?.[0].title).toBe('Child 1');
      expect(parentMenu?.children?.[1].title).toBe('Child 2');
    });

    it('should sort menus by order', async () => {
      const menu3 = await menuService.createMenu({ title: 'Third', order: 103 });
      const menu1 = await menuService.createMenu({ title: 'First', order: 101 });
      const menu2 = await menuService.createMenu({ title: 'Second', order: 102 });

      const tree = await menuService.getFullMenuTree();
      
      // 找到我们创建的菜单
      const ourMenus = tree.filter(m => ['First', 'Second', 'Third'].includes(m.title));
      expect(ourMenus[0].title).toBe('First');
      expect(ourMenus[1].title).toBe('Second');
      expect(ourMenus[2].title).toBe('Third');
    });
  });
});
