/**
 * 菜单管理器
 * 负责管理模块的菜单注册和显示
 */

import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../../admin/core/database';
import type { MenuConfig } from '../types';

/**
 * 菜单项接口
 */
export interface MenuItem {
  id: string;
  title: string;
  path: string;
  icon?: string;
  parentId?: string;
  sortOrder: number;
  permission?: string;
  moduleName: string;
  visible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 菜单管理器类
 */
export class MenuManager {
  /**
   * 注册模块菜单
   */
  async registerMenus(moduleName: string, menus: MenuConfig[]): Promise<void> {
    if (!menus || menus.length === 0) {
      return;
    }

    try {
      await transaction(async (conn) => {
        for (const menu of menus) {
          // 检查菜单是否已存在
          const existing = await query(
            'SELECT id FROM sys_menus WHERE id = ? AND module_name = ?',
            [menu.id, moduleName],
            conn
          );

          if (existing.length > 0) {
            // 更新现有菜单
            await query(
              `UPDATE sys_menus 
               SET title = ?, path = ?, icon = ?, parent_id = ?, 
                   sort_order = ?, permission = ?, visible = TRUE, 
                   updated_at = NOW()
               WHERE id = ? AND module_name = ?`,
              [
                menu.title,
                menu.path,
                menu.icon || null,
                menu.parentId || null,
                menu.sortOrder,
                menu.permission || null,
                menu.id,
                moduleName
              ],
              conn
            );
          } else {
            // 插入新菜单
            await query(
              `INSERT INTO sys_menus 
               (id, title, path, icon, parent_id, sort_order, permission, 
                module_name, visible, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW(), NOW())`,
              [
                menu.id,
                menu.title,
                menu.path,
                menu.icon || null,
                menu.parentId || null,
                menu.sortOrder,
                menu.permission || null,
                moduleName
              ],
              conn
            );
          }
        }
      });

      console.log(`Menus registered for module ${moduleName}`);
    } catch (error) {
      throw new Error(`Failed to register menus for module ${moduleName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 注销模块菜单
   */
  async unregisterMenus(moduleName: string): Promise<void> {
    try {
      await query(
        'DELETE FROM sys_menus WHERE module_name = ?',
        [moduleName]
      );

      console.log(`Menus unregistered for module ${moduleName}`);
    } catch (error) {
      throw new Error(`Failed to unregister menus for module ${moduleName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取用户可见菜单
   */
  async getUserMenus(userId: string): Promise<MenuItem[]> {
    try {
      // 获取用户角色
      const roles = await query(
        `SELECT r.id FROM sys_roles r
         INNER JOIN sys_user_roles ur ON r.id = ur.role_id
         WHERE ur.user_id = ?`,
        [userId]
      );

      if (roles.length === 0) {
        return [];
      }

      const roleIds = roles.map((r: any) => r.id);

      // 获取角色权限
      const permissions = await query(
        `SELECT DISTINCT p.code FROM sys_permissions p
         INNER JOIN sys_role_permissions rp ON p.id = rp.permission_id
         WHERE rp.role_id IN (?)`,
        [roleIds]
      );

      const permissionCodes = permissions.map((p: any) => p.code);

      // 获取可见菜单
      const menus = await query(
        `SELECT * FROM sys_menus 
         WHERE visible = TRUE 
         AND (permission IS NULL OR permission IN (?))
         ORDER BY sort_order ASC`,
        [permissionCodes.length > 0 ? permissionCodes : ['']]
      );

      return menus.map((menu: any) => ({
        id: menu.id,
        title: menu.title,
        path: menu.path,
        icon: menu.icon,
        parentId: menu.parent_id,
        sortOrder: menu.sort_order,
        permission: menu.permission,
        moduleName: menu.module_name,
        visible: menu.visible,
        createdAt: menu.created_at,
        updatedAt: menu.updated_at
      }));
    } catch (error) {
      throw new Error(`Failed to get user menus: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 更新菜单状态
   */
  async updateMenuStatus(menuId: string, visible: boolean): Promise<void> {
    try {
      await query(
        'UPDATE sys_menus SET visible = ?, updated_at = NOW() WHERE id = ?',
        [visible, menuId]
      );

      console.log(`Menu ${menuId} visibility updated to ${visible}`);
    } catch (error) {
      throw new Error(`Failed to update menu status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取模块菜单
   */
  async getModuleMenus(moduleName: string): Promise<MenuItem[]> {
    try {
      const menus = await query(
        'SELECT * FROM sys_menus WHERE module_name = ? ORDER BY sort_order ASC',
        [moduleName]
      );

      return menus.map((menu: any) => ({
        id: menu.id,
        title: menu.title,
        path: menu.path,
        icon: menu.icon,
        parentId: menu.parent_id,
        sortOrder: menu.sort_order,
        permission: menu.permission,
        moduleName: menu.module_name,
        visible: menu.visible,
        createdAt: menu.created_at,
        updatedAt: menu.updated_at
      }));
    } catch (error) {
      throw new Error(`Failed to get module menus: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 隐藏模块菜单
   */
  async hideModuleMenus(moduleName: string): Promise<void> {
    try {
      await query(
        'UPDATE sys_menus SET visible = FALSE, updated_at = NOW() WHERE module_name = ?',
        [moduleName]
      );

      console.log(`Menus hidden for module ${moduleName}`);
    } catch (error) {
      throw new Error(`Failed to hide module menus: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 显示模块菜单
   */
  async showModuleMenus(moduleName: string): Promise<void> {
    try {
      await query(
        'UPDATE sys_menus SET visible = TRUE, updated_at = NOW() WHERE module_name = ?',
        [moduleName]
      );

      console.log(`Menus shown for module ${moduleName}`);
    } catch (error) {
      throw new Error(`Failed to show module menus: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// 导出单例实例
export const menuManager = new MenuManager();
