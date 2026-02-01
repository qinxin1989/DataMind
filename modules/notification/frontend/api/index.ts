/**
 * 通知模块前端API
 */

import axios from 'axios';
import type {
  Notification,
  NotificationListResponse,
  CreateNotificationDto,
  BroadcastNotificationDto,
  UnreadCountByType,
  NotificationType
} from '../../backend/types';

const API_BASE = '/api/notifications';

export const notificationApi = {
  // 获取通知列表
  getNotifications(params: {
    type?: NotificationType;
    read?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<NotificationListResponse> {
    return axios.get(API_BASE, { params }).then(res => res.data);
  },

  // 获取通知详情
  getNotificationById(id: string): Promise<Notification> {
    return axios.get(`${API_BASE}/${id}`).then(res => res.data);
  },

  // 获取未读数量
  getUnreadCount(): Promise<{ count: number }> {
    return axios.get(`${API_BASE}/stats/unread-count`).then(res => res.data);
  },

  // 获取按类型分组的未读数量
  getUnreadCountByType(): Promise<UnreadCountByType> {
    return axios.get(`${API_BASE}/stats/unread-count-by-type`).then(res => res.data);
  },

  // 创建通知
  createNotification(data: CreateNotificationDto): Promise<Notification> {
    return axios.post(API_BASE, data).then(res => res.data);
  },

  // 批量发送通知
  broadcast(data: BroadcastNotificationDto): Promise<{ count: number; notifications: Notification[] }> {
    return axios.post(`${API_BASE}/broadcast`, data).then(res => res.data);
  },

  // 标记为已读
  markAsRead(id: string): Promise<Notification> {
    return axios.post(`${API_BASE}/${id}/read`).then(res => res.data);
  },

  // 全部标记为已读
  markAllAsRead(): Promise<{ count: number }> {
    return axios.post(`${API_BASE}/actions/read-all`).then(res => res.data);
  },

  // 批量标记为已读
  markMultipleAsRead(ids: string[]): Promise<{ count: number }> {
    return axios.post(`${API_BASE}/actions/read-multiple`, { ids }).then(res => res.data);
  },

  // 删除通知
  deleteNotification(id: string): Promise<void> {
    return axios.delete(`${API_BASE}/${id}`).then(res => res.data);
  },

  // 删除所有已读通知
  deleteAllRead(): Promise<{ count: number }> {
    return axios.delete(`${API_BASE}/actions/delete-read`).then(res => res.data);
  },

  // 删除所有通知
  deleteAll(): Promise<{ count: number }> {
    return axios.delete(`${API_BASE}/actions/delete-all`).then(res => res.data);
  },
};
