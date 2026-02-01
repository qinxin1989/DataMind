/**
 * 通知模块类型定义
 */

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

export interface NotificationListResponse {
  list: Notification[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  link?: string;
}

export interface BroadcastNotificationDto {
  userIds: string[];
  type: NotificationType;
  title: string;
  content: string;
  link?: string;
}

export interface UnreadCountByType {
  system: number;
  warning: number;
  info: number;
  success: number;
}
