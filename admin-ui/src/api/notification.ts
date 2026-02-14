import { get, put } from './request'
import type { Notification } from '@/types'

export const notificationApi = {
  // 获取通知列表
  getList: (params?: { unreadOnly?: boolean }) =>
    get<Notification[]>('/admin/notifications', { params }),

  // 获取未读数量
  getUnreadCount: () =>
    get<{ count: number }>('/admin/notifications/unread-count'),

  // 标记为已读
  markAsRead: (id: string) =>
    put(`/admin/notifications/${id}/read`),

  // 标记全部已读
  markAllAsRead: () =>
    put('/admin/notifications/read-all'),
}
