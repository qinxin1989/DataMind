/**
 * 菜单管理 API
 */

import axios from 'axios';
import type { Menu, CreateMenuRequest, UpdateMenuRequest } from '../../backend/types';

const API_BASE = '/api/menus';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  timestamp: number;
}

export const menuApi = {
  /**
   * 获取所有菜单
   */
  async getAll(): Promise<ApiResponse<Menu[]>> {
    const response = await axios.get(API_BASE);
    return response.data;
  },

  /**
   * 获取菜单树
   */
  async getTree(): Promise<ApiResponse<Menu[]>> {
    const response = await axios.get(`${API_BASE}/tree`);
    return response.data;
  },

  /**
   * 获取用户菜单树
   */
  async getUserTree(userId: string): Promise<ApiResponse<Menu[]>> {
    const response = await axios.get(`${API_BASE}/user/${userId}`);
    return response.data;
  },

  /**
   * 获取菜单详情
   */
  async getById(id: string): Promise<ApiResponse<Menu>> {
    const response = await axios.get(`${API_BASE}/${id}`);
    return response.data;
  },

  /**
   * 创建菜单
   */
  async create(data: CreateMenuRequest): Promise<ApiResponse<Menu>> {
    const response = await axios.post(API_BASE, data);
    return response.data;
  },

  /**
   * 更新菜单
   */
  async update(id: string, data: UpdateMenuRequest): Promise<ApiResponse<Menu>> {
    const response = await axios.put(`${API_BASE}/${id}`, data);
    return response.data;
  },

  /**
   * 删除菜单
   */
  async delete(id: string): Promise<ApiResponse<{ message: string }>> {
    const response = await axios.delete(`${API_BASE}/${id}`);
    return response.data;
  },

  /**
   * 批量删除菜单
   */
  async batchDelete(ids: string[]): Promise<ApiResponse<{ message: string }>> {
    const response = await axios.post(`${API_BASE}/batch/delete`, { ids });
    return response.data;
  },

  /**
   * 切换菜单可见性
   */
  async toggleVisibility(id: string): Promise<ApiResponse<Menu>> {
    const response = await axios.put(`${API_BASE}/${id}/visibility`);
    return response.data;
  },

  /**
   * 更新菜单排序
   */
  async updateSort(items: { id: string; order: number }[]): Promise<ApiResponse<{ message: string }>> {
    const response = await axios.post(`${API_BASE}/sort`, { items });
    return response.data;
  },
};
