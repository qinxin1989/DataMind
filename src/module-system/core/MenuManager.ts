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
    const declaredMenus = menus || [];

    try {
      await transaction(async (conn) => {
        if (declaredMenus.length === 0) {
          await query(
            'DELETE FROM sys_menus WHERE module_name = ?',
            [moduleName],
            conn
          );
          return;
        }

        const declaredMenuIds = declaredMenus.map(menu => menu.id);
        const placeholders = declaredMenuIds.map(() => '?').join(', ');

        // 模块菜单以当前 manifest 为准，先清理已从 module.json 移除的旧菜单
        await query(
          `DELETE FROM sys_menus
           WHERE module_name = ?
             AND id NOT IN (${placeholders})`,
          [moduleName, ...declaredMenuIds],
          conn
        );

        for (const menu of declaredMenus) {
          // 检查菜单是否已存在
          const existing = await query(
            'SELECT id, module_name FROM sys_menus WHERE id = ?',
            [menu.id],
            conn
          );

          if (existing.length === 0) {
            // 菜单不存在，插入新菜单
            await query(
              `INSERT INTO sys_menus 
               (id, title, path, icon, parent_id, sort_order, permission_code, 
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
          } else {
            const existingMenu = existing[0] as { id: string; module_name?: string | null };
            const currentModuleName = existingMenu.module_name || null;

            if (currentModuleName && currentModuleName !== moduleName) {
              console.warn(
                `菜单 ${menu.id} 已归属模块 ${currentModuleName}，跳过模块 ${moduleName} 的覆盖注册`
              );
              continue;
            }

            // 模块菜单以 module.json 为准，启动时自动纠正历史脏数据
            await query(
              `UPDATE sys_menus
               SET title = ?,
                   path = ?,
                   icon = ?,
                   parent_id = ?,
                   sort_order = ?,
                   permission_code = ?,
                   module_name = ?,
                   updated_at = NOW()
               WHERE id = ?`,
              [
                menu.title,
                menu.path,
                menu.icon || null,
                menu.parentId || null,
                menu.sortOrder,
                menu.permission || null,
                moduleName,
                menu.id
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
        permission: menu.permission_code,
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
