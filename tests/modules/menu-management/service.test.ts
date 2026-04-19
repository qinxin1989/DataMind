/**
 * 菜单管理服务测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { menuService } from '../../../modules/menu-management/backend/service';
import { pool } from '../../../src/admin/core/database';
import { permissionService } from '../../../src/admin/services/permissionService';
import type { Menu } from '../../../modules/menu-management/backend/types';

describe('MenuService', () => {
  let testMenuIds: string[] = [];

  beforeEach(async () => {
    // 清理测试数据
    await menuService.clearAll();
    await permissionService.clearAll();
    testMenuIds = [];
  });

  afterEach(async () => {
    // 清理测试数据
    await menuService.clearAll();
    await permissionService.clearAll();
  });

  describe('菜单创建', () => {
    it('应该成功创建菜单', async () => {
      const menu = await menuService.createMenu({
        title: '测试菜单',
        path: '/test',
        icon: 'TestOutlined',
        order: 1,
      });

      testMenuIds.push(menu.id);

      expect(menu).toBeDefined();
      expect(menu.title).toBe('测试菜单');
      expect(menu.path).toBe('/test');
      expect(menu.icon).toBe('TestOutlined');
      expect(menu.order).toBe(1);
      expect(menu.visible).toBe(true);
      expect(menu.isSystem).toBe(false);
    });

    it('应该创建带父菜单的子菜单', async () => {
      const parent = await menuService.createMenu({
        title: '父菜单',
        path: '/parent',
      });
      testMenuIds.push(parent.id);

      const child = await menuService.createMenu({
        title: '子菜单',
        path: '/parent/child',
        parentId: parent.id,
      });
      testMenuIds.push(child.id);

      expect(child.parentId).toBe(parent.id);
    });

    it('应该允许创建三级菜单', async () => {
      const level1 = await menuService.createMenu({
        title: '一级菜单',
        path: '/level-1',
      });
      const level2 = await menuService.createMenu({
        title: '二级菜单',
        path: '/level-1/level-2',
        parentId: level1.id,
      });
      const level3 = await menuService.createMenu({
        title: '三级菜单',
        path: '/level-1/level-2/level-3',
        parentId: level2.id,
      });
      testMenuIds.push(level1.id, level2.id, level3.id);

      expect(level3.parentId).toBe(level2.id);
    });

    it('应该拒绝创建超过三级的菜单', async () => {
      const level1 = await menuService.createMenu({
        title: '一级菜单',
        path: '/level-1',
      });
      const level2 = await menuService.createMenu({
        title: '二级菜单',
        path: '/level-1/level-2',
        parentId: level1.id,
      });
      const level3 = await menuService.createMenu({
        title: '三级菜单',
        path: '/level-1/level-2/level-3',
        parentId: level2.id,
      });
      testMenuIds.push(level1.id, level2.id, level3.id);

      await expect(
        menuService.createMenu({
          title: '四级菜单',
          path: '/level-1/level-2/level-3/level-4',
          parentId: level3.id,
        })
      ).rejects.toThrow(/层级/);
    });

    it('应该创建外部链接菜单', async () => {
      const menu = await menuService.createMenu({
        title: '外部链接',
        menuType: 'external',
        externalUrl: 'https://example.com',
        openMode: 'blank',
      });
      testMenuIds.push(menu.id);

      expect(menu.menuType).toBe('external');
      expect(menu.externalUrl).toBe('https://example.com');
      expect(menu.openMode).toBe('blank');
      expect(menu.external).toBe(true);
      expect(menu.target).toBe('_blank');
    });

    it('应该创建iframe菜单', async () => {
      const menu = await menuService.createMenu({
        title: 'iframe页面',
        menuType: 'iframe',
        externalUrl: 'https://example.com',
        openMode: 'iframe',
      });
      testMenuIds.push(menu.id);

      expect(menu.menuType).toBe('iframe');
      expect(menu.openMode).toBe('iframe');
    });
  });

  describe('菜单查询', () => {
    it('应该获取所有菜单', async () => {
      const menu1 = await menuService.createMenu({ title: '菜单1', path: '/menu1' });
      const menu2 = await menuService.createMenu({ title: '菜单2', path: '/menu2' });
      testMenuIds.push(menu1.id, menu2.id);

      const menus = await menuService.getAllMenus();
      const testMenus = menus.filter(m => !m.isSystem);

      expect(testMenus.length).toBeGreaterThanOrEqual(2);
    });

    it('应该根据ID获取菜单', async () => {
      const created = await menuService.createMenu({ title: '测试菜单', path: '/test' });
      testMenuIds.push(created.id);

      const menu = await menuService.getMenuById(created.id);

      expect(menu).toBeDefined();
      expect(menu?.id).toBe(created.id);
      expect(menu?.title).toBe('测试菜单');
    });

    it('获取不存在的菜单应返回null', async () => {
      const menu = await menuService.getMenuById('non-existent-id');
      expect(menu).toBeNull();
    });

    it('应该构建菜单树', async () => {
      const parent = await menuService.createMenu({ title: '父菜单', path: '/parent' });
      const child1 = await menuService.createMenu({ 
        title: '子菜单1', 
        path: '/parent/child1',
        parentId: parent.id 
      });
      const child2 = await menuService.createMenu({ 
        title: '子菜单2', 
        path: '/parent/child2',
        parentId: parent.id 
      });
      testMenuIds.push(parent.id, child1.id, child2.id);

      const tree = await menuService.getMenuTree();
      const testParent = tree.find(m => m.id === parent.id);

      expect(testParent).toBeDefined();
      expect(testParent?.children).toBeDefined();
      expect(testParent?.children?.length).toBe(2);
    });

    it('应该获取用户菜单树', async () => {
      const menu = await menuService.createMenu({ 
        title: '可见菜单', 
        path: '/visible',
        visible: true 
      });
      testMenuIds.push(menu.id);

      const tree = await menuService.getUserMenuTree('test-user-id');
      
      expect(Array.isArray(tree)).toBe(true);
    });

    it('应该按菜单顺序构建树', async () => {
      const menu1 = await menuService.createMenu({ title: '菜单1', path: '/menu-1', order: 30 });
      const menu2 = await menuService.createMenu({ title: '菜单2', path: '/menu-2', order: 10 });
      const menu3 = await menuService.createMenu({ title: '菜单3', path: '/menu-3', order: 20 });
      testMenuIds.push(menu1.id, menu2.id, menu3.id);

      const tree = await menuService.getMenuTree();
      const orderedIds = tree
        .filter(menu => [menu1.id, menu2.id, menu3.id].includes(menu.id))
        .map(menu => menu.id);

      expect(orderedIds).toEqual([menu2.id, menu3.id, menu1.id]);
    });

    it('应该稳定排序子菜单', async () => {
      const parent = await menuService.createMenu({ title: '父菜单', path: '/parent-sort', order: 1 });
      const childA = await menuService.createMenu({
        title: 'menu-b',
        path: '/parent-sort/b',
        parentId: parent.id,
        order: 20,
      });
      const childB = await menuService.createMenu({
        title: 'menu-a',
        path: '/parent-sort/a',
        parentId: parent.id,
        order: 10,
      });
      const childC = await menuService.createMenu({
        title: 'menu-c',
        path: '/parent-sort/c',
        parentId: parent.id,
        order: 20,
      });
      testMenuIds.push(parent.id, childA.id, childB.id, childC.id);

      const tree = await menuService.getMenuTree();
      const targetParent = tree.find(menu => menu.id === parent.id);

      expect(targetParent?.children?.map(menu => menu.id)).toEqual([
        childB.id,
        childA.id,
        childC.id,
      ]);
    });
  });

  describe('菜单权限过滤', () => {
    it('应该按用户菜单权限过滤菜单树', async () => {
      const publicMenu = await menuService.createMenu({ title: '公共菜单', path: '/public', order: 1 });
      const adminOnlyMenu = await menuService.createMenu({
        title: '管理员菜单',
        path: '/admin-only',
        permission: 'admin:access',
        order: 2,
      });
      const userOnlyMenu = await menuService.createMenu({
        title: '用户菜单',
        path: '/user-only',
        permission: 'user:access',
        order: 3,
      });
      testMenuIds.push(publicMenu.id, adminOnlyMenu.id, userOnlyMenu.id);

      permissionService.setRoleForTest({
        id: 'user-role',
        name: 'User',
        code: 'user-role',
        description: '',
        permissionCodes: ['user:access'],
        menuIds: [publicMenu.id, userOnlyMenu.id],
        status: 'active',
        isSystem: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      permissionService.setUserRolesForTest('user-1', ['user-role']);

      const userMenus = await menuService.getUserMenuTree('user-1');
      const menuTitles = userMenus.map(menu => menu.title);

      expect(menuTitles).toContain('公共菜单');
      expect(menuTitles).toContain('用户菜单');
      expect(menuTitles).not.toContain('管理员菜单');
    });

    it('应该为超级管理员返回所有可见菜单', async () => {
      const visibleMenu = await menuService.createMenu({ title: '可见菜单', path: '/visible', visible: true });
      const hiddenMenu = await menuService.createMenu({ title: '隐藏菜单', path: '/hidden', visible: false });
      testMenuIds.push(visibleMenu.id, hiddenMenu.id);

      permissionService.setRoleForTest({
        id: 'super-role',
        name: 'Super Admin',
        code: 'super-admin-role',
        description: '',
        permissionCodes: ['*'],
        menuIds: [],
        status: 'active',
        isSystem: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      permissionService.setUserRolesForTest('super-admin', ['super-role']);

      const menus = await menuService.getUserMenuTree('super-admin');
      const menuTitles = menus.map(menu => menu.title);

      expect(menuTitles).toContain('可见菜单');
      expect(menuTitles).not.toContain('隐藏菜单');
    });

    it('应该在用户视图隐藏禁用菜单，但在管理视图保留', async () => {
      const visibleMenu = await menuService.createMenu({ title: '启用菜单', path: '/enabled', visible: true });
      const hiddenMenu = await menuService.createMenu({ title: '禁用菜单', path: '/disabled', visible: false });
      testMenuIds.push(visibleMenu.id, hiddenMenu.id);

      permissionService.setRoleForTest({
        id: 'plain-user-role',
        name: 'Plain User',
        code: 'plain-user-role',
        description: '',
        permissionCodes: ['menu:view'],
        menuIds: [visibleMenu.id, hiddenMenu.id],
        status: 'active',
        isSystem: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      permissionService.setUserRolesForTest('plain-user', ['plain-user-role']);

      const userTree = await menuService.getUserMenuTree('plain-user');
      const fullTree = await menuService.getFullMenuTree();

      expect(userTree.map(menu => menu.title)).toContain('启用菜单');
      expect(userTree.map(menu => menu.title)).not.toContain('禁用菜单');
      expect(fullTree.map(menu => menu.title)).toContain('禁用菜单');
    });
  });

  describe('菜单更新', () => {
    it('应该成功更新菜单', async () => {
      const menu = await menuService.createMenu({ title: '原标题', path: '/original' });
      testMenuIds.push(menu.id);

      const updated = await menuService.updateMenu(menu.id, {
        title: '新标题',
        path: '/new',
        icon: 'NewIcon',
      });

      expect(updated.title).toBe('新标题');
      expect(updated.path).toBe('/new');
      expect(updated.icon).toBe('NewIcon');
    });

    it('应该更新菜单可见性', async () => {
      const menu = await menuService.createMenu({ title: '测试', path: '/test', visible: true });
      testMenuIds.push(menu.id);

      const updated = await menuService.updateMenu(menu.id, { visible: false });

      expect(updated.visible).toBe(false);
    });

    it('更新不存在的菜单应抛出错误', async () => {
      await expect(
        menuService.updateMenu('non-existent-id', { title: '新标题' })
      ).rejects.toThrow('菜单不存在');
    });
  });

  describe('菜单删除', () => {
    it('应该成功删除菜单', async () => {
      const menu = await menuService.createMenu({ title: '待删除', path: '/delete' });
      testMenuIds.push(menu.id);

      await menuService.deleteMenu(menu.id);

      const deleted = await menuService.getMenuById(menu.id);
      expect(deleted).toBeNull();
    });

    it('删除有子菜单的父菜单应拒绝', async () => {
      const parent = await menuService.createMenu({ title: '父菜单', path: '/parent' });
      const child = await menuService.createMenu({ 
        title: '子菜单', 
        path: '/parent/child',
        parentId: parent.id 
      });
      testMenuIds.push(parent.id, child.id);

      await expect(
        menuService.deleteMenu(parent.id)
      ).rejects.toThrow(/子菜单/);

      // 父菜单和子菜单应该都还在
      const existingParent = await menuService.getMenuById(parent.id);
      const existingChild = await menuService.getMenuById(child.id);
      expect(existingParent).toBeDefined();
      expect(existingChild).toBeDefined();
    });

    it('删除不存在的菜单应抛出错误', async () => {
      await expect(
        menuService.deleteMenu('non-existent-id')
      ).rejects.toThrow('菜单不存在');
    });

    it('默认清理应保留被提升为系统菜单的测试菜单', async () => {
      const menu = await menuService.createMenu({ title: '系统保留菜单', path: '/promoted-system-menu-default' });

      try {
        await pool.execute('UPDATE sys_menus SET is_system = TRUE WHERE id = ?', [menu.id]);

        await menuService.clearAll();

        expect(await menuService.getMenuById(menu.id)).not.toBeNull();
      } finally {
        await menuService.clearAll(true);
      }
    });

    it('显式全量清理应删除被提升为系统菜单的测试菜单', async () => {
      const menu = await menuService.createMenu({ title: '系统删除菜单', path: '/promoted-system-menu-full-cleanup' });

      await pool.execute('UPDATE sys_menus SET is_system = TRUE WHERE id = ?', [menu.id]);

      await menuService.clearAll(true);

      expect(await menuService.getMenuById(menu.id)).toBeNull();
    });

    it('应该批量删除菜单', async () => {
      const menu1 = await menuService.createMenu({ title: '菜单1', path: '/menu1' });
      const menu2 = await menuService.createMenu({ title: '菜单2', path: '/menu2' });
      testMenuIds.push(menu1.id, menu2.id);

      await menuService.batchDeleteMenus([menu1.id, menu2.id]);

      const deleted1 = await menuService.getMenuById(menu1.id);
      const deleted2 = await menuService.getMenuById(menu2.id);

      expect(deleted1).toBeNull();
      expect(deleted2).toBeNull();
    });
  });

  describe('菜单排序', () => {
    it('应该更新菜单排序', async () => {
      const menu1 = await menuService.createMenu({ title: '菜单1', path: '/menu1', order: 1 });
      const menu2 = await menuService.createMenu({ title: '菜单2', path: '/menu2', order: 2 });
      testMenuIds.push(menu1.id, menu2.id);

      await menuService.updateMenuOrder([
        { id: menu1.id, order: 10 },
        { id: menu2.id, order: 5 },
      ]);

      const updated1 = await menuService.getMenuById(menu1.id);
      const updated2 = await menuService.getMenuById(menu2.id);

      expect(updated1?.order).toBe(10);
      expect(updated2?.order).toBe(5);
    });

    it('应该使用updateMenuOrder更新排序', async () => {
      const menu = await menuService.createMenu({ title: '测试', path: '/test', order: 1 });
      testMenuIds.push(menu.id);

      await menuService.updateMenuOrder([{ id: menu.id, order: 99 }]);

      const updated = await menuService.getMenuById(menu.id);
      expect(updated?.sortOrder).toBe(99);
    });
  });

  describe('菜单可见性', () => {
    it('应该切换菜单可见性', async () => {
      const menu = await menuService.createMenu({ title: '测试', path: '/test', visible: true });
      testMenuIds.push(menu.id);

      const toggled = await menuService.toggleVisibility(menu.id);
      expect(toggled.visible).toBe(false);

      const toggledAgain = await menuService.toggleVisibility(menu.id);
      expect(toggledAgain.visible).toBe(true);
    });

    it('应该设置菜单可见性', async () => {
      const menu = await menuService.createMenu({ title: '测试', path: '/test', visible: true });
      testMenuIds.push(menu.id);

      const updated = await menuService.setMenuVisibility(menu.id, false);
      expect(updated.visible).toBe(false);

      const updated2 = await menuService.setMenuVisibility(menu.id, true);
      expect(updated2.visible).toBe(true);
    });

    it('切换不存在菜单的可见性应抛出错误', async () => {
      await expect(
        menuService.toggleVisibility('non-existent-id')
      ).rejects.toThrow('菜单不存在');
    });
  });

  describe('菜单类型', () => {
    it('应该正确处理内部路由菜单', async () => {
      const menu = await menuService.createMenu({
        title: '内部路由',
        path: '/internal',
        menuType: 'internal',
      });
      testMenuIds.push(menu.id);

      expect(menu.menuType).toBe('internal');
      expect(menu.external).toBe(false);
      expect(menu.target).toBe('_self');
    });

    it('应该正确处理外部链接菜单', async () => {
      const menu = await menuService.createMenu({
        title: '外部链接',
        menuType: 'external',
        externalUrl: 'https://example.com',
        openMode: 'blank',
      });
      testMenuIds.push(menu.id);

      expect(menu.menuType).toBe('external');
      expect(menu.external).toBe(true);
      expect(menu.target).toBe('_blank');
    });

    it('应该正确处理iframe菜单', async () => {
      const menu = await menuService.createMenu({
        title: 'iframe',
        menuType: 'iframe',
        externalUrl: 'https://example.com',
        openMode: 'iframe',
      });
      testMenuIds.push(menu.id);

      expect(menu.menuType).toBe('iframe');
      expect(menu.external).toBe(true);
    });
  });

  describe('权限和模块', () => {
    it('应该设置权限代码', async () => {
      const menu = await menuService.createMenu({
        title: '测试',
        path: '/test',
        permission: 'test:view',
      });
      testMenuIds.push(menu.id);

      expect(menu.permission).toBe('test:view');
      expect(menu.permissionCode).toBe('test:view');
    });

    it('应该设置模块代码', async () => {
      const menu = await menuService.createMenu({
        title: '测试',
        path: '/test',
        moduleCode: 'manual-extension',
      });
      testMenuIds.push(menu.id);

      expect(menu.moduleCode).toBe('manual-extension');
    });

    it('应该拒绝在页面里创建已注册模块的菜单', async () => {
      await expect(
        menuService.createMenu({
          title: '模块菜单',
          path: '/module-bound-menu',
          moduleCode: 'dashboard',
        })
      ).rejects.toThrow(/module\.json/);
    });

    it('应该拒绝修改模块注册菜单', async () => {
      const menu = await menuService.createMenu({
        title: '受保护菜单',
        path: '/protected-menu',
        moduleCode: 'manual-extension',
      });
      testMenuIds.push(menu.id);

      await pool.execute(
        'UPDATE sys_menus SET module_name = ?, module_code = ? WHERE id = ?',
        ['dashboard', 'dashboard', menu.id]
      );

      await expect(
        menuService.updateMenu(menu.id, { title: '新标题' })
      ).rejects.toThrow(/module\.json/);
    });

    it('应该拒绝删除模块注册菜单', async () => {
      const menu = await menuService.createMenu({
        title: '待删模块菜单',
        path: '/protected-delete-menu',
        moduleCode: 'manual-extension',
      });
      testMenuIds.push(menu.id);

      await pool.execute(
        'UPDATE sys_menus SET module_name = ?, module_code = ? WHERE id = ?',
        ['dashboard', 'dashboard', menu.id]
      );

      await expect(
        menuService.deleteMenu(menu.id)
      ).rejects.toThrow(/module\.json/);
    });
  });
});
