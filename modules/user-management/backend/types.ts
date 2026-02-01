/**
 * 用户管理模块类型定义
 */

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';
export type UserRole = 'admin' | 'user' | 'viewer';

export interface User {
  id: string;
  username: string;
  email?: string;
  fullName?: string;
  phone?: string;
  department?: string;
  role: UserRole;
  status: UserStatus;
  roleIds: string[];
  roles?: any[];
  lastLoginAt?: number;
  lastLoginIp?: string;
  createdAt: number;
  updatedAt: number;
}

export interface UserQueryParams {
  keyword?: string;
  status?: UserStatus;
  role?: UserRole;
  department?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateUserRequest {
  username: string;
  password: string;
  email?: string;
  fullName?: string;
  phone?: string;
  department?: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface UpdateUserRequest {
  email?: string;
  fullName?: string;
  phone?: string;
  department?: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface PaginatedResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}
