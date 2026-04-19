/**
 * 菜单管理服务
 */

import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../../src/admin/core/database';
import { permissionService } from '../../../src/admin/services/permissionService';
import { isRegisteredModuleName } from '../../../src/module-system/core/registeredModule';
import type { Menu, CreateMenuRequest, UpdateMenuRequest } from './types';

export class MenuService {
  private readonly menuCollator = new Intl.Collator('zh-CN');

  /**
   * 获取所有菜单
   */
  async getAllMenus(): Promise<Menu[]> {
    const [rows] = await pool.execute('SELECT * FROM sys_menus ORDER BY sort_order ASC');
    return (rows as any[]).map(row => this.rowToMenu(row));
  }

  /**
   * 获取菜单树
   */
  async getMenuTree(): Promise<Menu[]> {
    const menus = await this.getAllMenus();
    return this.buildTree(menus);
  }

  /**
   * 获取完整菜单树
   */
  async getFullMenuTree(): Promise<Menu[]> {
    return this.getMenuTree();
  }

  /**
   * 获取用户菜单树
   */
  async getUserMenuTree(userId: string): Promise<Menu[]> {
    // 获取用户有权限的菜单ID
    let allowedMenuIds = await permissionService.getUserMenuIds(userId);

    // 检查用户是否是管理员（拥有所有权限）
    const userPermissions = await permissionService.getUserPermissions(userId);
    const isAdmin = userPermissions.includes('*');

    const menus = await this.getAllMenus();

    // 如果是管理员，返回所有可见菜单
    if (isAdmin) {
      const visibleMenus = menus.filter(m => m.visible);
      return this.buildTree(visibleMenus);
    }

    // 如果用户没有任何菜单权限，尝试获取"普通用户"角色的默认菜单
    if (allowedMenuIds.length === 0) {
      const defaultRoleMenus = await permissionService.getRoleMenus('00000000-0000-0000-0000-000000000003');
      if (defaultRoleMenus.length > 0) {
        allowedMenuIds = defaultRoleMenus;
      }
    }

    // 如果还是没有菜单，返回基础菜单（仪表盘和AI服务）
    if (allowedMenuIds.length === 0) {
      const basicMenus = menus.filter(m =>
        m.visible && (
          m.path === '/workbench' ||
          m.path?.startsWith('/ai/') ||
          m.title === '工作台'
        )
      );
      return this.buildTree(basicMenus);
    }

    // 普通用户只返回有权限的菜单
    // 同时需要包含父菜单（即使父菜单不在权限列表中，也需要显示以保持树结构）
    const menuMap = new Map(menus.map(m => [m.id, m]));
    const visibleMenuIds = new Set<string>();

    for (const menuId of allowedMenuIds) {
      visibleMenuIds.add(menuId);
      let currentMenu = menuMap.get(menuId);
      while (currentMenu?.parentId) {
        visibleMenuIds.add(currentMenu.parentId);
        currentMenu = menuMap.get(currentMenu.parentId);
      }
    }

    const filteredMenus = menus.filter(m => m.visible && visibleMenuIds.has(m.id));
    return this.buildTree(filteredMenus);
  }

  /**
   * 构建树形结构
   */
  private buildTree(menus: Menu[], parentId: string | null = null): Menu[] {
    const siblings = menus.filter(m => (m.parentId || null) === parentId);
    const sortedSiblings = [...siblings].sort((a, b) => this.compareMenus(a, b));

    return sortedSiblings.map(m => ({
      ...m,
      children: this.buildTree(menus, m.id),
    }));
  }

  private compareMenus(a: Menu, b: Menu): number {
    const orderDiff = (a.sortOrder || 0) - (b.sortOrder || 0);
    if (orderDiff !== 0) {
      return orderDiff;
    }

    const titleDiff = this.menuCollator.compare(a.title || '', b.title || '');
    if (titleDiff !== 0) {
      return titleDiff;
    }

    return this.menuCollator.compare(a.path || a.id, b.path || b.id);
  }

  /**
   * 根据ID获取菜单
   */
  async getMenuById(id: string): Promise<Menu | null> {
    const [rows] = await pool.execute('SELECT * FROM sys_menus WHERE id = ?', [id]);
    const menus = rows as any[];
    if (menus.length === 0) return null;
    return this.rowToMenu(menus[0]);
  }

  /**
   * 获取菜单的层级深度
   */
  private async getMenuDepth(menuId: string): Promise<number> {
    let depth = 0;
    let currentId: string | undefined = menuId;

    while (currentId) {
      const menu = await this.getMenuById(currentId);
      if (!menu) break;
      depth++;
      currentId = menu.parentId;

      // 防止无限循环
      if (depth > 10) {
        throw new Error('菜单层级异常，可能存在循环引用');
      }
    }

    return depth;
  }

  /**
   * 创建菜单
   */
  async createMenu(data: CreateMenuRequest): Promise<Menu> {
    if (isRegisteredModuleName(data.moduleCode)) {
      throw new Error(`模块注册菜单必须在 modules/${data.moduleCode}/module.json 中维护`);
    }

    if (data.parentId) {
      const parentMenu = await this.getMenuById(data.parentId);
      if (parentMenu && this.isRegisteredModuleMenu(parentMenu)) {
        throw new Error('不能在模块注册菜单下手动新增子菜单，请在对应模块的 module.json 中维护');
      }
    }

    // 检查层级限制（最多3层）
    if (data.parentId) {
      const parentDepth = await this.getMenuDepth(data.parentId);
      if (parentDepth >= 3) {
        throw new Error('菜单层级不能超过3层');
      }
    }

    const id = uuidv4();

    await pool.execute(
      `INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, visible, permission_code, is_system, menu_type, external_url, open_mode, module_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.title,
        data.path || null,
        data.icon || null,
        data.parentId || null,
        data.order || 0,
        data.visible !== false,
        data.permission || null,
        false,
        data.menuType || 'internal',
        data.externalUrl || null,
        data.openMode || 'current',
        data.moduleCode || null
      ]
    );

    return this.getMenuById(id) as Promise<Menu>;
  }

  /**
   * 更新菜单
   */
  async updateMenu(id: string, data: UpdateMenuRequest): Promise<Menu> {
    const menu = await this.getMenuById(id);
    if (!menu) {
      throw new Error('菜单不存在');
    }

    this.assertManualMutationAllowed(menu);

    if (data.moduleCode !== undefined && isRegisteredModuleName(data.moduleCode)) {
      throw new Error(`模块注册菜单必须在 modules/${data.moduleCode}/module.json 中维护`);
    }

    if (data.parentId) {
      const parentMenu = await this.getMenuById(data.parentId);
      if (parentMenu && this.isRegisteredModuleMenu(parentMenu)) {
        throw new Error('不能把手动菜单挂到模块注册菜单下，请在对应模块的 module.json 中维护');
      }
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) { updates.push('title = ?'); values.push(data.title); }
    if (data.path !== undefined) { updates.push('path = ?'); values.push(data.path); }
    if (data.icon !== undefined) { updates.push('icon = ?'); values.push(data.icon); }
    if (data.parentId !== undefined) { updates.push('parent_id = ?'); values.push(data.parentId); }
    if (data.order !== undefined) { updates.push('sort_order = ?'); values.push(data.order); }
    if (data.visible !== undefined) { updates.push('visible = ?'); values.push(data.visible); }
    if (data.permission !== undefined) { updates.push('permission_code = ?'); values.push(data.permission); }
    if (data.menuType !== undefined) { updates.push('menu_type = ?'); values.push(data.menuType); }
    if (data.externalUrl !== undefined) { updates.push('external_url = ?'); values.push(data.externalUrl); }
    if (data.openMode !== undefined) { updates.push('open_mode = ?'); values.push(data.openMode); }
    if (data.moduleCode !== undefined) { updates.push('module_code = ?'); values.push(data.moduleCode); }

    if (updates.length > 0) {
      values.push(id);
      await pool.execute(`UPDATE sys_menus SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    return this.getMenuById(id) as Promise<Menu>;
  }

  /**
   * 删除菜单
   */
  async deleteMenu(id: string): Promise<void> {
    const menu = await this.getMenuById(id);
    if (!menu) {
      throw new Error('菜单不存在');
    }
    this.assertManualMutationAllowed(menu);
    if (menu.isSystem) {
      throw new Error('系统菜单不能删除');
    }

    // 检查是否有子菜单
    const [childRows] = await pool.execute(
      'SELECT COUNT(*) as count FROM sys_menus WHERE parent_id = ?',
      [id]
    );
    const childCount = (childRows as any)[0].count;
    if (childCount > 0) {
      throw new Error('不能删除有子菜单的菜单，请先删除子菜单');
    }

    await pool.execute('DELETE FROM sys_menus WHERE id = ?', [id]);
  }

  /**
   * 批量删除菜单
   */
  async batchDeleteMenus(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.deleteMenu(id);
    }
  }

  /**
   * 更新菜单顺序
   */
  async updateMenuOrder(items: { id: string; order: number }[]): Promise<void> {
    for (const item of items) {
      const menu = await this.getMenuById(item.id);
      if (!menu) {
        throw new Error(`菜单不存在: ${item.id}`);
      }
      this.assertManualMutationAllowed(menu);
      await pool.execute('UPDATE sys_menus SET sort_order = ? WHERE id = ?', [item.order, item.id]);
    }
  }

  /**
   * 切换可见性
   */
  async toggleVisibility(id: string): Promise<Menu> {
    const menu = await this.getMenuById(id);
    if (!menu) {
      throw new Error('菜单不存在');
    }
    this.assertManualMutationAllowed(menu);

    await pool.execute('UPDATE sys_menus SET visible = ? WHERE id = ?', [!menu.visible, id]);
    return this.getMenuById(id) as Promise<Menu>;
  }

  /**
   * 设置菜单可见性
   */
  async setMenuVisibility(id: string, visible: boolean): Promise<Menu> {
    const menu = await this.getMenuById(id);
    if (!menu) {
      throw new Error('菜单不存在');
    }
    this.assertManualMutationAllowed(menu);

    await pool.execute('UPDATE sys_menus SET visible = ? WHERE id = ?', [visible, id]);
    return this.getMenuById(id) as Promise<Menu>;
  }

  private isRegisteredModuleMenu(menu: Pick<Menu, 'moduleCode' | 'moduleSource'>): boolean {
    return isRegisteredModuleName(menu.moduleSource || menu.moduleCode);
  }

  private assertManualMutationAllowed(menu: Menu): void {
    if (this.isRegisteredModuleMenu(menu)) {
      const moduleKey = menu.moduleSource || menu.moduleCode;
      throw new Error(`模块注册菜单必须在 modules/${moduleKey}/module.json 中维护`);
    }
  }

  /**
   * 数据库行转菜单对象
   */
  private rowToMenu(row: any): Menu {
    const menuType = row.menu_type || 'internal';
    const openMode = row.open_mode || 'current';
    return {
      id: row.id,
      title: row.title,
      path: row.path,
      icon: row.icon,
      parentId: row.parent_id || undefined,
      sortOrder: row.sort_order,
      order: row.sort_order,
      visible: !!row.visible,
      permissionCode: row.permission_code,
      permission: row.permission_code,
      isSystem: !!row.is_system,
      menuType,
      externalUrl: row.external_url,
      openMode,
      moduleCode: row.module_code || row.module_name,
      moduleSource: row.module_name || row.module_code,
      external: menuType !== 'internal',
      target: openMode === 'blank' ? '_blank' : '_self',
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  /**
   * 测试辅助 - 清除所有非系统菜单
   */
  async clearAll(includeSystemMenus = false): Promise<void> {
    if (includeSystemMenus) {
      await pool.execute('DELETE FROM sys_role_menus');
      await pool.execute('DELETE FROM sys_menus');
      return;
    }

    await pool.execute(`
      DELETE rm
      FROM sys_role_menus rm
      INNER JOIN sys_menus m ON rm.menu_id = m.id
      WHERE m.is_system = FALSE
    `);
    await pool.execute('DELETE FROM sys_menus WHERE is_system = FALSE');
  }
}

export const menuService = new MenuService();
