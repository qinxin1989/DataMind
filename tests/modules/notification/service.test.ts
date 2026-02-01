/**
 * 通知模块服务测试
 * Property 17: Notification Badge Count Accuracy
 * Property 18: Notification Status Management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { NotificationService } from '../../../modules/notification/backend/service';
import type { NotificationType } from '../../../modules/notification/backend/types';

describe('Notification Module Service', () => {
  let notificationService: NotificationService;

  beforeEach(() => {
    notificationService = new NotificationService();
    notificationService.clearAll();
  });

  afterEach(() => {
    notificationService.clearAll();
  });

  // Property 17: Notification Badge Count Accuracy
  describe('Property 17: Notification Badge Count Accuracy', () => {
    it('should return correct unread count', async () => {
      const userId = 'user-1';

      // 创建 5 个通知
      for (let i = 0; i < 5; i++) {
        await notificationService.createNotification({
          userId,
          type: 'info',
          title: `Notification ${i}`,
          content: 'Content',
        });
      }

      const count = await notificationService.getUnreadCount(userId);
      expect(count).toBe(5);
    });

    it('should decrease count when marking as read', async () => {
      const userId = 'user-1';

      const n1 = await notificationService.createNotification({
        userId,
        type: 'info',
        title: 'N1',
        content: 'C1',
      });
      await notificationService.createNotification({
        userId,
        type: 'info',
        title: 'N2',
        content: 'C2',
      });

      expect(await notificationService.getUnreadCount(userId)).toBe(2);

      await notificationService.markAsRead(userId, n1.id);
      expect(await notificationService.getUnreadCount(userId)).toBe(1);
    });

    it('should return zero for user with no notifications', async () => {
      const count = await notificationService.getUnreadCount('non-existent-user');
      expect(count).toBe(0);
    });

    it('should count by type correctly', async () => {
      const userId = 'user-1';

      await notificationService.createNotification({ userId, type: 'info', title: 'T', content: 'C' });
      await notificationService.createNotification({ userId, type: 'info', title: 'T', content: 'C' });
      await notificationService.createNotification({ userId, type: 'warning', title: 'T', content: 'C' });
      await notificationService.createNotification({ userId, type: 'system', title: 'T', content: 'C' });

      const counts = await notificationService.getUnreadCountByType(userId);
      expect(counts.info).toBe(2);
      expect(counts.warning).toBe(1);
      expect(counts.system).toBe(1);
      expect(counts.success).toBe(0);
    });
  });

  // Property 18: Notification Status Management
  describe('Property 18: Notification Status Management', () => {
    it('should mark notification as read', async () => {
      const userId = 'user-1';
      const notification = await notificationService.createNotification({
        userId,
        type: 'info',
        title: 'Test',
        content: 'Content',
      });

      expect(notification.read).toBe(false);

      const updated = await notificationService.markAsRead(userId, notification.id);
      expect(updated.read).toBe(true);

      // 验证持久化
      const retrieved = await notificationService.getNotificationById(userId, notification.id);
      expect(retrieved?.read).toBe(true);
    });

    it('should mark all as read', async () => {
      const userId = 'user-1';

      for (let i = 0; i < 3; i++) {
        await notificationService.createNotification({
          userId,
          type: 'info',
          title: `N${i}`,
          content: 'C',
        });
      }

      const count = await notificationService.markAllAsRead(userId);
      expect(count).toBe(3);

      const unreadCount = await notificationService.getUnreadCount(userId);
      expect(unreadCount).toBe(0);
    });

    it('should mark multiple as read', async () => {
      const userId = 'user-1';

      const n1 = await notificationService.createNotification({ userId, type: 'info', title: 'N1', content: 'C' });
      const n2 = await notificationService.createNotification({ userId, type: 'info', title: 'N2', content: 'C' });
      await notificationService.createNotification({ userId, type: 'info', title: 'N3', content: 'C' });

      const count = await notificationService.markMultipleAsRead(userId, [n1.id, n2.id]);
      expect(count).toBe(2);

      const unreadCount = await notificationService.getUnreadCount(userId);
      expect(unreadCount).toBe(1);
    });

    it('should not double count when marking already read', async () => {
      const userId = 'user-1';
      const notification = await notificationService.createNotification({
        userId,
        type: 'info',
        title: 'Test',
        content: 'Content',
      });

      await notificationService.markAsRead(userId, notification.id);
      
      // 再次标记
      const count = await notificationService.markAllAsRead(userId);
      expect(count).toBe(0);
    });
  });

  describe('Notification CRUD', () => {
    it('should create notification with all fields', async () => {
      const notification = await notificationService.createNotification({
        userId: 'user-1',
        type: 'warning',
        title: 'Warning Title',
        content: 'Warning content',
        link: '/dashboard',
      });

      expect(notification.id).toBeDefined();
      expect(notification.userId).toBe('user-1');
      expect(notification.type).toBe('warning');
      expect(notification.title).toBe('Warning Title');
      expect(notification.content).toBe('Warning content');
      expect(notification.link).toBe('/dashboard');
      expect(notification.read).toBe(false);
      expect(notification.createdAt).toBeDefined();
    });

    it('should query notifications with filters', async () => {
      const userId = 'user-1';

      await notificationService.createNotification({ userId, type: 'info', title: 'Info', content: 'C' });
      await notificationService.createNotification({ userId, type: 'warning', title: 'Warning', content: 'C' });
      const n3 = await notificationService.createNotification({ userId, type: 'info', title: 'Info 2', content: 'C' });
      await notificationService.markAsRead(userId, n3.id);

      // 按类型过滤
      const infoResult = await notificationService.getNotifications({
        userId,
        type: 'info',
        page: 1,
        pageSize: 10,
      });
      expect(infoResult.list.length).toBe(2);

      // 按已读状态过滤
      const unreadResult = await notificationService.getNotifications({
        userId,
        read: false,
        page: 1,
        pageSize: 10,
      });
      expect(unreadResult.list.length).toBe(2);
    });

    it('should delete notification', async () => {
      const userId = 'user-1';
      const notification = await notificationService.createNotification({
        userId,
        type: 'info',
        title: 'To Delete',
        content: 'C',
      });

      await notificationService.deleteNotification(userId, notification.id);

      const retrieved = await notificationService.getNotificationById(userId, notification.id);
      expect(retrieved).toBeNull();
    });

    it('should delete all read notifications', async () => {
      const userId = 'user-1';

      const n1 = await notificationService.createNotification({ userId, type: 'info', title: 'N1', content: 'C' });
      await notificationService.createNotification({ userId, type: 'info', title: 'N2', content: 'C' });
      await notificationService.markAsRead(userId, n1.id);

      const deletedCount = await notificationService.deleteAllRead(userId);
      expect(deletedCount).toBe(1);

      const result = await notificationService.getNotifications({ userId, page: 1, pageSize: 10 });
      expect(result.list.length).toBe(1);
    });
  });

  describe('Broadcast', () => {
    it('should create notifications for multiple users', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];

      const notifications = await notificationService.createBroadcast({
        userIds,
        type: 'system',
        title: 'System Announcement',
        content: 'Important message',
      });

      expect(notifications.length).toBe(3);

      for (const userId of userIds) {
        const count = await notificationService.getUnreadCount(userId);
        expect(count).toBe(1);
      }
    });
  });

  describe('Pagination', () => {
    it('should paginate results correctly', async () => {
      const userId = 'user-1';

      for (let i = 0; i < 25; i++) {
        await notificationService.createNotification({
          userId,
          type: 'info',
          title: `N${i}`,
          content: 'C',
        });
      }

      const page1 = await notificationService.getNotifications({ userId, page: 1, pageSize: 10 });
      const page2 = await notificationService.getNotifications({ userId, page: 2, pageSize: 10 });
      const page3 = await notificationService.getNotifications({ userId, page: 3, pageSize: 10 });

      expect(page1.list.length).toBe(10);
      expect(page2.list.length).toBe(10);
      expect(page3.list.length).toBe(5);
      expect(page1.total).toBe(25);
    });
  });

  // Property-based tests
  describe('Property-based Tests', () => {
    const typeArb = fc.constantFrom<NotificationType>('system', 'warning', 'info', 'success');

    it('Property 17: unread count should equal number of unread notifications', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              type: typeArb,
              title: fc.string({ minLength: 1, maxLength: 50 }),
              content: fc.string({ minLength: 1, maxLength: 200 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          fc.array(fc.nat(9), { maxLength: 5 }),
          async (notifications, readIndices) => {
            notificationService.clearAll();
            const userId = 'test-user';

            const created = [];
            for (const n of notifications) {
              const notification = await notificationService.createNotification({
                userId,
                ...n,
              });
              created.push(notification);
            }

            // 标记一些为已读
            const uniqueIndices = [...new Set(readIndices)].filter(i => i < created.length);
            for (const idx of uniqueIndices) {
              await notificationService.markAsRead(userId, created[idx].id);
            }

            const expectedUnread = created.length - uniqueIndices.length;
            const actualUnread = await notificationService.getUnreadCount(userId);
            expect(actualUnread).toBe(expectedUnread);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('Property 18: marking as read should update status and decrease count', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.nat({ max: 10 }),
          async (count) => {
            notificationService.clearAll();
            const userId = 'test-user';
            const numNotifications = count + 1;

            for (let i = 0; i < numNotifications; i++) {
              await notificationService.createNotification({
                userId,
                type: 'info',
                title: `N${i}`,
                content: 'C',
              });
            }

            const initialCount = await notificationService.getUnreadCount(userId);
            expect(initialCount).toBe(numNotifications);

            await notificationService.markAllAsRead(userId);

            const finalCount = await notificationService.getUnreadCount(userId);
            expect(finalCount).toBe(0);
          }
        ),
        { numRuns: 5 }
      );
    });
  });
});
