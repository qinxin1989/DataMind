/**
 * 用户管理 API
 */

import axios from 'axios';

const API_BASE = '/api/users';

export interface User {
  id: string;
  username: string;
  email?: string;
  fullName?: string;
  phone?: string;
  department?: string;
  role: 'admin' | 'user' | 'viewer';
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  roleIds: string[];
  roles?: any[];
  lastLoginAt?: number;
  lastLoginIp?: string;
  createdAt: number;
  updatedAt: number;
}

export interface UserQueryParams {
  keyword?: string;
  status?: string;
  role?: string;
  department?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  email?: string;
  fullName?: string;
  phone?: string;
  department?: string;
  role?: string;
  status?: string;
}

export interface UpdateUserRequest {
  email?: string;
  fullName?: string;
  phone?: string;
  department?: string;
  role?: string;
  status?: string;
}

export const userApi = {
  /**
   * 获取用户列表
   */
  async getList(params: UserQueryParams) {
    const response = await axios.get(API_BASE, { params });
    return response.data;
  },

  /**
   * 获取用户详情
   */
  async getById(id: string) {
    const response = await axios.get(`${API_BASE}/${id}`);
    return response.data;
  },

  /**
   * 创建用户
   */
  async create(data: CreateUserRequest) {
    const response = await axios.post(API_BASE, data);
    return response.data;
  },

  /**
   * 更新用户
   */
  async update(id: string, data: UpdateUserRequest) {
    const response = await axios.put(`${API_BASE}/${id}`, data);
    return response.data;
  },

  /**
   * 删除用户
   */
  async delete(id: string) {
    const response = await axios.delete(`${API_BASE}/${id}`);
    return response.data;
  },

  /**
   * 更新用户状态
   */
  async updateStatus(id: string, status: string) {
    const response = await axios.put(`${API_BASE}/${id}/status`, { status });
    return response.data;
  },

  /**
   * 批量更新状态
   */
  async batchUpdateStatus(ids: string[], status: string) {
    const response = await axios.post(`${API_BASE}/batch/status`, { ids, status });
    return response.data;
  },

  /**
   * 批量删除
   */
  async batchDelete(ids: string[]) {
    const response = await axios.post(`${API_BASE}/batch/delete`, { ids });
    return response.data;
  },

  /**
   * 重置密码
   */
  async resetPassword(id: string) {
    const response = await axios.post(`${API_BASE}/${id}/reset-password`);
    return response.data;
  },
};
