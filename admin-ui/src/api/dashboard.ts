import { get, post, put, del } from './request';

export interface DashboardChart {
  id: string;
  type: 'bar' | 'line' | 'pie' | 'area' | 'card';
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config: any;
  data?: any[];
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  datasourceId: string;
  datasourceName?: string;
  charts: DashboardChart[];
  theme: 'light' | 'dark';
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

// 获取所有大屏
export const getDashboards = () => get<Dashboard[]>('/admin/dashboards');

// 获取单个大屏
export const getDashboard = (id: string) => get<Dashboard>(`/admin/dashboards/${id}`);

// 创建大屏
export const createDashboard = (data: Partial<Dashboard>) => post<Dashboard>('/admin/dashboards', data);

// 更新大屏
export const updateDashboard = (id: string, data: Partial<Dashboard>) => put<Dashboard>(`/admin/dashboards/${id}`, data);

// 删除大屏
export const deleteDashboard = (id: string) => del(`/admin/dashboards/${id}`);
