/**
 * 权限管理器
 * 负责管理模块的权限注册和检查
 */

import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../../admin/core/database';
import type { PermissionConfig } from '../types';

/**
 * 权限项接口
 */
export interface Permission {
  id: string;
  code: string;
  name: string;
  description: string;
  category?: string;
  moduleName: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 权限管理器类
 */
export class PermissionManager {
  /**
   * 注册模块权限
   */
  async registerPermissions(moduleName: string, permissions: PermissionConfig[]): Promise<void> {
    if (!permissions || permissions.length === 0) {
      return;
    }

    try {
      await transaction(async (conn) => {
        for (const perm of permissions) {
          // 检查权限是否已存在
          const existing = await query(
            'SELECT id FROM sys_permissions WHERE code = ?',
            [perm.code],
            conn
          );

          if (existing.length > 0) {
            // 更新现有权限
            await query(
              `UPDATE sys_permissions 
               SET name = ?, description = ?, category = ?, 
                   module_name = ?, updated_at = NOW()
               WHERE code = ?`,
              [
                perm.name,
                perm.description,
                perm.category || null,
                moduleName,
                perm.code
              ],
              conn
            );
          } else {
            // 插入新权限
            await query(
              `INSERT INTO sys_permissions 
               (id, code, name, description, category, module_name, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
              [
                uuidv4(),
                perm.code,
                perm.name,
                perm.description,
                perm.category || null,
                moduleName
              ],
              conn
            );
          }
        }
      });

      console.log(`Permissions registered for module ${moduleName}`);
    } catch (error) {
      throw new Error(`Failed to register permissions for module ${moduleName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 注销模块权限
   */
  async unregisterPermissions(moduleName: string): Promise<void> {
    try {
      await transaction(async (conn) => {
        // 获取模块权限ID
        const permissions = await query(
          'SELECT id FROM sys_permissions WHERE module_name = ?',
          [moduleName],
          conn
        );

        if (permissions.length === 0) {
          return;
        }

        const permissionIds = permissions.map((p: any) => p.id);

        // 删除角色权限关联
        await query(
          'DELETE FROM sys_role_permissions WHERE permission_id IN (?)',
          [permissionIds],
          conn
        );

        // 删除权限
        await query(
          'DELETE FROM sys_permissions WHERE module_name = ?',
          [moduleName],
          conn
        );
      });

      console.log(`Permissions unregistered for module ${moduleName}`);
    } catch (error) {
      throw new Error(`Failed to unregister permissions for module ${moduleName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 检查用户权限
   */
  async checkPermission(userId: string, permissionCode: string): Promise<boolean> {
    try {
      const result = await query(
        `SELECT COUNT(*) as count FROM sys_permissions p
         INNER JOIN sys_role_permissions rp ON p.id = rp.permission_id
         INNER JOIN sys_user_roles ur ON rp.role_id = ur.role_id
         WHERE ur.user_id = ? AND p.code = ?`,
        [userId, permissionCode]
      );

      return result[0].count > 0;
    } catch (error) {
      throw new Error(`Failed to check permission: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取用户所有权限
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    try {
      const permissions = await query(
        `SELECT DISTINCT p.code FROM sys_permissions p
         INNER JOIN sys_role_permissions rp ON p.id = rp.permission_id
         INNER JOIN sys_user_roles ur ON rp.role_id = ur.role_id
         WHERE ur.user_id = ?`,
        [userId]
      );

      return permissions.map((p: any) => p.code);
    } catch (error) {
      throw new Error(`Failed to get user permissions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取模块权限
   */
  async getModulePermissions(moduleName: string): Promise<Permission[]> {
    try {
      const permissions = await query(
        'SELECT * FROM sys_permissions WHERE module_name = ?',
        [moduleName]
      );

      return permissions.map((perm: any) => ({
        id: perm.id,
        code: perm.code,
        name: perm.name,
        description: perm.description,
        category: perm.category,
        moduleName: perm.module_name,
        createdAt: perm.created_at,
        updatedAt: perm.updated_at
      }));
    } catch (error) {
      throw new Error(`Failed to get module permissions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// 导出单例实例
export const permissionManager = new PermissionManager();
