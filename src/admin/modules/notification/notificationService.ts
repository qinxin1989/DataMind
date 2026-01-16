/**
 * 通知服务
 * 实现通知创建、查询和已读状态管理
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DATA_DIR = path.join(process.cwd(), 'data');
const NOTIFICATIONS_DIR = path.join(DATA_DIR, 'notifications');

export type NotificationType = 'system' | 'warning' | 'info' | 'success';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  link?: string;
  read: boolean;
  createdAt: number;
}

export interface NotificationQueryParams {
  userId: string;
  type?: NotificationType;
  read?: boolean;
  page: number;
  pageSize: number;
}

export class NotificationService {
  constructor() {
    this.ensureDataDir();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(NOTIFICATIONS_DIR)) {
      fs.mkdirSync(NOTIFICATIONS_DIR, { recursive: true });
    }
  }

  private getUserFile(userId: string): string {
    return path.join(NOTIFICATIONS_DIR, `${userId}.json`);
  }

  private readNotifications(userId: string): Notification[] {
    const filePath = this.getUserFile(userId);
    if (!fs.existsSync(filePath)) return [];
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return [];
    }
  }

  private writeNotifications(userId: string, notifications: Notification[]): void {
    const filePath = this.getUserFile(userId);
    fs.writeFileSync(filePath, JSON.stringify(notifications, null, 2));
  }

  // ==================== 通知创建 ====================

  async createNotification(data: Omit<Notification, 'id' | 'read' | 'createdAt'>): Promise<Notification> {
    const notification: Notification = {
      ...data,
      id: uuidv4(),
      read: false,
      createdAt: Date.now(),
    };

    const notifications = this.readNotifications(data.userId);
    notifications.unshift(notification); // 新通知放在最前面
    this.writeNotifications(data.userId, notifications);

    return notification;
  }

  async createBroadcast(
    userIds: string[],
    data: Omit<Notification, 'id' | 'userId' | 'read' | 'createdAt'>
  ): Promise<Notification[]> {
    const notifications: Notification[] = [];
    
    for (const userId of userIds) {
      const notification = await this.createNotification({ ...data, userId });
      notifications.push(notification);
    }

    return notifications;
  }

  // ==================== 通知查询 ====================

  async getNotifications(params: NotificationQueryParams): Promise<{
    list: Notification[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { userId, type, read, page, pageSize } = params;
    
    let notifications = this.readNotifications(userId);

    // 过滤
    if (type !== undefined) {
      notifications = notifications.filter(n => n.type === type);
    }
    if (read !== undefined) {
      notifications = notifications.filter(n => n.read === read);
    }

    // 按时间倒序（已经是倒序了）
    const total = notifications.length;
    const startIdx = (page - 1) * pageSize;
    const list = notifications.slice(startIdx, startIdx + pageSize);

    return { list, total, page, pageSize };
  }

  async getNotificationById(userId: string, id: string): Promise<Notification | null> {
    const notifications = this.readNotifications(userId);
    return notifications.find(n => n.id === id) || null;
  }

  // ==================== 未读计数 ====================

  async getUnreadCount(userId: string): Promise<number> {
    const notifications = this.readNotifications(userId);
    return notifications.filter(n => !n.read).length;
  }

  async getUnreadCountByType(userId: string): Promise<Record<NotificationType, number>> {
    const notifications = this.readNotifications(userId);
    const counts: Record<NotificationType, number> = {
      system: 0,
      warning: 0,
      info: 0,
      success: 0,
    };

    for (const n of notifications) {
      if (!n.read) {
        counts[n.type]++;
      }
    }

    return counts;
  }

  // ==================== 已读状态管理 ====================

  async markAsRead(userId: string, id: string): Promise<Notification> {
    const notifications = this.readNotifications(userId);
    const notification = notifications.find(n => n.id === id);
    
    if (!notification) {
      throw new Error('通知不存在');
    }

    notification.read = true;
    this.writeNotifications(userId, notifications);
    return notification;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const notifications = this.readNotifications(userId);
    let count = 0;

    for (const n of notifications) {
      if (!n.read) {
        n.read = true;
        count++;
      }
    }

    this.writeNotifications(userId, notifications);
    return count;
  }

  async markMultipleAsRead(userId: string, ids: string[]): Promise<number> {
    const notifications = this.readNotifications(userId);
    let count = 0;

    for (const n of notifications) {
      if (ids.includes(n.id) && !n.read) {
        n.read = true;
        count++;
      }
    }

    this.writeNotifications(userId, notifications);
    return count;
  }

  // ==================== 通知删除 ====================

  async deleteNotification(userId: string, id: string): Promise<void> {
    const notifications = this.readNotifications(userId);
    const index = notifications.findIndex(n => n.id === id);
    
    if (index === -1) {
      throw new Error('通知不存在');
    }

    notifications.splice(index, 1);
    this.writeNotifications(userId, notifications);
  }

  async deleteAllRead(userId: string): Promise<number> {
    const notifications = this.readNotifications(userId);
    const unread = notifications.filter(n => !n.read);
    const deletedCount = notifications.length - unread.length;
    
    this.writeNotifications(userId, unread);
    return deletedCount;
  }

  async deleteAll(userId: string): Promise<number> {
    const notifications = this.readNotifications(userId);
    const count = notifications.length;
    this.writeNotifications(userId, []);
    return count;
  }

  // ==================== 测试辅助 ====================

  clearAll(): void {
    if (fs.existsSync(NOTIFICATIONS_DIR)) {
      const files = fs.readdirSync(NOTIFICATIONS_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(NOTIFICATIONS_DIR, file));
      }
    }
  }
}

export const notificationService = new NotificationService();
