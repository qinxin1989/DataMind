/**
 * 角色管理 API
 */

import axios from 'axios';
import type { Role, CreateRoleRequest, UpdateRoleRequest, RoleQueryParams, PaginatedResult } from '../../backend/types';

const API_BASE = '/api/admin/roles';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  timestamp: number;
}

export const roleApi = {
  /**
   * 获取所有角色
   */
  async getList(): Promise<ApiResponse<Role[]>> {
    const response = await axios.get(API_BASE);
    return response.data;
  },

  /**
   * 分页查询角色
   */
  async query(params: RoleQueryParams): Promise<ApiResponse<PaginatedResult<Role>>> {
    const response = await axios.get(API_BASE, { params });
    return response.data;
  },

  /**
   * 获取角色详情
   */
  async getById(id: string): Promise<ApiResponse<Role>> {
    const response = await axios.get(`${API_BASE}/${id}`);
    return response.data;
  },

  /**
   * 创建角色
   */
  async create(data: CreateRoleRequest): Promise<ApiResponse<Role>> {
    const response = await axios.post(API_BASE, data);
    return response.data;
  },

  /**
   * 更新角色
   */
  async update(id: string, data: UpdateRoleRequest): Promise<ApiResponse<Role>> {
    const response = await axios.put(`${API_BASE}/${id}`, data);
    return response.data;
  },

  /**
   * 删除角色
   */
  async delete(id: string): Promise<ApiResponse<{ message: string }>> {
    const response = await axios.delete(`${API_BASE}/${id}`);
    return response.data;
  },

  /**
   * 批量删除角色
   */
  async batchDelete(ids: string[]): Promise<ApiResponse<{ message: string }>> {
    const response = await axios.post(`${API_BASE}/batch/delete`, { ids });
    return response.data;
  },

  /**
   * 获取所有权限列表
   */
  async getAllPermissions(): Promise<ApiResponse<string[]>> {
    const response = await axios.get(`${API_BASE}/permissions/all`);
    return response.data;
  },
};
