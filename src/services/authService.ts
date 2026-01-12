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
    // 验证用户名
    if (!username || username.length < 3) {
      throw new Error('用户名至少需要3个字符');
    }

    // 验证密码
    if (!password || password.length < 6) {
      throw new Error('密码至少需要6个字符');
    }

    // 检查用户名是否已存在
    const [existing] = await this.pool.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if ((existing as any[]).length > 0) {
      throw new Error('用户名已存在');
    }

    // 密码加密
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户（默认待审核状态）
    const userId = uuidv4();
    const now = new Date();

    await this.pool.execute(
      `INSERT INTO users (id, username, password, email, full_name, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, username, hashedPassword, email || null, fullName || null, 'user', 'pending', now, now]
    );

    // 获取用户信息
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
    // 验证用户名
    if (!username || username.length < 3) {
      throw new Error('用户名至少需要3个字符');
    }

    // 验证密码
    if (!password || password.length < 6) {
      throw new Error('密码至少需要6个字符');
    }

    // 检查用户名是否已存在
    const [existing] = await this.pool.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if ((existing as any[]).length > 0) {
      throw new Error('用户名已存在');
    }

    // 密码加密
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户（直接激活）
    const userId = uuidv4();
    const now = new Date();

    await this.pool.execute(
      `INSERT INTO users (id, username, password, email, full_name, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, username, hashedPassword, email || null, fullName || null, role, 'active', now, now]
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
    // 查找用户
    const [rows] = await this.pool.execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    const userRow = (rows as any[])[0];
    if (!userRow) {
      throw new Error('用户名或密码错误');
    }

    // 检查用户状态
    if (userRow.status !== 'active') {
      throw new Error('用户已被禁用');
    }

    // 验证密码
    const passwordMatch = await bcrypt.compare(password, userRow.password);
    if (!passwordMatch) {
      throw new Error('用户名或密码错误');
    }

    // 转换为User对象
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

    // 生成token
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

  /**
   * 生成token
   */
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

  /**
   * 根据ID获取用户
   */
  async getUserById(id: string): Promise<User | null> {
    const [rows] = await this.pool.execute(
      'SELECT * FROM users WHERE id = ?',
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

  /**
   * 更新用户信息
   */
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

    fields.push('updated_at = NOW()');
    values.push(id);

    await this.pool.execute(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    const user = await this.getUserById(id);
    if (!user) throw new Error('用户更新失败');
    return user;
  }

  /**
   * 修改密码
   */
  async changePassword(id: string, oldPassword: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('新密码至少需要6个字符');
    }

    // 获取用户
    const user = await this.getUserById(id);
    if (!user) throw new Error('用户不存在');

    // 验证旧密码
    const [rows] = await this.pool.execute(
      'SELECT password FROM users WHERE id = ?',
      [id]
    );

    const userRow = (rows as any[])[0];
    const passwordMatch = await bcrypt.compare(oldPassword, userRow.password);
    if (!passwordMatch) {
      throw new Error('旧密码错误');
    }

    // 更新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.pool.execute(
      'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
      [hashedPassword, id]
    );
  }

  /**
   * 删除用户
   */
  async deleteUser(id: string): Promise<void> {
    await this.pool.execute('DELETE FROM users WHERE id = ?', [id]);
  }

  /**
   * 获取所有用户（仅管理员）
   */
  async getAllUsers(): Promise<User[]> {
    const [rows] = await this.pool.execute('SELECT * FROM users ORDER BY created_at DESC');

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

  /**
   * 获取待审核用户列表
   */
  async getPendingUsers(): Promise<User[]> {
    const [rows] = await this.pool.execute(
      'SELECT * FROM users WHERE status = ? ORDER BY created_at DESC',
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

  /**
   * 审核通过用户
   */
  async approveUser(id: string): Promise<User> {
    const user = await this.getUserById(id);
    if (!user) throw new Error('用户不存在');
    if (user.status !== 'pending') throw new Error('用户不是待审核状态');

    await this.pool.execute(
      'UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?',
      ['active', id]
    );

    return (await this.getUserById(id))!;
  }

  /**
   * 拒绝用户注册
   */
  async rejectUser(id: string): Promise<void> {
    const user = await this.getUserById(id);
    if (!user) throw new Error('用户不存在');
    if (user.status !== 'pending') throw new Error('用户不是待审核状态');

    await this.pool.execute('DELETE FROM users WHERE id = ?', [id]);
  }
}
