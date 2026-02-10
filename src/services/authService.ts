import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import mysql from 'mysql2/promise';
import { User, UserRole, UserStatus } from '../types';

export interface AuthServiceConfig {
  pool: mysql.Pool;
  jwtSecret: string;
  jwtExpiresIn?: string;
}

export class AuthService {
  private pool: mysql.Pool;
  private jwtSecret: string;
  private jwtExpiresIn: string;

  constructor(config: AuthServiceConfig) {
    this.pool = config.pool;
    this.jwtSecret = config.jwtSecret;
    this.jwtExpiresIn = config.jwtExpiresIn || '7d';
  }

  /**
   * 注册新用户（默认待审核状态）
   */
  async register(
    username: string,
    password: string,
    email?: string,
    fullName?: string
  ): Promise<{ user: User; message: string }> {
    if (!username || username.length < 3) {
      throw new Error('用户名至少需要3个字符');
    }

    if (!password || password.length < 8) {
      throw new Error('密码至少需要8个字符');
    }
    if (!/[A-Z]/.test(password)) {
      throw new Error('密码必须包含至少一个大写字母');
    }
    if (!/[a-z]/.test(password)) {
      throw new Error('密码必须包含至少一个小写字母');
    }
    if (!/[0-9]/.test(password)) {
      throw new Error('密码必须包含至少一个数字');
    }

    const [existing] = await this.pool.execute(
      'SELECT id FROM sys_users WHERE username = ?',
      [username]
    );

    if ((existing as any[]).length > 0) {
      throw new Error('用户名已存在');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await this.pool.execute(
      `INSERT INTO sys_users (id, username, password_hash, email, full_name, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, username, hashedPassword, email || null, fullName || null, 'user', 'pending']
    );

    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('用户创建失败');
    }

    return { user, message: '注册成功，请等待管理员审核' };
  }

  /**
   * 管理员创建用户（直接激活）
   */
  async createUser(
    username: string,
    password: string,
    role: UserRole = 'user',
    email?: string,
    fullName?: string
  ): Promise<User> {
    if (!username || username.length < 3) {
      throw new Error('用户名至少需要3个字符');
    }

    if (!password || password.length < 8) {
      throw new Error('密码至少需要8个字符');
    }
    if (!/[A-Z]/.test(password)) {
      throw new Error('密码必须包含至少一个大写字母');
    }
    if (!/[a-z]/.test(password)) {
      throw new Error('密码必须包含至少一个小写字母');
    }
    if (!/[0-9]/.test(password)) {
      throw new Error('密码必须包含至少一个数字');
    }

    const [existing] = await this.pool.execute(
      'SELECT id FROM sys_users WHERE username = ?',
      [username]
    );

    if ((existing as any[]).length > 0) {
      throw new Error('用户名已存在');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await this.pool.execute(
      `INSERT INTO sys_users (id, username, password_hash, email, full_name, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, username, hashedPassword, email || null, fullName || null, role, 'active']
    );

    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('用户创建失败');
    }

    return user;
  }

  /**
   * 登录
   */
  async login(username: string, password: string): Promise<{ user: User; token: string }> {
    const [rows] = await this.pool.execute(
      'SELECT * FROM sys_users WHERE username = ?',
      [username]
    );

    const userRow = (rows as any[])[0];
    if (!userRow) {
      throw new Error('用户名或密码错误');
    }

    if (userRow.status !== 'active') {
      throw new Error('用户已被禁用');
    }

    const passwordMatch = await bcrypt.compare(password, userRow.password_hash);
    if (!passwordMatch) {
      throw new Error('用户名或密码错误');
    }

    const user: User = {
      id: userRow.id,
      username: userRow.username,
      email: userRow.email,
      fullName: userRow.full_name,
      role: userRow.role,
      status: userRow.status,
      createdAt: new Date(userRow.created_at).getTime(),
      updatedAt: new Date(userRow.updated_at).getTime()
    };

    // 更新最后登录时间
    await this.pool.execute(
      'UPDATE sys_users SET last_login_at = NOW() WHERE id = ?',
      [userRow.id]
    );

    const token = this.generateToken(user);
    return { user, token };
  }

  /**
   * 验证token
   */
  verifyToken(token: string): User {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      return {
        id: decoded.id,
        username: decoded.username,
        email: decoded.email,
        fullName: decoded.fullName,
        role: decoded.role,
        status: decoded.status,
        createdAt: decoded.createdAt,
        updatedAt: decoded.updatedAt
      };
    } catch (error) {
      throw new Error('无效的token');
    }
  }

  private generateToken(user: User): string {
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
    
    return jwt.sign(payload, this.jwtSecret as string, { expiresIn: this.jwtExpiresIn } as any);
  }

  async getUserById(id: string): Promise<User | null> {
    const [rows] = await this.pool.execute(
      'SELECT * FROM sys_users WHERE id = ?',
      [id]
    );

    const userRow = (rows as any[])[0];
    if (!userRow) return null;

    return {
      id: userRow.id,
      username: userRow.username,
      email: userRow.email,
      fullName: userRow.full_name,
      role: userRow.role,
      status: userRow.status,
      createdAt: new Date(userRow.created_at).getTime(),
      updatedAt: new Date(userRow.updated_at).getTime()
    };
  }

  async updateUser(
    id: string,
    updates: Partial<{ email: string; fullName: string; role: UserRole; status: UserStatus }>
  ): Promise<User> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.email !== undefined) {
      fields.push('email = ?');
      values.push(updates.email);
    }
    if (updates.fullName !== undefined) {
      fields.push('full_name = ?');
      values.push(updates.fullName);
    }
    if (updates.role !== undefined) {
      fields.push('role = ?');
      values.push(updates.role);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }

    if (fields.length === 0) {
      const user = await this.getUserById(id);
      if (!user) throw new Error('用户不存在');
      return user;
    }

    values.push(id);

    await this.pool.execute(
      `UPDATE sys_users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    const user = await this.getUserById(id);
    if (!user) throw new Error('用户更新失败');
    return user;
  }

  async changePassword(id: string, oldPassword: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 8) {
      throw new Error('新密码至少需要8个字符');
    }
    if (!/[A-Z]/.test(newPassword)) {
      throw new Error('密码必须包含至少一个大写字母');
    }
    if (!/[a-z]/.test(newPassword)) {
      throw new Error('密码必须包含至少一个小写字母');
    }
    if (!/[0-9]/.test(newPassword)) {
      throw new Error('密码必须包含至少一个数字');
    }

    const [rows] = await this.pool.execute(
      'SELECT password_hash FROM sys_users WHERE id = ?',
      [id]
    );

    const userRow = (rows as any[])[0];
    if (!userRow) throw new Error('用户不存在');

    const passwordMatch = await bcrypt.compare(oldPassword, userRow.password_hash);
    if (!passwordMatch) {
      throw new Error('旧密码错误');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.pool.execute(
      'UPDATE sys_users SET password_hash = ? WHERE id = ?',
      [hashedPassword, id]
    );
  }

  async deleteUser(id: string): Promise<void> {
    await this.pool.execute('DELETE FROM sys_users WHERE id = ?', [id]);
    await this.pool.execute('DELETE FROM sys_user_roles WHERE user_id = ?', [id]);
  }

  async getAllUsers(): Promise<User[]> {
    const [rows] = await this.pool.execute('SELECT * FROM sys_users ORDER BY created_at DESC');

    return (rows as any[]).map(row => ({
      id: row.id,
      username: row.username,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      status: row.status,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime()
    }));
  }

  async getPendingUsers(): Promise<User[]> {
    const [rows] = await this.pool.execute(
      'SELECT * FROM sys_users WHERE status = ? ORDER BY created_at DESC',
      ['pending']
    );

    return (rows as any[]).map(row => ({
      id: row.id,
      username: row.username,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      status: row.status,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime()
    }));
  }

  async approveUser(id: string): Promise<User> {
    const user = await this.getUserById(id);
    if (!user) throw new Error('用户不存在');
    if (user.status !== 'pending') throw new Error('用户不是待审核状态');

    await this.pool.execute(
      'UPDATE sys_users SET status = ? WHERE id = ?',
      ['active', id]
    );

    return (await this.getUserById(id))!;
  }

  async rejectUser(id: string): Promise<void> {
    const user = await this.getUserById(id);
    if (!user) throw new Error('用户不存在');
    if (user.status !== 'pending') throw new Error('用户不是待审核状态');

    await this.pool.execute('DELETE FROM sys_users WHERE id = ?', [id]);
  }

  /**
   * 初始化默认管理员账户
   */
  async initDefaultAdmin(): Promise<void> {
    const [rows] = await this.pool.execute(
      'SELECT id, password_hash FROM sys_users WHERE username = ?',
      ['admin']
    );

    const existingAdmin = (rows as any[])[0];
    
    if (!existingAdmin) {
      // 不存在 admin 用户，创建新的
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const adminId = '00000000-0000-0000-0000-000000000001';

      await this.pool.execute(
        `INSERT INTO sys_users (id, username, password_hash, email, full_name, role, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [adminId, 'admin', hashedPassword, 'admin@example.com', '系统管理员', 'admin', 'active']
      );

      // 关联超级管理员角色
      await this.pool.execute(
        `INSERT IGNORE INTO sys_user_roles (user_id, role_id) VALUES (?, ?)`,
        [adminId, '00000000-0000-0000-0000-000000000001']
      );

      console.log('已创建默认管理员账户: admin / admin123');
    } else {
      // admin 用户已存在，不做任何操作（不再重置密码）
      console.log('管理员账户已存在，跳过初始化');
    }
  }
}
