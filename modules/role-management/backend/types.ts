/**
 * 角色管理模块类型定义
 */

export interface Role {
  id: string;
  name: string;
  code: string;
  description?: string;
  parentId?: string;
  status: 'active' | 'inactive';
  isSystem: boolean;
  permissionCodes: string[];
  menuIds?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface CreateRoleRequest {
  name: string;
  code: string;
  description?: string;
  parentId?: string;
  status?: 'active' | 'inactive';
  permissionCodes?: string[];
  menuIds?: string[];
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  parentId?: string;
  status?: 'active' | 'inactive';
  permissionCodes?: string[];
  menuIds?: string[];
}

export interface RoleQueryParams {
  keyword?: string;
  status?: 'active' | 'inactive';
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
