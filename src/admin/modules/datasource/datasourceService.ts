/**
 * 数据源管理服务
 * 实现连接测试、使用统计、分组和标签功能
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATASOURCES_FILE = path.join(DATA_DIR, 'datasources.json');
const DATASOURCE_STATS_FILE = path.join(DATA_DIR, 'datasource-stats.json');

export type DatasourceType = 'mysql' | 'postgresql' | 'sqlite' | 'mongodb' | 'redis' | 'elasticsearch';

// 数据源可见性类型
export type DatasourceVisibility = 'private' | 'public';

// 审核状态类型
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Datasource {
  id: string;
  name: string;
  type: DatasourceType;
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
  options?: Record<string, any>;
  group?: string;
  tags: string[];
  status: 'active' | 'inactive' | 'error';
  lastTestAt?: number;
  lastTestResult?: { success: boolean; message: string; latency?: number };
  createdAt: number;
  updatedAt: number;
  // 新增字段：所有者、可见性、审核状态
  ownerId: string;
  visibility: DatasourceVisibility;
  approvalStatus?: ApprovalStatus;
  approvalComment?: string;
  approvedBy?: string;
  approvedAt?: number;
}

export interface DatasourceStats {
  datasourceId: string;
  totalQueries: number;
  successQueries: number;
  failedQueries: number;
  avgResponseTime: number;
  lastQueryAt?: number;
  queriesByDay: { date: string; count: number }[];
}

export interface DatasourceQueryParams {
  keyword?: string;
  type?: DatasourceType;
  group?: string;
  tag?: string;
  status?: 'active' | 'inactive' | 'error';
  visibility?: DatasourceVisibility;
  approvalStatus?: ApprovalStatus;
  page: number;
  pageSize: number;
  // 当前用户ID，用于过滤可见数据源
  currentUserId?: string;
  // 是否为管理员（管理员可以看到所有数据源）
  isAdmin?: boolean;
}

export class DatasourceService {
  private datasources: Map<string, Datasource> = new Map();
  private stats: Map<string, DatasourceStats> = new Map();

  constructor() {
    this.loadData();
  }

  private loadData(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DATASOURCES_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(DATASOURCES_FILE, 'utf-8'));
        data.forEach((ds: Datasource) => this.datasources.set(ds.id, ds));
      } catch {
        // 文件为空或格式错误
      }
    }

    if (fs.existsSync(DATASOURCE_STATS_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(DATASOURCE_STATS_FILE, 'utf-8'));
        data.forEach((s: DatasourceStats) => this.stats.set(s.datasourceId, s));
      } catch {
        // 文件为空或格式错误
      }
    }
  }

  private saveDatasources(): void {
    fs.writeFileSync(DATASOURCES_FILE, JSON.stringify(Array.from(this.datasources.values()), null, 2));
  }

  private saveStats(): void {
    fs.writeFileSync(DATASOURCE_STATS_FILE, JSON.stringify(Array.from(this.stats.values()), null, 2));
  }

  // ==================== 数据源 CRUD ====================

  async createDatasource(data: Omit<Datasource, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'approvalStatus'>): Promise<Datasource> {
    const datasource: Datasource = {
      ...data,
      id: uuidv4(),
      tags: data.tags || [],
      status: 'inactive',
      visibility: data.visibility || 'private',
      approvalStatus: data.visibility === 'public' ? 'pending' : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.datasources.set(datasource.id, datasource);
    this.saveDatasources();

    // 初始化统计
    this.stats.set(datasource.id, {
      datasourceId: datasource.id,
      totalQueries: 0,
      successQueries: 0,
      failedQueries: 0,
      avgResponseTime: 0,
      queriesByDay: [],
    });
    this.saveStats();

    return datasource;
  }

  async getDatasourceById(id: string): Promise<Datasource | null> {
    return this.datasources.get(id) || null;
  }

  async updateDatasource(id: string, updates: Partial<Omit<Datasource, 'id' | 'createdAt'>>): Promise<Datasource> {
    const datasource = this.datasources.get(id);
    if (!datasource) {
      throw new Error('数据源不存在');
    }

    const updated: Datasource = {
      ...datasource,
      ...updates,
      updatedAt: Date.now(),
    };

    this.datasources.set(id, updated);
    this.saveDatasources();
    return updated;
  }

  async deleteDatasource(id: string): Promise<void> {
    if (!this.datasources.has(id)) {
      throw new Error('数据源不存在');
    }
    this.datasources.delete(id);
    this.stats.delete(id);
    this.saveDatasources();
    this.saveStats();
  }

  async queryDatasources(params: DatasourceQueryParams): Promise<{
    list: Datasource[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { keyword, type, group, tag, status, visibility, approvalStatus, page, pageSize, currentUserId, isAdmin } = params;

    let datasources = Array.from(this.datasources.values());

    // 可见性过滤：非管理员只能看到自己的私有数据源和已审核通过的公共数据源
    if (!isAdmin && currentUserId) {
      datasources = datasources.filter(ds => {
        // 自己创建的数据源都可以看到
        if (ds.ownerId === currentUserId) {
          return true;
        }
        // 其他人的数据源，只能看到已审核通过的公共数据源
        return ds.visibility === 'public' && ds.approvalStatus === 'approved';
      });
    }

    // 过滤
    if (keyword) {
      const kw = keyword.toLowerCase();
      datasources = datasources.filter(ds =>
        ds.name.toLowerCase().includes(kw) ||
        ds.host.toLowerCase().includes(kw) ||
        ds.database.toLowerCase().includes(kw)
      );
    }
    if (type) {
      datasources = datasources.filter(ds => ds.type === type);
    }
    if (group) {
      datasources = datasources.filter(ds => ds.group === group);
    }
    if (tag) {
      datasources = datasources.filter(ds => ds.tags.includes(tag));
    }
    if (status) {
      datasources = datasources.filter(ds => ds.status === status);
    }
    if (visibility) {
      datasources = datasources.filter(ds => ds.visibility === visibility);
    }
    if (approvalStatus) {
      datasources = datasources.filter(ds => ds.approvalStatus === approvalStatus);
    }

    // 排序
    datasources.sort((a, b) => b.updatedAt - a.updatedAt);

    const total = datasources.length;
    const startIdx = (page - 1) * pageSize;
    const list = datasources.slice(startIdx, startIdx + pageSize);

    return { list, total, page, pageSize };
  }

  // ==================== 连接测试 ====================

  async testConnection(id: string): Promise<{ success: boolean; message: string; latency?: number }> {
    const datasource = this.datasources.get(id);
    if (!datasource) {
      throw new Error('数据源不存在');
    }

    const startTime = Date.now();

    // 模拟连接测试（实际应该使用对应的数据库驱动）
    const result = await this.simulateConnectionTest(datasource);

    const latency = Date.now() - startTime;

    // 更新数据源状态
    datasource.lastTestAt = Date.now();
    datasource.lastTestResult = { ...result, latency };
    datasource.status = result.success ? 'active' : 'error';
    datasource.updatedAt = Date.now();

    this.datasources.set(id, datasource);
    this.saveDatasources();

    return { ...result, latency };
  }

  private async simulateConnectionTest(datasource: Datasource): Promise<{ success: boolean; message: string }> {
    // 模拟测试逻辑
    // 实际实现应该根据 datasource.type 使用对应的数据库驱动进行连接测试

    // 基本验证
    if (!datasource.host) {
      return { success: false, message: '主机地址不能为空' };
    }
    if (!datasource.port || datasource.port <= 0) {
      return { success: false, message: '端口号无效' };
    }
    if (!datasource.database) {
      return { success: false, message: '数据库名不能为空' };
    }

    // 模拟成功
    return { success: true, message: '连接成功' };
  }

  async testConnectionConfig(config: Partial<Datasource>): Promise<{ success: boolean; message: string }> {
    // 测试配置而不保存
    if (!config.host) {
      return { success: false, message: '主机地址不能为空' };
    }
    if (!config.port || config.port <= 0) {
      return { success: false, message: '端口号无效' };
    }
    if (!config.database) {
      return { success: false, message: '数据库名不能为空' };
    }

    return { success: true, message: '配置验证通过' };
  }

  // ==================== 使用统计 ====================

  async getStats(id: string): Promise<DatasourceStats | null> {
    return this.stats.get(id) || null;
  }

  async recordQuery(id: string, success: boolean, responseTime: number): Promise<void> {
    let stats = this.stats.get(id);
    if (!stats) {
      stats = {
        datasourceId: id,
        totalQueries: 0,
        successQueries: 0,
        failedQueries: 0,
        avgResponseTime: 0,
        queriesByDay: [],
      };
    }

    stats.totalQueries++;
    if (success) {
      stats.successQueries++;
    } else {
      stats.failedQueries++;
    }

    // 更新平均响应时间
    stats.avgResponseTime = (stats.avgResponseTime * (stats.totalQueries - 1) + responseTime) / stats.totalQueries;
    stats.lastQueryAt = Date.now();

    // 更新按天统计
    const today = new Date().toISOString().split('T')[0];
    const dayStats = stats.queriesByDay.find(d => d.date === today);
    if (dayStats) {
      dayStats.count++;
    } else {
      stats.queriesByDay.push({ date: today, count: 1 });
      // 只保留最近 30 天
      if (stats.queriesByDay.length > 30) {
        stats.queriesByDay.shift();
      }
    }

    this.stats.set(id, stats);
    this.saveStats();
  }

  async getAllStats(): Promise<DatasourceStats[]> {
    return Array.from(this.stats.values());
  }

  // ==================== 分组和标签 ====================

  async getGroups(): Promise<string[]> {
    const groups = new Set<string>();
    for (const ds of this.datasources.values()) {
      if (ds.group) {
        groups.add(ds.group);
      }
    }
    return Array.from(groups);
  }

  async getTags(): Promise<string[]> {
    const tags = new Set<string>();
    for (const ds of this.datasources.values()) {
      for (const tag of ds.tags) {
        tags.add(tag);
      }
    }
    return Array.from(tags);
  }

  async setGroup(id: string, group: string | undefined): Promise<Datasource> {
    return this.updateDatasource(id, { group });
  }

  async addTag(id: string, tag: string): Promise<Datasource> {
    const datasource = this.datasources.get(id);
    if (!datasource) {
      throw new Error('数据源不存在');
    }

    if (!datasource.tags.includes(tag)) {
      datasource.tags.push(tag);
      datasource.updatedAt = Date.now();
      this.datasources.set(id, datasource);
      this.saveDatasources();
    }

    return datasource;
  }

  async removeTag(id: string, tag: string): Promise<Datasource> {
    const datasource = this.datasources.get(id);
    if (!datasource) {
      throw new Error('数据源不存在');
    }

    const index = datasource.tags.indexOf(tag);
    if (index !== -1) {
      datasource.tags.splice(index, 1);
      datasource.updatedAt = Date.now();
      this.datasources.set(id, datasource);
      this.saveDatasources();
    }

    return datasource;
  }

  // ==================== 测试辅助 ====================

  clearAll(): void {
    this.datasources.clear();
    this.stats.clear();
  }

  // ==================== 可见性和审核管理 ====================

  /**
   * 更新数据源可见性
   */
  async updateVisibility(id: string, visibility: DatasourceVisibility, currentUserId: string): Promise<Datasource> {
    const datasource = this.datasources.get(id);
    if (!datasource) {
      throw new Error('数据源不存在');
    }

    // 只有所有者可以修改可见性
    if (datasource.ownerId !== currentUserId) {
      throw new Error('只有数据源所有者可以修改可见性');
    }

    const updated: Datasource = {
      ...datasource,
      visibility,
      // 如果设为公共，需要重新审核
      approvalStatus: visibility === 'public' ? 'pending' : undefined,
      approvalComment: undefined,
      approvedBy: undefined,
      approvedAt: undefined,
      updatedAt: Date.now(),
    };

    this.datasources.set(id, updated);
    this.saveDatasources();
    return updated;
  }

  /**
   * 审核数据源（管理员操作）
   */
  async approveDatasource(
    id: string,
    approved: boolean,
    adminId: string,
    comment?: string
  ): Promise<Datasource> {
    const datasource = this.datasources.get(id);
    if (!datasource) {
      throw new Error('数据源不存在');
    }

    if (datasource.visibility !== 'public') {
      throw new Error('只有公共数据源需要审核');
    }

    if (datasource.approvalStatus !== 'pending') {
      throw new Error('该数据源不在待审核状态');
    }

    const updated: Datasource = {
      ...datasource,
      approvalStatus: approved ? 'approved' : 'rejected',
      approvalComment: comment,
      approvedBy: adminId,
      approvedAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.datasources.set(id, updated);
    this.saveDatasources();
    return updated;
  }

  /**
   * 获取待审核的数据源列表（管理员用）
   */
  async getPendingApprovals(page: number = 1, pageSize: number = 20): Promise<{
    list: Datasource[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    let datasources = Array.from(this.datasources.values())
      .filter(ds => ds.visibility === 'public' && ds.approvalStatus === 'pending');

    // 按创建时间排序
    datasources.sort((a, b) => a.createdAt - b.createdAt);

    const total = datasources.length;
    const startIdx = (page - 1) * pageSize;
    const list = datasources.slice(startIdx, startIdx + pageSize);

    return { list, total, page, pageSize };
  }

  /**
   * 检查用户是否可以访问数据源
   */
  async canAccessDatasource(id: string, userId: string, isAdmin: boolean): Promise<boolean> {
    const datasource = this.datasources.get(id);
    if (!datasource) {
      return false;
    }

    // 管理员可以访问所有数据源
    if (isAdmin) {
      return true;
    }

    // 所有者可以访问自己的数据源
    if (datasource.ownerId === userId) {
      return true;
    }

    // 其他用户只能访问已审核通过的公共数据源
    return datasource.visibility === 'public' && datasource.approvalStatus === 'approved';
  }
}

export const datasourceService = new DatasourceService();
