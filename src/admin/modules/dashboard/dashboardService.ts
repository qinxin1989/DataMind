import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DASHBOARDS_FILE = path.join(process.cwd(), 'data', 'dashboards.json');

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

export class DashboardService {
  private getDashboards(): Dashboard[] {
    try {
      if (!fs.existsSync(DASHBOARDS_FILE)) {
        fs.writeFileSync(DASHBOARDS_FILE, '[]');
        return [];
      }
      const data = fs.readFileSync(DASHBOARDS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('读取大屏数据失败:', error);
      return [];
    }
  }

  private saveDashboards(dashboards: Dashboard[]): void {
    fs.writeFileSync(DASHBOARDS_FILE, JSON.stringify(dashboards, null, 2));
  }

  // 获取所有大屏
  getAll(userId?: string): Dashboard[] {
    const dashboards = this.getDashboards();
    if (userId) {
      return dashboards.filter(d => d.createdBy === userId);
    }
    return dashboards;
  }

  // 根据ID获取大屏
  getById(id: string): Dashboard | null {
    const dashboards = this.getDashboards();
    return dashboards.find(d => d.id === id) || null;
  }

  // 创建大屏
  create(data: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>): Dashboard {
    const dashboards = this.getDashboards();
    const dashboard: Dashboard = {
      ...data,
      id: uuidv4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    dashboards.push(dashboard);
    this.saveDashboards(dashboards);
    return dashboard;
  }

  // 更新大屏
  update(id: string, data: Partial<Dashboard>): Dashboard | null {
    const dashboards = this.getDashboards();
    const index = dashboards.findIndex(d => d.id === id);
    if (index === -1) return null;

    dashboards[index] = {
      ...dashboards[index],
      ...data,
      id,
      updatedAt: Date.now(),
    };
    this.saveDashboards(dashboards);
    return dashboards[index];
  }

  // 删除大屏
  delete(id: string): boolean {
    const dashboards = this.getDashboards();
    const filtered = dashboards.filter(d => d.id !== id);
    if (filtered.length === dashboards.length) return false;
    this.saveDashboards(filtered);
    return true;
  }
}
