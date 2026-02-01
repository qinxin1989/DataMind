/**
 * 示例模块 API
 */

import axios from 'axios';
import type {
  ExampleItem,
  CreateExampleDto,
  UpdateExampleDto,
  ExampleListQuery,
  ExampleListResponse
} from '../../backend/types';

const API_BASE = '/api/example';

export const exampleApi = {
  /**
   * 获取示例列表
   */
  async getList(query?: ExampleListQuery): Promise<ExampleListResponse> {
    const { data } = await axios.get(API_BASE, { params: query });
    return data.data;
  },

  /**
   * 根据ID获取示例
   */
  async getById(id: string): Promise<ExampleItem> {
    const { data } = await axios.get(`${API_BASE}/${id}`);
    return data.data;
  },

  /**
   * 创建示例
   */
  async create(dto: CreateExampleDto): Promise<ExampleItem> {
    const { data } = await axios.post(API_BASE, dto);
    return data.data;
  },

  /**
   * 更新示例
   */
  async update(id: string, dto: UpdateExampleDto): Promise<ExampleItem> {
    const { data } = await axios.put(`${API_BASE}/${id}`, dto);
    return data.data;
  },

  /**
   * 删除示例
   */
  async delete(id: string): Promise<void> {
    await axios.delete(`${API_BASE}/${id}`);
  },

  /**
   * 批量删除示例
   */
  async batchDelete(ids: string[]): Promise<number> {
    const { data } = await axios.post(`${API_BASE}/batch-delete`, { ids });
    return data.data.count;
  }
};
