/**
 * 角色管理服务
 */

import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../../src/admin/core/database';
import type { Role, CreateRoleRequest, UpdateRoleRequest, RoleQueryParams, PaginatedResult } from './types';

export class RoleService {
  /**
   * 获取所有角色
   */
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

  /**
   * 分页查询角色
   */
  async queryRoles(params: RoleQueryParams): Promise<PaginatedResult<Role>> {
    const { keyword, status, page = 1, pageSize = 10 } = params;
    const offset = (page - 1) * pageSize;

    let whereClause = '';
    const whereParams: any[] = [];

    if (keyword) {
      whereClause += ' AND (name LIKE ? OR code LIKE ? OR description LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      whereParams.push(likeKeyword, likeKeyword, likeKeyword);
    }

    if (status) {
      whereClause += ' AND status = ?';
      whereParams.push(status);
    }

    // 获取总数
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM sys_roles WHERE 1=1${whereClause}`,
      whereParams
    );
    const total = (countRows as any[])[0].total;

    // 获取数据 - 使用字符串拼接而不是参数绑定来避免 MySQL 参数类型问题
    const [rows] = await pool.execute(
      `SELECT * FROM sys_roles WHERE 1=1${whereClause} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}`,
      whereParams
    );

    const roles = (rows as any[]).map(row => this.rowToRole(row));
    
    // 获取每个角色的权限和菜单
    for (const role of roles) {
      role.permissionCodes = await this.getRolePermissions(role.id);
      role.menuIds = await this.getRoleMenus(role.id);
    }

    return {
      items: roles,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 根据ID获取角色
   */
  async getRoleById(id: string): Promise<Role | null> {
    const [rows] = await pool.execute('SELECT * FROM sys_roles WHERE id = ?', [id]);
    const roles = rows as any[];
    if (roles.length === 0) return null;
    
    const role = this.rowToRole(roles[0]);
    role.permissionCodes = await this.getRolePermissions(id);
    role.menuIds = await this.getRoleMenus(id);
    return role;
  }

  /**
   * 根据编码获取角色
   */
  async getRoleByCode(code: string): Promise<Role | null> {
    const [rows] = await pool.execute('SELECT * FROM sys_roles WHERE code = ?', [code]);
    const roles = rows as any[];
    if (roles.length === 0) return null;
    
    const role = this.rowToRole(roles[0]);
    role.permissionCodes = await this.getRolePermissions(role.id);
    role.menuIds = await this.getRoleMenus(role.id);
    return role;
  }

  /**
   * 创建角色
   */
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

  /**
   * 更新角色
   */
  async updateRole(id: string, data: UpdateRoleRequest): Promise<Role> {
    const role = await this.getRoleById(id);
    if (!role) {
      throw new Error('角色不存在');
    }

    if (role.isSystem && data.status === 'inactive') {
      throw new Error('系统角色不能禁用');
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

  /**
   * 删除角色
   */
  async deleteRole(id: string): Promise<void> {
    const role = await this.getRoleById(id);
    if (!role) {
      throw new Error('角色不存在');
    }
    if (role.isSystem) {
      throw new Error('系统角色不能删除');
    }

    // 检查是否有用户使用该角色
    const [userRows] = await pool.execute(
      'SELECT COUNT(*) as count FROM sys_user_roles WHERE role_id = ?',
      [id]
    );
    const userCount = (userRows as any[])[0].count;
    if (userCount > 0) {
      throw new Error(`该角色正在被 ${userCount} 个用户使用，无法删除`);
    }

    await pool.execute('DELETE FROM sys_role_permissions WHERE role_id = ?', [id]);
    await pool.execute('DELETE FROM sys_role_menus WHERE role_id = ?', [id]);
    await pool.execute('DELETE FROM sys_user_roles WHERE role_id = ?', [id]);
    await pool.execute('DELETE FROM sys_roles WHERE id = ?', [id]);
  }

  /**
   * 批量删除角色
   */
  async batchDeleteRoles(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.deleteRole(id);
    }
  }

  /**
   * 获取角色权限
   */
  async getRolePermissions(roleId: string): Promise<string[]> {
    const [rows] = await pool.execute(
      'SELECT permission_code FROM sys_role_permissions WHERE role_id = ? ORDER BY permission_code',
      [roleId]
    );
    return (rows as any[]).map(row => row.permission_code);
  }

  /**
   * 设置角色权限
   */
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

  /**
   * 获取角色菜单
   */
  async getRoleMenus(roleId: string): Promise<string[]> {
    const [rows] = await pool.execute(
      'SELECT menu_id FROM sys_role_menus WHERE role_id = ?',
      [roleId]
    );
    return (rows as any[]).map(row => row.menu_id);
  }

  /**
   * 设置角色菜单
   */
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

  /**
   * 获取用户角色
   */
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

  /**
   * 分配角色给用户
   */
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

  /**
   * 数据库行转角色对象
   */
  private rowToRole(row: any): Role {
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      description: row.description,
      parentId: row.parent_id,
      status: row.status,
      isSystem: Boolean(row.is_system),
      permissionCodes: [],
      menuIds: [],
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }
}

export const roleService = new RoleService();
