/**
 * 认证模块类型定义
 */

// 用户状态
export type UserStatus = 'pending' | 'active' | 'inactive' | 'rejected';

// 用户角色
export type UserRole = 'admin' | 'user' | 'guest';

// 用户信息
export interface User {
    id: string;
    username: string;
    email?: string;
    fullName?: string;
    role: UserRole;
    status: UserStatus;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt?: Date;
}

// 用户（不含密码）
export interface SafeUser extends Omit<User, 'password'> { }

// 登录请求
export interface LoginRequest {
    username: string;
    password: string;
}

// 登录响应
export interface LoginResponse {
    user: SafeUser;
    token: string;
}

// 注册请求
export interface RegisterRequest {
    username: string;
    password: string;
    email?: string;
    fullName?: string;
}

// 注册响应
export interface RegisterResponse {
    user: SafeUser;
    message: string;
}

// 修改密码请求
export interface ChangePasswordRequest {
    oldPassword: string;
    newPassword: string;
}

// 创建用户请求（管理员）
export interface CreateUserRequest {
    username: string;
    password: string;
    email?: string;
    fullName?: string;
    role?: UserRole;
}

// 更新用户请求
export interface UpdateUserRequest {
    email?: string;
    fullName?: string;
    role?: UserRole;
    status?: UserStatus;
}

// JWT Payload
export interface JwtPayload {
    userId: string;
    username: string;
    role: UserRole;
    iat?: number;
    exp?: number;
}

// 认证服务配置
export interface AuthServiceConfig {
    pool: any;
    jwtSecret: string;
    jwtExpiresIn: string;
}
