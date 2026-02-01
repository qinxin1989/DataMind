/**
 * 菜单管理服务
 */

import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../../src/admin/core/database';
import type { Menu, CreateMenuRequest, UpdateMenuRequest } from './types';

export class MenuService {
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
    // 这里需要集成权限服务,暂时返回所有可见菜单
    const menus = await this.getAllMenus();
    const visibleMenus = menus.filter(m => m.visible);
    return this.buildTree(visibleMenus);
  }

  /**
   * 构建树形结构
   */
  private buildTree(menus: Menu[], parentId: string | null = null): Menu[] {
    return menus
      .filter(m => (m.parentId || null) === parentId)
      .map(m => ({
        ...m,
        children: this.buildTree(menus, m.id),
      }));
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
   * 创建菜单
   */
  async createMenu(data: CreateMenuRequest): Promise<Menu> {
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
    if (menu.isSystem) {
      throw new Error('系统菜单不能删除');
    }

    // 删除子菜单
    await pool.execute('DELETE FROM sys_menus WHERE parent_id = ?', [id]);
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
   * 更新排序
   */
  async updateSortOrder(items: { id: string; sortOrder: number }[]): Promise<void> {
    for (const item of items) {
      await pool.execute('UPDATE sys_menus SET sort_order = ? WHERE id = ?', [item.sortOrder, item.id]);
    }
  }

  /**
   * 更新菜单顺序
   */
  async updateMenuOrder(items: { id: string; order: number }[]): Promise<void> {
    for (const item of items) {
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

    await pool.execute('UPDATE sys_menus SET visible = ? WHERE id = ?', [visible, id]);
    return this.getMenuById(id) as Promise<Menu>;
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
      moduleCode: row.module_code,
      external: menuType !== 'internal',
      target: openMode === 'blank' ? '_blank' : '_self',
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  /**
   * 测试辅助 - 清除所有非系统菜单
   */
  async clearAll(): Promise<void> {
    await pool.execute('DELETE FROM sys_menus WHERE is_system = FALSE');
  }
}

export const menuService = new MenuService();
