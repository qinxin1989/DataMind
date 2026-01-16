/**
 * 菜单管理服务
 * 使用 MySQL 存储
 */

import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../core/database';
import { permissionService } from '../../services/permissionService';
import type { CreateMenuRequest, UpdateMenuRequest } from '../../types';

// 菜单类型定义
export interface Menu {
  id: string;
  title: string;
  path?: string;
  icon?: string;
  parentId?: string;
  sortOrder: number;
  order: number;  // 前端使用
  visible: boolean;
  permissionCode?: string;
  permission?: string;  // 前端使用
  isSystem: boolean;
  // 外部平台对接字段
  menuType: 'internal' | 'external' | 'iframe';  // internal=内部路由, external=外部链接, iframe=iframe嵌入
  externalUrl?: string;  // 外部链接地址
  openMode: 'current' | 'blank' | 'iframe';  // current=当前窗口, blank=新窗口, iframe=iframe
  moduleCode?: string;  // 模块代码，用于区分不同平台
  // 兼容字段
  external: boolean;
  target: string;
  createdAt: number;
  updatedAt: number;
  children?: Menu[];
}

export class MenuService {
  // ==================== 菜单查询 ====================

  async getAllMenus(): Promise<Menu[]> {
    const [rows] = await pool.execute('SELECT * FROM sys_menus ORDER BY sort_order ASC');
    return (rows as any[]).map(row => this.rowToMenu(row));
  }

  async getMenuTree(): Promise<Menu[]> {
    const menus = await this.getAllMenus();
    return this.buildTree(menus);
  }

  async getFullMenuTree(): Promise<Menu[]> {
    return this.getMenuTree();
  }

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
          m.path === '/dashboard' || 
          m.path?.startsWith('/ai/') ||
          m.title === 'AI服务' ||
          m.title === '仪表盘'
        )
      );
      return this.buildTree(basicMenus);
    }
    
    // 普通用户只返回有权限的菜单
    // 同时需要包含父菜单（即使父菜单不在权限列表中，也需要显示以保持树结构）
    const allowedMenuIdSet = new Set(allowedMenuIds);
    
    // 找出所有需要显示的菜单ID（包括父菜单）
    const menuMap = new Map(menus.map(m => [m.id, m]));
    const visibleMenuIds = new Set<string>();
    
    for (const menuId of allowedMenuIds) {
      // 添加当前菜单
      visibleMenuIds.add(menuId);
      // 添加所有父菜单
      let currentMenu = menuMap.get(menuId);
      while (currentMenu?.parentId) {
        visibleMenuIds.add(currentMenu.parentId);
        currentMenu = menuMap.get(currentMenu.parentId);
      }
    }
    
    // 过滤出有权限且可见的菜单
    const filteredMenus = menus.filter(m => m.visible && visibleMenuIds.has(m.id));
    return this.buildTree(filteredMenus);
  }

  private buildTree(menus: Menu[], parentId: string | null = null): Menu[] {
    return menus
      .filter(m => (m.parentId || null) === parentId)
      .map(m => ({
        ...m,
        children: this.buildTree(menus, m.id),
      }));
  }

  async getMenuById(id: string): Promise<Menu | null> {
    const [rows] = await pool.execute('SELECT * FROM sys_menus WHERE id = ?', [id]);
    const menus = rows as any[];
    if (menus.length === 0) return null;
    return this.rowToMenu(menus[0]);
  }

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
      order: row.sort_order,  // 前端使用 order
      visible: !!row.visible,
      permissionCode: row.permission_code,
      permission: row.permission_code,  // 前端使用 permission
      isSystem: !!row.is_system,
      // 外部平台对接字段
      menuType,
      externalUrl: row.external_url,
      openMode,
      moduleCode: row.module_code,
      // 兼容字段
      external: menuType !== 'internal',
      target: openMode === 'blank' ? '_blank' : '_self',
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  // ==================== 菜单 CRUD ====================

  async createMenu(data: CreateMenuRequest): Promise<Menu> {
    const id = uuidv4();

    await pool.execute(
      `INSERT INTO sys_menus (id, title, path, icon, parent_id, sort_order, visible, permission_code, is_system, menu_type, external_url, open_mode, module_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.title, data.path || null, data.icon || null, data.parentId || null,
       data.order || 0, data.visible !== false, data.permission || null, false,
       data.menuType || 'internal', data.externalUrl || null, data.openMode || 'current', data.moduleCode || null]
    );

    return this.getMenuById(id) as Promise<Menu>;
  }

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
    // 外部平台对接字段
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

  // ==================== 排序 ====================

  async updateSortOrder(items: { id: string; sortOrder: number }[]): Promise<void> {
    for (const item of items) {
      await pool.execute('UPDATE sys_menus SET sort_order = ? WHERE id = ?', [item.sortOrder, item.id]);
    }
  }

  async updateMenuOrder(items: { id: string; order: number }[]): Promise<void> {
    for (const item of items) {
      await pool.execute('UPDATE sys_menus SET sort_order = ? WHERE id = ?', [item.order, item.id]);
    }
  }

  // ==================== 可见性 ====================

  async toggleVisibility(id: string): Promise<Menu> {
    const menu = await this.getMenuById(id);
    if (!menu) {
      throw new Error('菜单不存在');
    }

    await pool.execute('UPDATE sys_menus SET visible = ? WHERE id = ?', [!menu.visible, id]);
    return this.getMenuById(id) as Promise<Menu>;
  }

  async setMenuVisibility(id: string, visible: boolean): Promise<Menu> {
    const menu = await this.getMenuById(id);
    if (!menu) {
      throw new Error('菜单不存在');
    }

    await pool.execute('UPDATE sys_menus SET visible = ? WHERE id = ?', [visible, id]);
    return this.getMenuById(id) as Promise<Menu>;
  }
}

export const menuService = new MenuService();
