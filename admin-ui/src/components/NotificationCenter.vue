<template>
  <a-popover
    v-model:open="visible"
    trigger="click"
    placement="bottomRight"
    :overlayStyle="{ width: '360px' }"
  >
    <template #content>
      <div class="notification-header">
        <span>通知中心</span>
        <a-button type="link" size="small" @click="handleMarkAllRead" :disabled="unreadCount === 0">
          全部已读
        </a-button>
      </div>
      <a-spin :spinning="loading">
        <a-list
          class="notification-list"
          :data-source="notifications"
          :locale="{ emptyText: '暂无通知' }"
        >
          <template #renderItem="{ item }">
            <a-list-item
              :class="['notification-item', { unread: !item.read }]"
              @click="handleClick(item)"
            >
              <a-list-item-meta>
                <template #avatar>
                  <a-avatar :style="{ backgroundColor: getTypeColor(item.type) }">
                    <template #icon>
                      <InfoCircleOutlined v-if="item.type === 'info'" />
                      <CheckCircleOutlined v-else-if="item.type === 'success'" />
                      <WarningOutlined v-else-if="item.type === 'warning'" />
                      <SettingOutlined v-else />
                    </template>
                  </a-avatar>
                </template>
                <template #title>{{ item.title }}</template>
                <template #description>
                  <div class="notification-content">{{ item.content }}</div>
                  <div class="notification-time">{{ formatTime(item.createdAt) }}</div>
                </template>
              </a-list-item-meta>
            </a-list-item>
          </template>
        </a-list>
      </a-spin>
      <div class="notification-footer">
        <router-link to="/notification" @click="visible = false">查看全部</router-link>
      </div>
    </template>
    <a-badge :count="unreadCount" :offset="[-2, 2]">
      <a-button type="text">
        <template #icon><BellOutlined /></template>
      </a-button>
    </a-badge>
  </a-popover>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import {
  BellOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  SettingOutlined,
} from '@ant-design/icons-vue'
import { useNotificationStore } from '@/stores/notification'
import type { Notification } from '@/types'

const notificationStore = useNotificationStore()
const { notifications, unreadCount, loading } = storeToRefs(notificationStore)

const visible = ref(false)

onMounted(() => {
  notificationStore.fetchNotifications()
  notificationStore.fetchUnreadCount()
})

function getTypeColor(type: string) {
  const colors: Record<string, string> = {
    info: '#1677ff',
    success: '#52c41a',
    warning: '#faad14',
    system: '#722ed1',
  }
  return colors[type] || '#1677ff'
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return date.toLocaleDateString()
}

function handleClick(item: Notification) {
  if (!item.read) {
    notificationStore.markAsRead(item.id)
  }
  if (item.link) {
    visible.value = false
  }
}

function handleMarkAllRead() {
  notificationStore.markAllAsRead()
}
</script>

<style scoped>
.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 8px;
}

.notification-list {
  max-height: 400px;
  overflow-y: auto;
}

.notification-item {
  cursor: pointer;
  padding: 12px 0;
}

.notification-item.unread {
  background: #f6ffed;
}

.notification-content {
  color: rgba(0, 0, 0, 0.65);
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-time {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  margin-top: 4px;
}

.notification-footer {
  text-align: center;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
  margin-top: 8px;
}
</style>
