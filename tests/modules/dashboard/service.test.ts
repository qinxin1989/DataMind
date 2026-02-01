/**
 * Dashboard Service Tests
 * 大屏管理服务测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DashboardService } from '../../../modules/dashboard/backend/service';
import type { CreateDashboardDto, UpdateDashboardDto } from '../../../modules/dashboard/backend/types';

describe('Dashboard Module Service', () => {
  let service: DashboardService;
  const testDataDir = path.join(process.cwd(), 'data', 'dashboards-test');

  beforeEach(() => {
    // 使用测试专用目录
    service = new DashboardService(testDataDir);
  });

  afterEach(() => {
    // 清理测试数据
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('Property 19: Dashboard State Transitions', () => {
    it('should transition from draft to published', () => {
      const dto: CreateDashboardDto = {
        name: 'Test Dashboard',
        datasourceId: 'ds-001',
        theme: 'dark',
      };

      const dashboard = service.create(dto, 'user-001');
      expect(dashboard.status).toBe('draft');

      const published = service.publish(dashboard.id, { publishedBy: 'user-001' });
      expect(published).not.toBeNull();
      expect(published!.status).toBe('published');
      expect(published!.publishedBy).toBe('user-001');
      expect(published!.publishedAt).toBeDefined();
    });

    it('should transition from published to draft', () => {
      const dto: CreateDashboardDto = {
        name: 'Test Dashboard',
        datasourceId: 'ds-001',
      };

      const dashboard = service.create(dto, 'user-001');
      const published = service.publish(dashboard.id, { publishedBy: 'user-001' });
      
      const unpublished = service.unpublish(published!.id);
      expect(unpublished).not.toBeNull();
      expect(unpublished!.status).toBe('draft');
    });

    it('should transition to archived', () => {
      const dto: CreateDashboardDto = {
        name: 'Test Dashboard',
        datasourceId: 'ds-001',
      };

      const dashboard = service.create(dto, 'user-001');
      const archived = service.archive(dashboard.id);
      
      expect(archived).not.toBeNull();
      expect(archived!.status).toBe('archived');
    });

    it('should maintain state consistency across operations', () => {
      const dto: CreateDashboardDto = {
        name: 'Test Dashboard',
        datasourceId: 'ds-001',
      };

      const dashboard = service.create(dto, 'user-001');
      expect(dashboard.status).toBe('draft');

      // Publish
      const published = service.publish(dashboard.id, { publishedBy: 'user-001' });
      expect(published!.status).toBe('published');

      // Unpublish
      const unpublished = service.unpublish(dashboard.id);
      expect(unpublished!.status).toBe('draft');

      // Archive
      const archived = service.archive(dashboard.id);
      expect(archived!.status).toBe('archived');
    });
  });

  describe('Property 20: Chart Management Consistency', () => {
    it('should maintain chart count after add/delete operations', () => {
      const dto: CreateDashboardDto = {
        name: 'Test Dashboard',
        datasourceId: 'ds-001',
      };

      const dashboard = service.create(dto, 'user-001');
      const initialCount = dashboard.charts.length;

      // Add chart
      const withChart = service.addChart(dashboard.id, {
        type: 'bar',
        title: 'Test Chart',
        x: 0,
        y: 0,
        w: 6,
        h: 4,
        config: {},
      });
      expect(withChart!.charts.length).toBe(initialCount + 1);

      // Delete chart
      const chartId = withChart!.charts[0].id;
      const withoutChart = service.deleteChart(dashboard.id, chartId);
      expect(withoutChart!.charts.length).toBe(initialCount);
    });

    it('should preserve chart data after update', () => {
      const dto: CreateDashboardDto = {
        name: 'Test Dashboard',
        datasourceId: 'ds-001',
      };

      const dashboard = service.create(dto, 'user-001');
      const withChart = service.addChart(dashboard.id, {
        type: 'bar',
        title: 'Original Title',
        x: 0,
        y: 0,
        w: 6,
        h: 4,
        config: { key: 'value' },
      });

      const chartId = withChart!.charts[0].id;
      const updated = service.updateChart(dashboard.id, chartId, {
        title: 'Updated Title',
      });

      expect(updated!.charts[0].title).toBe('Updated Title');
      expect(updated!.charts[0].type).toBe('bar');
      expect(updated!.charts[0].config).toEqual({ key: 'value' });
    });

    it('should maintain chart uniqueness', () => {
      const dto: CreateDashboardDto = {
        name: 'Test Dashboard',
        datasourceId: 'ds-001',
      };

      const dashboard = service.create(dto, 'user-001');
      
      const chart1 = service.addChart(dashboard.id, {
        type: 'bar',
        title: 'Chart 1',
        x: 0,
        y: 0,
        w: 6,
        h: 4,
        config: {},
      });

      const chart2 = service.addChart(dashboard.id, {
        type: 'line',
        title: 'Chart 2',
        x: 6,
        y: 0,
        w: 6,
        h: 4,
        config: {},
      });

      const chartIds = chart2!.charts.map(c => c.id);
      const uniqueIds = new Set(chartIds);
      expect(chartIds.length).toBe(uniqueIds.size);
    });

    it('should handle multiple chart operations', () => {
      const dto: CreateDashboardDto = {
        name: 'Test Dashboard',
        datasourceId: 'ds-001',
      };

      const dashboard = service.create(dto, 'user-001');
      
      // Add 3 charts
      let current = dashboard;
      for (let i = 0; i < 3; i++) {
        current = service.addChart(current.id, {
          type: 'bar',
          title: `Chart ${i + 1}`,
          x: i * 4,
          y: 0,
          w: 4,
          h: 4,
          config: {},
        })!;
      }
      expect(current.charts.length).toBe(3);

      // Delete 1 chart
      const chartId = current.charts[1].id;
      current = service.deleteChart(current.id, chartId)!;
      expect(current.charts.length).toBe(2);

      // Update 1 chart
      const updateId = current.charts[0].id;
      current = service.updateChart(current.id, updateId, {
        title: 'Updated Chart',
      })!;
      expect(current.charts[0].title).toBe('Updated Chart');
    });
  });

  describe('Dashboard CRUD', () => {
    it('should create a dashboard', () => {
      const dto: CreateDashboardDto = {
        name: 'Test Dashboard',
        description: 'Test Description',
        datasourceId: 'ds-001',
        datasourceName: 'Test DataSource',
        theme: 'dark',
      };

      const dashboard = service.create(dto, 'user-001');

      expect(dashboard.id).toBeDefined();
      expect(dashboard.name).toBe('Test Dashboard');
      expect(dashboard.description).toBe('Test Description');
      expect(dashboard.datasourceId).toBe('ds-001');
      expect(dashboard.theme).toBe('dark');
      expect(dashboard.status).toBe('draft');
      expect(dashboard.createdBy).toBe('user-001');
      expect(dashboard.charts).toEqual([]);
    });

    it('should get dashboard by id', () => {
      const dto: CreateDashboardDto = {
        name: 'Test Dashboard',
        datasourceId: 'ds-001',
      };

      const created = service.create(dto, 'user-001');
      const retrieved = service.getById(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.name).toBe('Test Dashboard');
    });

    it('should update dashboard', () => {
      const dto: CreateDashboardDto = {
        name: 'Original Name',
        datasourceId: 'ds-001',
      };

      const created = service.create(dto, 'user-001');
      
      const updateDto: UpdateDashboardDto = {
        name: 'Updated Name',
        description: 'Updated Description',
        theme: 'light',
      };

      const updated = service.update(created.id, updateDto);

      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Updated Name');
      expect(updated!.description).toBe('Updated Description');
      expect(updated!.theme).toBe('light');
    });

    it('should delete dashboard', () => {
      const dto: CreateDashboardDto = {
        name: 'Test Dashboard',
        datasourceId: 'ds-001',
      };

      const created = service.create(dto, 'user-001');
      const deleted = service.delete(created.id);

      expect(deleted).toBe(true);
      expect(service.getById(created.id)).toBeNull();
    });
  });

  describe('List and Filter', () => {
    beforeEach(() => {
      // Create test data
      for (let i = 0; i < 15; i++) {
        const dto: CreateDashboardDto = {
          name: `Dashboard ${i}`,
          description: i % 2 === 0 ? 'Even' : 'Odd',
          datasourceId: 'ds-001',
        };
        const dashboard = service.create(dto, i % 3 === 0 ? 'user-001' : 'user-002');
        
        if (i % 3 === 0) {
          service.publish(dashboard.id, { publishedBy: 'user-001' });
        }
      }
    });

    it('should get paginated list', () => {
      const result = service.getList({ page: 1, pageSize: 10 });

      expect(result.items.length).toBe(10);
      expect(result.total).toBe(15);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it('should filter by status', () => {
      const result = service.getList({ status: 'published' });

      expect(result.items.every(d => d.status === 'published')).toBe(true);
      expect(result.total).toBe(5); // 15 / 3 = 5
    });

    it('should filter by createdBy', () => {
      const result = service.getList({ createdBy: 'user-001' });

      expect(result.items.every(d => d.createdBy === 'user-001')).toBe(true);
      expect(result.total).toBe(5); // 15 / 3 = 5
    });

    it('should filter by keyword', () => {
      const result = service.getList({ keyword: 'Even' });

      expect(result.items.every(d => d.description?.includes('Even'))).toBe(true);
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      // Create test data with different statuses
      for (let i = 0; i < 10; i++) {
        const dto: CreateDashboardDto = {
          name: `Dashboard ${i}`,
          datasourceId: 'ds-001',
        };
        const dashboard = service.create(dto, 'user-001');
        
        if (i < 3) {
          service.publish(dashboard.id, { publishedBy: 'user-001' });
        } else if (i < 5) {
          service.archive(dashboard.id);
        }
        // Rest remain as draft
      }
    });

    it('should get correct statistics', () => {
      const stats = service.getStats();

      expect(stats.total).toBe(10);
      expect(stats.published).toBe(3);
      expect(stats.archived).toBe(2);
      expect(stats.draft).toBe(5);
    });

    it('should get user-specific statistics', () => {
      // Create dashboards for another user
      for (let i = 0; i < 5; i++) {
        const dto: CreateDashboardDto = {
          name: `User2 Dashboard ${i}`,
          datasourceId: 'ds-001',
        };
        service.create(dto, 'user-002');
      }

      const stats = service.getStats('user-001');
      expect(stats.total).toBe(10);

      const stats2 = service.getStats('user-002');
      expect(stats2.total).toBe(5);
    });
  });

  describe('Property-based Tests', () => {
    it('should handle random dashboard operations', () => {
      const operations = ['create', 'update', 'delete', 'publish', 'unpublish'];
      const dashboards: string[] = [];

      for (let i = 0; i < 20; i++) {
        const op = operations[Math.floor(Math.random() * operations.length)];

        if (op === 'create' || dashboards.length === 0) {
          const dto: CreateDashboardDto = {
            name: `Dashboard ${i}`,
            datasourceId: 'ds-001',
          };
          const dashboard = service.create(dto, 'user-001');
          dashboards.push(dashboard.id);
        } else {
          const id = dashboards[Math.floor(Math.random() * dashboards.length)];
          
          switch (op) {
            case 'update':
              service.update(id, { name: `Updated ${i}` });
              break;
            case 'delete':
              service.delete(id);
              dashboards.splice(dashboards.indexOf(id), 1);
              break;
            case 'publish':
              service.publish(id, { publishedBy: 'user-001' });
              break;
            case 'unpublish':
              service.unpublish(id);
              break;
          }
        }
      }

      // Verify data consistency
      const list = service.getList({ pageSize: 100 });
      expect(list.items.length).toBe(dashboards.length);
    });

    it('should maintain data integrity across concurrent operations', () => {
      const dto: CreateDashboardDto = {
        name: 'Test Dashboard',
        datasourceId: 'ds-001',
      };

      const dashboard = service.create(dto, 'user-001');

      // Simulate concurrent operations
      service.update(dashboard.id, { name: 'Update 1' });
      service.addChart(dashboard.id, {
        type: 'bar',
        title: 'Chart 1',
        x: 0,
        y: 0,
        w: 6,
        h: 4,
        config: {},
      });
      service.publish(dashboard.id, { publishedBy: 'user-001' });

      const final = service.getById(dashboard.id);
      expect(final).not.toBeNull();
      expect(final!.name).toBe('Update 1');
      expect(final!.charts.length).toBe(1);
      expect(final!.status).toBe('published');
    });
  });
});
