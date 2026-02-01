/**
 * 用户管理服务
 * 使用 MySQL 存储
 */

import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../../core/database';
import type {
  UserDetail,
  UserQueryParams,
  CreateUserRequest,
  UpdateUserRequest,
  PaginatedResult,
  UserStatus,
} from '../../types';

const SALT_ROUNDS = 10;

export class UserService {
  // ==================== 密码验证 ====================

  validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // 长度检查
    if (password.length < 8) {
      errors.push('密码长度至少 8 位');
    }
    
    // 必须包含大写字母
    if (!/[A-Z]/.test(password)) {
      errors.push('密码必须包含至少一个大写字母');
    }
    
    // 必须包含小写字母
    if (!/[a-z]/.test(password)) {
      errors.push('密码必须包含至少一个小写字母');
    }
    
    // 必须包含数字
    if (!/[0-9]/.test(password)) {
      errors.push('密码必须包含至少一个数字');
    }
    
    return { valid: errors.length === 0, errors };
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // ==================== 用户查询 ====================

  async queryUsers(params: UserQueryParams): Promise<PaginatedResult<UserDetail>> {
    let whereClause = '1=1';
    const queryParams: any[] = [];

    if (params.keyword) {
      whereClause += ' AND (username LIKE ? OR email LIKE ? OR full_name LIKE ?)';
      const kw = `%${params.keyword}%`;
      queryParams.push(kw, kw, kw);
    }
    if (params.status) {
      whereClause += ' AND status = ?';
      queryParams.push(params.status);
    }
    if (params.role) {
      whereClause += ' AND role = ?';
      queryParams.push(params.role);
    }

    // 获取总数
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM sys_users WHERE ${whereClause}`,
      queryParams
    );
    const total = (countRows as any)[0].total;

    // 获取分页数据
    const offset = ((params.page || 1) - 1) * (params.pageSize || 10);
    const [rows] = await pool.query(
      `SELECT * FROM sys_users WHERE ${whereClause} ORDER BY created_at DESC LIMIT ${params.pageSize || 10} OFFSET ${offset}`,
      queryParams
    );

    const list = (rows as any[]).map(row => this.rowToUserDetail(row));

    return { list, total, page: params.page || 1, pageSize: params.pageSize || 10 };
  }

  private rowToUserDetail(row: any): UserDetail {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      fullName: row.full_name,
      phone: row.phone,
      department: row.department,
      role: row.role,
      status: row.status,
      roleIds: [],
      roles: [],
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at).getTime() : undefined,
      lastLoginIp: row.last_login_ip,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  // ==================== 用户 CRUD ====================

  async getUserById(id: string): Promise<UserDetail | null> {
    const [rows] = await pool.execute('SELECT * FROM sys_users WHERE id = ?', [id]);
    const users = rows as any[];
    if (users.length === 0) return null;
    return this.rowToUserDetail(users[0]);
  }

  async getUserByUsername(username: string): Promise<any | null> {
    const [rows] = await pool.execute('SELECT * FROM sys_users WHERE username = ?', [username]);
    const users = rows as any[];
    if (users.length === 0) return null;
    return users[0];
  }

  async createUser(data: CreateUserRequest): Promise<UserDetail> {
    // 检查用户名唯一性
    const existing = await this.getUserByUsername(data.username);
    if (existing) {
      throw new Error('用户名已存在');
    }

    // 验证密码
    const passwordCheck = this.validatePassword(data.password);
    if (!passwordCheck.valid) {
      throw new Error(`密码强度不足: ${passwordCheck.errors.join(', ')}`);
    }

    const id = uuidv4();
    const passwordHash = await this.hashPassword(data.password);

    await pool.execute(
      `INSERT INTO sys_users (id, username, password_hash, email, full_name, phone, department, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.username, passwordHash, data.email || null, data.fullName || null,
       data.phone || null, data.department || null, data.role || 'user', data.status || 'active']
    );

    return this.getUserById(id) as Promise<UserDetail>;
  }

  async updateUser(id: string, data: UpdateUserRequest): Promise<UserDetail> {
    const user = await this.getUserById(id);
    if (!user) {
      throw new Error('用户不存在');
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (data.email !== undefined) { updates.push('email = ?'); values.push(data.email); }
    if (data.fullName !== undefined) { updates.push('full_name = ?'); values.push(data.fullName); }
    if (data.phone !== undefined) { updates.push('phone = ?'); values.push(data.phone); }
    if (data.department !== undefined) { updates.push('department = ?'); values.push(data.department); }
    if (data.role !== undefined) { updates.push('role = ?'); values.push(data.role); }
    if (data.status !== undefined) { updates.push('status = ?'); values.push(data.status); }

    if (updates.length > 0) {
      values.push(id);
      await pool.execute(`UPDATE sys_users SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    return this.getUserById(id) as Promise<UserDetail>;
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.getUserById(id);
    if (!user) {
      throw new Error('用户不存在');
    }
    await pool.execute('DELETE FROM sys_users WHERE id = ?', [id]);
    await pool.execute('DELETE FROM sys_user_roles WHERE user_id = ?', [id]);
  }

  // ==================== 状态管理 ====================

  async updateStatus(id: string, status: UserStatus): Promise<UserDetail> {
    await pool.execute('UPDATE sys_users SET status = ? WHERE id = ?', [status, id]);
    return this.getUserById(id) as Promise<UserDetail>;
  }

  async batchUpdateStatus(ids: string[], status: UserStatus): Promise<number> {
    if (ids.length === 0) return 0;
    const placeholders = ids.map(() => '?').join(',');
    const [result] = await pool.execute(
      `UPDATE sys_users SET status = ? WHERE id IN (${placeholders})`,
      [status, ...ids]
    );
    return (result as any).affectedRows;
  }

  async batchDelete(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const placeholders = ids.map(() => '?').join(',');
    const [result] = await pool.execute(
      `DELETE FROM sys_users WHERE id IN (${placeholders})`,
      ids
    );
    return (result as any).affectedRows;
  }

  // ==================== 密码管理 ====================

  async resetPassword(id: string): Promise<string> {
    const user = await this.getUserById(id);
    if (!user) {
      throw new Error('用户不存在');
    }

    const newPassword = this.generateRandomPassword();
    const passwordHash = await this.hashPassword(newPassword);
    await pool.execute('UPDATE sys_users SET password_hash = ? WHERE id = ?', [passwordHash, id]);

    return newPassword;
  }

  private generateRandomPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  // ==================== 登录记录 ====================

  async recordLogin(id: string, ip: string): Promise<void> {
    await pool.execute(
      'UPDATE sys_users SET last_login_at = NOW(), last_login_ip = ? WHERE id = ?',
      [ip, id]
    );
  }

  // ==================== 测试辅助 ====================

  async clearAll(): Promise<void> {
    await pool.execute('DELETE FROM sys_users');
    await pool.execute('DELETE FROM sys_user_roles');
  }
}

export const userService = new UserService();
