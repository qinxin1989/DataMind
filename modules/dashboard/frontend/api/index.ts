/**
 * Dashboard API
 * 大屏管理API封装
 */

import axios from 'axios';
import type {
  Dashboard,
  CreateDashboardDto,
  UpdateDashboardDto,
  DashboardQueryParams,
  DashboardListResponse,
  DashboardChart,
} from '../../backend/types';

const API_BASE = '/api/dashboards';

/**
 * 获取大屏列表
 */
export async function getDashboards(params?: DashboardQueryParams): Promise<DashboardListResponse> {
  const response = await axios.get(API_BASE, { params });
  return response.data;
}

/**
 * 获取大屏详情
 */
export async function getDashboard(id: string): Promise<Dashboard> {
  const response = await axios.get(`${API_BASE}/${id}`);
  return response.data;
}

/**
 * 创建大屏
 */
export async function createDashboard(data: CreateDashboardDto): Promise<Dashboard> {
  const response = await axios.post(API_BASE, data);
  return response.data;
}

/**
 * 更新大屏
 */
export async function updateDashboard(id: string, data: UpdateDashboardDto): Promise<Dashboard> {
  const response = await axios.put(`${API_BASE}/${id}`, data);
  return response.data;
}

/**
 * 删除大屏
 */
export async function deleteDashboard(id: string): Promise<void> {
  await axios.delete(`${API_BASE}/${id}`);
}

/**
 * 发布大屏
 */
export async function publishDashboard(id: string): Promise<Dashboard> {
  const response = await axios.post(`${API_BASE}/${id}/publish`);
  return response.data;
}

/**
 * 取消发布大屏
 */
export async function unpublishDashboard(id: string): Promise<Dashboard> {
  const response = await axios.post(`${API_BASE}/${id}/unpublish`);
  return response.data;
}

/**
 * 归档大屏
 */
export async function archiveDashboard(id: string): Promise<Dashboard> {
  const response = await axios.post(`${API_BASE}/${id}/archive`);
  return response.data;
}

/**
 * 添加图表
 */
export async function addChart(dashboardId: string, chart: Omit<DashboardChart, 'id'>): Promise<Dashboard> {
  const response = await axios.post(`${API_BASE}/${dashboardId}/charts`, chart);
  return response.data;
}

/**
 * 更新图表
 */
export async function updateChart(
  dashboardId: string,
  chartId: string,
  data: Partial<DashboardChart>
): Promise<Dashboard> {
  const response = await axios.put(`${API_BASE}/${dashboardId}/charts/${chartId}`, data);
  return response.data;
}

/**
 * 删除图表
 */
export async function deleteChart(dashboardId: string, chartId: string): Promise<Dashboard> {
  const response = await axios.delete(`${API_BASE}/${dashboardId}/charts/${chartId}`);
  return response.data;
}

/**
 * 获取统计信息
 */
export async function getDashboardStats(userId?: string): Promise<{
  total: number;
  draft: number;
  published: number;
  archived: number;
}> {
  const response = await axios.get(`${API_BASE}/stats`, {
    params: { userId },
  });
  return response.data;
}
