/**
 * 权限服务
 * 使用 MySQL 存储
 */

import { v4 as uuidv4 } from 'uuid';
import { pool } from '../core/database';
import type { Role, CreateRoleRequest, UpdateRoleRequest, PaginatedResult } from '../types';

export class PermissionService {
  // ==================== 角色管理 ====================

  async getAllRoles(): Promise<Role[]> {
    const [rows] = await pool.execute('SELECT * FROM sys_roles ORDER BY created_at DESC');
    const roles = (rows as any[]).map(row => this.rowToRole(row));
    
    // 获取每个角色的权限和菜单
    for (const role of roles) {
      role.permissionCodes = await this.getRolePermissions(role.id);
      role.menuIds = await this.getRoleMenus(role.id);
    }
    
    return roles;
  }

  async getRoleById(id: string): Promise<Role | null> {
    const [rows] = await pool.execute('SELECT * FROM sys_roles WHERE id = ?', [id]);
    const roles = rows as any[];
    if (roles.length === 0) return null;
    
    const role = this.rowToRole(roles[0]);
    role.permissionCodes = await this.getRolePermissions(id);
    role.menuIds = await this.getRoleMenus(id);
    return role;
  }

  async getRoleByCode(code: string): Promise<Role | null> {
    const [rows] = await pool.execute('SELECT * FROM sys_roles WHERE code = ?', [code]);
    const roles = rows as any[];
    if (roles.length === 0) return null;
    
    const role = this.rowToRole(roles[0]);
    role.permissionCodes = await this.getRolePermissions(role.id);
    role.menuIds = await this.getRoleMenus(role.id);
    return role;
  }

  private rowToRole(row: any): Role {
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      description: row.description,
      parentId: row.parent_id,
      status: row.status,
      isSystem: row.is_system,
      permissionCodes: [],
      menuIds: [],
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  async createRole(data: CreateRoleRequest): Promise<Role> {
    // 检查 code 唯一性
    const existing = await this.getRoleByCode(data.code);
    if (existing) {
      throw new Error('角色代码已存在');
    }

    const id = uuidv4();

    await pool.execute(
      `INSERT INTO sys_roles (id, name, code, description, parent_id, status, is_system)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.code, data.description || null, data.parentId || null, 
       data.status || 'active', false]
    );

    // 添加权限
    if (data.permissionCodes && data.permissionCodes.length > 0) {
      await this.setRolePermissions(id, data.permissionCodes);
    }

    // 添加菜单
    if (data.menuIds && data.menuIds.length > 0) {
      await this.setRoleMenus(id, data.menuIds);
    }

    return this.getRoleById(id) as Promise<Role>;
  }

  async updateRole(id: string, data: UpdateRoleRequest): Promise<Role> {
    const role = await this.getRoleById(id);
    if (!role) {
      throw new Error('角色不存在');
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description); }
    if (data.parentId !== undefined) { updates.push('parent_id = ?'); values.push(data.parentId); }
    if (data.status !== undefined) { updates.push('status = ?'); values.push(data.status); }

    if (updates.length > 0) {
      values.push(id);
      await pool.execute(`UPDATE sys_roles SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    // 更新权限
    if (data.permissionCodes !== undefined) {
      await this.setRolePermissions(id, data.permissionCodes);
    }

    // 更新菜单
    if (data.menuIds !== undefined) {
      await this.setRoleMenus(id, data.menuIds);
    }

    return this.getRoleById(id) as Promise<Role>;
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.getRoleById(id);
    if (!role) {
      throw new Error('角色不存在');
    }
    if (role.isSystem) {
      throw new Error('系统角色不能删除');
    }

    await pool.execute('DELETE FROM sys_role_permissions WHERE role_id = ?', [id]);
    await pool.execute('DELETE FROM sys_user_roles WHERE role_id = ?', [id]);
    await pool.execute('DELETE FROM sys_roles WHERE id = ?', [id]);
  }

  // ==================== 角色权限 ====================

  async getRolePermissions(roleId: string): Promise<string[]> {
    const [rows] = await pool.execute(
      'SELECT permission_code FROM sys_role_permissions WHERE role_id = ?',
      [roleId]
    );
    return (rows as any[]).map(row => row.permission_code);
  }

  async setRolePermissions(roleId: string, permissions: string[]): Promise<void> {
    // 删除旧权限
    await pool.execute('DELETE FROM sys_role_permissions WHERE role_id = ?', [roleId]);
    
    // 添加新权限
    for (const perm of permissions) {
      await pool.execute(
        'INSERT INTO sys_role_permissions (role_id, permission_code) VALUES (?, ?)',
        [roleId, perm]
      );
    }
  }

  // ==================== 角色菜单 ====================

  async getRoleMenus(roleId: string): Promise<string[]> {
    const [rows] = await pool.execute(
      'SELECT menu_id FROM sys_role_menus WHERE role_id = ?',
      [roleId]
    );
    return (rows as any[]).map(row => row.menu_id);
  }

  async setRoleMenus(roleId: string, menuIds: string[]): Promise<void> {
    // 删除旧菜单关联
    await pool.execute('DELETE FROM sys_role_menus WHERE role_id = ?', [roleId]);
    
    // 添加新菜单关联
    for (const menuId of menuIds) {
      await pool.execute(
        'INSERT INTO sys_role_menus (role_id, menu_id) VALUES (?, ?)',
        [roleId, menuId]
      );
    }
  }

  // ==================== 用户角色 ====================

  async getUserRoles(userId: string): Promise<Role[]> {
    const [rows] = await pool.execute(
      `SELECT r.* FROM sys_roles r
       INNER JOIN sys_user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = ?`,
      [userId]
    );
    
    const roles = (rows as any[]).map(row => this.rowToRole(row));
    for (const role of roles) {
      role.permissionCodes = await this.getRolePermissions(role.id);
      role.menuIds = await this.getRoleMenus(role.id);
    }
    return roles;
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const roles = await this.getUserRoles(userId);
    const permissions = new Set<string>();
    
    for (const role of roles) {
      for (const perm of role.permissionCodes) {
        permissions.add(perm);
      }
    }
    
    return Array.from(permissions);
  }

  async getUserMenuIds(userId: string): Promise<string[]> {
    const roles = await this.getUserRoles(userId);
    const menuIds = new Set<string>();
    
    for (const role of roles) {
      for (const menuId of role.menuIds || []) {
        menuIds.add(menuId);
      }
    }
    
    return Array.from(menuIds);
  }

  async assignRolesToUser(userId: string, roleIds: string[]): Promise<void> {
    // 删除旧角色
    await pool.execute('DELETE FROM sys_user_roles WHERE user_id = ?', [userId]);
    
    // 添加新角色
    for (const roleId of roleIds) {
      await pool.execute(
        'INSERT INTO sys_user_roles (user_id, role_id) VALUES (?, ?)',
        [userId, roleId]
      );
    }
  }

  // ==================== 权限检查 ====================

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    // 先检查 sys_user_roles 表
    const permissions = await this.getUserPermissions(userId);
    
    // 超级管理员权限
    if (permissions.includes('*')) {
      return true;
    }
    
    if (permissions.includes(permission)) {
      return true;
    }

    // 检查 sys_users 表的 role 字段
    const [rows] = await pool.execute('SELECT role FROM sys_users WHERE id = ?', [userId]);
    const user = (rows as any[])[0];
    if (user) {
      // admin 角色拥有所有权限
      if (user.role === 'admin') {
        return true;
      }
      // user 角色拥有基本查看权限
      if (user.role === 'user' && permission.endsWith(':view')) {
        return true;
      }
    }

    return false;
  }

  async hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    const userPerms = await this.getUserPermissions(userId);
    
    if (userPerms.includes('*')) {
      return true;
    }
    
    if (permissions.some(p => userPerms.includes(p))) {
      return true;
    }

    // 检查 sys_users 表的 role 字段
    const [rows] = await pool.execute('SELECT role FROM sys_users WHERE id = ?', [userId]);
    const user = (rows as any[])[0];
    if (user && user.role === 'admin') {
      return true;
    }

    return false;
  }

  async hasAllPermissions(userId: string, permissions: string[]): Promise<boolean> {
    const userPerms = await this.getUserPermissions(userId);
    
    if (userPerms.includes('*')) {
      return true;
    }
    
    if (permissions.every(p => userPerms.includes(p))) {
      return true;
    }

    // 检查 sys_users 表的 role 字段
    const [rows] = await pool.execute('SELECT role FROM sys_users WHERE id = ?', [userId]);
    const user = (rows as any[])[0];
    if (user && user.role === 'admin') {
      return true;
    }

    return false;
  }
}

export const permissionService = new PermissionService();
