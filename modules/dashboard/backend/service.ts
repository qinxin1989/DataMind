/**
 * Dashboard Service
 * 大屏管理服务
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  Dashboard,
  CreateDashboardDto,
  UpdateDashboardDto,
  DashboardQueryParams,
  DashboardListResponse,
  PublishDashboardDto,
  DashboardStatus,
  DashboardChart,
} from './types';

export class DashboardService {
  private dataDir: string;
  private dashboardsFile: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || path.join(process.cwd(), 'data', 'dashboards');
    this.dashboardsFile = path.join(this.dataDir, 'dashboards.json');
    this.ensureDataDir();
  }

  /**
   * 确保数据目录存在
   */
  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.dashboardsFile)) {
      fs.writeFileSync(this.dashboardsFile, '[]');
    }
  }

  /**
   * 读取所有大屏
   */
  private getDashboards(): Dashboard[] {
    try {
      const data = fs.readFileSync(this.dashboardsFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('读取大屏数据失败:', error);
      return [];
    }
  }

  /**
   * 保存大屏数据
   */
  private saveDashboards(dashboards: Dashboard[]): void {
    fs.writeFileSync(this.dashboardsFile, JSON.stringify(dashboards, null, 2));
  }

  /**
   * 获取大屏列表（支持分页和过滤）
   */
  getList(params: DashboardQueryParams = {}): DashboardListResponse {
    const {
      page = 1,
      pageSize = 10,
      status,
      createdBy,
      keyword,
    } = params;

    let dashboards = this.getDashboards();

    // 过滤
    if (status) {
      dashboards = dashboards.filter(d => d.status === status);
    }
    if (createdBy) {
      dashboards = dashboards.filter(d => d.createdBy === createdBy);
    }
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      dashboards = dashboards.filter(d =>
        d.name.toLowerCase().includes(lowerKeyword) ||
        (d.description && d.description.toLowerCase().includes(lowerKeyword))
      );
    }

    // 排序（最新的在前）
    dashboards.sort((a, b) => b.updatedAt - a.updatedAt);

    // 分页
    const total = dashboards.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const items = dashboards.slice(start, end);

    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 根据ID获取大屏
   */
  getById(id: string): Dashboard | null {
    const dashboards = this.getDashboards();
    return dashboards.find(d => d.id === id) || null;
  }

  /**
   * 创建大屏
   */
  create(dto: CreateDashboardDto, createdBy: string): Dashboard {
    const dashboards = this.getDashboards();
    
    const dashboard: Dashboard = {
      id: uuidv4(),
      name: dto.name,
      description: dto.description,
      datasourceId: dto.datasourceId,
      datasourceName: dto.datasourceName,
      charts: dto.charts || [],
      theme: dto.theme || 'dark',
      status: 'draft',
      createdBy,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    dashboards.push(dashboard);
    this.saveDashboards(dashboards);
    return dashboard;
  }

  /**
   * 更新大屏
   */
  update(id: string, dto: UpdateDashboardDto): Dashboard | null {
    const dashboards = this.getDashboards();
    const index = dashboards.findIndex(d => d.id === id);
    
    if (index === -1) {
      return null;
    }

    dashboards[index] = {
      ...dashboards[index],
      ...dto,
      id,
      updatedAt: Date.now(),
    };

    this.saveDashboards(dashboards);
    return dashboards[index];
  }

  /**
   * 删除大屏
   */
  delete(id: string): boolean {
    const dashboards = this.getDashboards();
    const filtered = dashboards.filter(d => d.id !== id);
    
    if (filtered.length === dashboards.length) {
      return false;
    }

    this.saveDashboards(filtered);
    return true;
  }

  /**
   * 发布大屏
   */
  publish(id: string, dto: PublishDashboardDto): Dashboard | null {
    const dashboards = this.getDashboards();
    const index = dashboards.findIndex(d => d.id === id);
    
    if (index === -1) {
      return null;
    }

    dashboards[index] = {
      ...dashboards[index],
      status: 'published',
      publishedAt: Date.now(),
      publishedBy: dto.publishedBy,
      updatedAt: Date.now(),
    };

    this.saveDashboards(dashboards);
    return dashboards[index];
  }

  /**
   * 取消发布大屏
   */
  unpublish(id: string): Dashboard | null {
    const dashboards = this.getDashboards();
    const index = dashboards.findIndex(d => d.id === id);
    
    if (index === -1) {
      return null;
    }

    dashboards[index] = {
      ...dashboards[index],
      status: 'draft',
      updatedAt: Date.now(),
    };

    this.saveDashboards(dashboards);
    return dashboards[index];
  }

  /**
   * 归档大屏
   */
  archive(id: string): Dashboard | null {
    const dashboards = this.getDashboards();
    const index = dashboards.findIndex(d => d.id === id);
    
    if (index === -1) {
      return null;
    }

    dashboards[index] = {
      ...dashboards[index],
      status: 'archived',
      updatedAt: Date.now(),
    };

    this.saveDashboards(dashboards);
    return dashboards[index];
  }

  /**
   * 添加图表到大屏
   */
  addChart(dashboardId: string, chart: Omit<DashboardChart, 'id'>): Dashboard | null {
    const dashboard = this.getById(dashboardId);
    if (!dashboard) {
      return null;
    }

    const newChart: DashboardChart = {
      ...chart,
      id: uuidv4(),
    };

    dashboard.charts.push(newChart);
    return this.update(dashboardId, { charts: dashboard.charts });
  }

  /**
   * 更新图表
   */
  updateChart(dashboardId: string, chartId: string, chartData: Partial<DashboardChart>): Dashboard | null {
    const dashboard = this.getById(dashboardId);
    if (!dashboard) {
      return null;
    }

    const chartIndex = dashboard.charts.findIndex(c => c.id === chartId);
    if (chartIndex === -1) {
      return null;
    }

    dashboard.charts[chartIndex] = {
      ...dashboard.charts[chartIndex],
      ...chartData,
      id: chartId,
    };

    return this.update(dashboardId, { charts: dashboard.charts });
  }

  /**
   * 删除图表
   */
  deleteChart(dashboardId: string, chartId: string): Dashboard | null {
    const dashboard = this.getById(dashboardId);
    if (!dashboard) {
      return null;
    }

    dashboard.charts = dashboard.charts.filter(c => c.id !== chartId);
    return this.update(dashboardId, { charts: dashboard.charts });
  }

  /**
   * 获取统计信息
   */
  getStats(userId?: string): {
    total: number;
    draft: number;
    published: number;
    archived: number;
  } {
    let dashboards = this.getDashboards();

    if (userId) {
      dashboards = dashboards.filter(d => d.createdBy === userId);
    }

    return {
      total: dashboards.length,
      draft: dashboards.filter(d => d.status === 'draft').length,
      published: dashboards.filter(d => d.status === 'published').length,
      archived: dashboards.filter(d => d.status === 'archived').length,
    };
  }
}
