/**
 * Other Modules Integration Tests
 * 其他模块集成测试（notification + dashboard）
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { NotificationService } from '../../modules/notification/backend/service';
import { DashboardService } from '../../modules/dashboard/backend/service';
import type { CreateNotificationDto } from '../../modules/notification/backend/types';
import type { CreateDashboardDto } from '../../modules/dashboard/backend/types';

describe('Other Modules Integration Tests', () => {
  let notificationService: NotificationService;
  let dashboardService: DashboardService;
  const testDataDir = path.join(process.cwd(), 'data', 'integration-test');

  beforeEach(() => {
    // 使用测试专用目录
    const dashboardDir = path.join(testDataDir, 'dashboards');
    
    notificationService = new NotificationService();
    dashboardService = new DashboardService(dashboardDir);
  });

  afterEach(() => {
    // 清理测试数据
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
    // 清理通知数据
    notificationService.clearAll();
  });

  describe('Module Initialization', () => {
    it('should initialize notification service', async () => {
      const dto: CreateNotificationDto = {
        userId: 'user-001',
        type: 'info',
        title: 'Test',
        content: 'Test content',
      };

      const notification = await notificationService.createNotification(dto);
      expect(notification).toBeDefined();
      expect(notification.id).toBeDefined();
    });

    it('should initialize dashboard service', () => {
      const dto: CreateDashboardDto = {
        name: 'Test Dashboard',
        datasourceId: 'ds-001',
      };

      const dashboard = dashboardService.create(dto, 'user-001');
      expect(dashboard).toBeDefined();
      expect(dashboard.id).toBeDefined();
    });

    it('should initialize both services independently', async () => {
      const notifDto: CreateNotificationDto = {
        userId: 'user-001',
        type: 'info',
        title: 'Test',
        content: 'Test content',
      };

      const dashDto: CreateDashboardDto = {
        name: 'Test Dashboard',
        datasourceId: 'ds-001',
      };

      const notification = await notificationService.createNotification(notifDto);
      const dashboard = dashboardService.create(dashDto, 'user-001');

      expect(notification.id).toBeDefined();
      expect(dashboard.id).toBeDefined();
      expect(notification.id).not.toBe(dashboard.id);
    });
  });

  describe('Cross-Module Workflow', () => {
    it('should create dashboard and send notification', async () => {
      // 创建大屏
      const dashDto: CreateDashboardDto = {
        name: 'Sales Dashboard',
        description: 'Sales data visualization',
        datasourceId: 'ds-001',
        theme: 'dark',
      };

      const dashboard = dashboardService.create(dashDto, 'user-001');
      expect(dashboard).toBeDefined();

      // 发送通知
      const notifDto: CreateNotificationDto = {
        userId: 'user-001',
        type: 'success',
        title: '大屏创建成功',
        content: `大屏 "${dashboard.name}" 已创建`,
        link: `/system/dashboard/${dashboard.id}`,
      };

      const notification = await notificationService.createNotification(notifDto);
      expect(notification).toBeDefined();
      expect(notification.link).toContain(dashboard.id);
    });

    it('should publish dashboard and notify users', async () => {
      // 创建大屏
      const dashboard = dashboardService.create({
        name: 'Test Dashboard',
        datasourceId: 'ds-001',
      }, 'user-001');

      // 发布大屏
      const published = dashboardService.publish(dashboard.id, {
        publishedBy: 'user-001',
      });
      expect(published!.status).toBe('published');

      // 通知相关用户
      const notification = await notificationService.createNotification({
        userId: 'user-002',
        type: 'info',
        title: '新大屏发布',
        content: `大屏 "${published!.name}" 已发布`,
        link: `/system/dashboard/${published!.id}`,
      });

      expect(notification).toBeDefined();
      expect(notification.type).toBe('info');
    });

    it('should handle dashboard errors with notifications', async () => {
      // 尝试获取不存在的大屏
      const dashboard = dashboardService.getById('non-existent-id');
      expect(dashboard).toBeNull();

      // 发送错误通知
      const notification = await notificationService.createNotification({
        userId: 'user-001',
        type: 'warning',
        title: '大屏加载失败',
        content: '请求的大屏不存在',
      });

      expect(notification.type).toBe('warning');
    });
  });

  describe('Performance Tests', () => {
    it('should handle bulk operations efficiently', async () => {
      const startTime = Date.now();

      // 批量创建大屏
      for (let i = 0; i < 20; i++) {
        dashboardService.create({
          name: `Dashboard ${i}`,
          datasourceId: 'ds-001',
        }, 'user-001');
      }

      // 批量创建通知
      for (let i = 0; i < 20; i++) {
        await notificationService.createNotification({
          userId: 'user-001',
          type: 'info',
          title: `Notification ${i}`,
          content: `Content ${i}`,
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 应该在合理时间内完成（< 1秒）
      expect(duration).toBeLessThan(1000);
    });

    it('should query data efficiently', async () => {
      // 创建测试数据
      for (let i = 0; i < 10; i++) {
        dashboardService.create({
          name: `Dashboard ${i}`,
          datasourceId: 'ds-001',
        }, 'user-001');

        await notificationService.createNotification({
          userId: 'user-001',
          type: 'info',
          title: `Notification ${i}`,
          content: `Content ${i}`,
        });
      }

      const startTime = Date.now();

      // 查询操作
      const dashboards = dashboardService.getList({ page: 1, pageSize: 10 });
      const notifications = await notificationService.getNotifications({
        userId: 'user-001',
        page: 1,
        pageSize: 10,
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(dashboards.items.length).toBe(10);
      expect(notifications.list.length).toBe(10);
      expect(duration).toBeLessThan(100); // < 100ms
    });
  });

  describe('Data Consistency', () => {
    it('should maintain referential integrity', async () => {
      const userId = 'user-001';

      // 创建大屏
      const dashboard = dashboardService.create({
        name: 'Test Dashboard',
        datasourceId: 'ds-001',
      }, userId);

      // 创建关联通知
      const notification = await notificationService.createNotification({
        userId,
        type: 'info',
        title: 'Dashboard Created',
        content: 'New dashboard created',
        link: `/system/dashboard/${dashboard.id}`,
      });

      // 删除大屏
      dashboardService.delete(dashboard.id);

      // 通知仍然存在（软引用）
      const retrievedNotif = await notificationService.getNotificationById(userId, notification.id);
      expect(retrievedNotif).not.toBeNull();
      expect(retrievedNotif!.link).toContain(dashboard.id);
    });

    it('should handle user-specific data correctly', async () => {
      const user1 = 'user-001';
      const user2 = 'user-002';

      // User 1 创建大屏
      const dashboard1 = dashboardService.create({
        name: 'User 1 Dashboard',
        datasourceId: 'ds-001',
      }, user1);

      // User 2 创建大屏
      const dashboard2 = dashboardService.create({
        name: 'User 2 Dashboard',
        datasourceId: 'ds-001',
      }, user2);

      // User 1 的通知
      await notificationService.createNotification({
        userId: user1,
        type: 'info',
        title: 'Your Dashboard',
        content: 'Dashboard created',
      });

      // User 2 的通知
      await notificationService.createNotification({
        userId: user2,
        type: 'info',
        title: 'Your Dashboard',
        content: 'Dashboard created',
      });

      // 验证数据隔离
      const user1Dashboards = dashboardService.getList({ createdBy: user1 });
      const user2Dashboards = dashboardService.getList({ createdBy: user2 });
      const user1Notifs = await notificationService.getNotifications({ userId: user1, page: 1, pageSize: 10 });
      const user2Notifs = await notificationService.getNotifications({ userId: user2, page: 1, pageSize: 10 });

      expect(user1Dashboards.total).toBe(1);
      expect(user2Dashboards.total).toBe(1);
      expect(user1Notifs.total).toBe(1);
      expect(user2Notifs.total).toBe(1);
    });
  });

  describe('Complete Workflow Tests', () => {
    it('should complete full dashboard lifecycle with notifications', async () => {
      const userId = 'user-001';
      const notificationIds: string[] = [];

      // 1. 创建大屏
      const dashboard = dashboardService.create({
        name: 'Sales Dashboard',
        description: 'Q4 Sales Data',
        datasourceId: 'ds-001',
        theme: 'dark',
      }, userId);

      notificationIds.push((await notificationService.createNotification({
        userId,
        type: 'success',
        title: '大屏创建成功',
        content: `大屏 "${dashboard.name}" 已创建`,
      })).id);

      // 2. 添加图表
      let current = dashboard;
      for (let i = 0; i < 3; i++) {
        current = dashboardService.addChart(current.id, {
          type: 'bar',
          title: `Chart ${i + 1}`,
          x: i * 4,
          y: 0,
          w: 4,
          h: 4,
          config: {},
        })!;
      }

      notificationIds.push((await notificationService.createNotification({
        userId,
        type: 'info',
        title: '图表已添加',
        content: '3个图表已添加到大屏',
      })).id);

      // 3. 发布大屏
      const published = dashboardService.publish(current.id, {
        publishedBy: userId,
      });

      notificationIds.push((await notificationService.createNotification({
        userId,
        type: 'success',
        title: '大屏已发布',
        content: `大屏 "${published!.name}" 已成功发布`,
      })).id);

      // 4. 更新大屏
      const updated = dashboardService.update(published!.id, {
        description: 'Updated Q4 Sales Data',
      });

      notificationIds.push((await notificationService.createNotification({
        userId,
        type: 'info',
        title: '大屏已更新',
        content: '大屏配置已更新',
      })).id);

      // 5. 归档大屏
      const archived = dashboardService.archive(updated!.id);

      notificationIds.push((await notificationService.createNotification({
        userId,
        type: 'warning',
        title: '大屏已归档',
        content: `大屏 "${archived!.name}" 已归档`,
      })).id);

      // 验证完整流程
      expect(notificationIds.length).toBe(5);
      expect(archived!.status).toBe('archived');
      expect(archived!.charts.length).toBe(3);

      const allNotifications = await notificationService.getNotifications({ userId, page: 1, pageSize: 10 });
      expect(allNotifications.total).toBe(5);
    });
  });
});
