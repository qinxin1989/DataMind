import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Notification } from '@/types'
import { notificationApi } from '@/api/notification'

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<Notification[]>([])
  const unreadCount = ref(0)
  const loading = ref(false)

  function normalizeNotificationList(payload: unknown): Notification[] {
    if (Array.isArray(payload)) {
      return payload
    }

    if (payload && typeof payload === 'object') {
      const list = (payload as { list?: unknown }).list
      if (Array.isArray(list)) {
        return list as Notification[]
      }
    }

    return []
  }

  async function fetchNotifications(unreadOnly = false) {
    loading.value = true
    try {
      const res = await notificationApi.getList({ unreadOnly })
      if (res.success) {
        notifications.value = normalizeNotificationList(res.data)
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
      notifications.value = []
    } finally {
      loading.value = false
    }
  }

  async function fetchUnreadCount() {
    try {
      const res = await notificationApi.getUnreadCount()
      if (res.success && res.data) {
        unreadCount.value = res.data.count
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error)
    }
  }

  async function markAsRead(id: string) {
    try {
      await notificationApi.markAsRead(id)
      const notification = notifications.value.find(n => n.id === id)
      if (notification && !notification.read) {
        notification.read = true
        unreadCount.value = Math.max(0, unreadCount.value - 1)
      }
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  async function markAllAsRead() {
    try {
      await notificationApi.markAllAsRead()
      notifications.value.forEach(n => (n.read = true))
      unreadCount.value = 0
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    }
  }

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
  }
})
