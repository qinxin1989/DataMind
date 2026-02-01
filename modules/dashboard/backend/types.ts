/**
 * Dashboard Module Types
 * 大屏管理模块类型定义
 */

/**
 * 图表类型
 */
export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'card' | 'table' | 'gauge' | 'scatter';

/**
 * 大屏主题
 */
export type DashboardTheme = 'light' | 'dark' | 'blue' | 'tech';

/**
 * 大屏状态
 */
export type DashboardStatus = 'draft' | 'published' | 'archived';

/**
 * 图表配置接口
 */
export interface DashboardChart {
  id: string;
  type: ChartType;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config: any;
  data?: any[];
  dataSourceId?: string;
  refreshInterval?: number; // 刷新间隔（秒）
}

/**
 * 大屏接口
 */
export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  datasourceId: string;
  datasourceName?: string;
  charts: DashboardChart[];
  theme: DashboardTheme;
  status: DashboardStatus;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
  publishedBy?: string;
}

/**
 * 创建大屏DTO
 */
export interface CreateDashboardDto {
  name: string;
  description?: string;
  datasourceId: string;
  datasourceName?: string;
  charts?: DashboardChart[];
  theme?: DashboardTheme;
}

/**
 * 更新大屏DTO
 */
export interface UpdateDashboardDto {
  name?: string;
  description?: string;
  charts?: DashboardChart[];
  theme?: DashboardTheme;
}

/**
 * 大屏查询参数
 */
export interface DashboardQueryParams {
  page?: number;
  pageSize?: number;
  status?: DashboardStatus;
  createdBy?: string;
  keyword?: string;
}

/**
 * 大屏列表响应
 */
export interface DashboardListResponse {
  items: Dashboard[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 发布大屏DTO
 */
export interface PublishDashboardDto {
  publishedBy: string;
}

/**
 * 图表数据接口
 */
export interface ChartData {
  chartId: string;
  data: any[];
  updatedAt: number;
}
