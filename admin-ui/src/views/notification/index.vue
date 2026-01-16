<template>
  <div class="notification-page">
    <div class="page-header">
      <h1>通知中心</h1>
    </div>

    <div class="table-toolbar">
      <a-space>
        <a-button @click="handleMarkAllRead" :disabled="unreadCount === 0">
          全部标为已读
        </a-button>
        <a-radio-group v-model:value="filterType" button-style="solid">
          <a-radio-button value="all">全部</a-radio-button>
          <a-radio-button value="unread">未读</a-radio-button>
        </a-radio-group>
      </a-space>
    </div>

    <a-list
      :data-source="filteredNotifications"
      :loading="loading"
      :locale="{ emptyText: '暂无通知' }"
    >
      <template #renderItem="{ item }">
        <a-list-item :class="['notification-item', { unread: !item.read }]">
          <a-list-item-meta>
            <template #avatar>
              <a-avatar :style="{ backgroundColor: getTypeColor(item.type) }" :size="48">
                <template #icon>
                  <InfoCircleOutlined v-if="item.type === 'info'" />
                  <CheckCircleOutlined v-else-if="item.type === 'success'" />
                  <WarningOutlined v-else-if="item.type === 'warning'" />
                  <SettingOutlined v-else />
                </template>
              </a-avatar>
            </template>
            <template #title>
              <span class="notification-title">{{ item.title }}</span>
              <a-tag v-if="!item.read" color="blue" size="small">未读</a-tag>
            </template>
            <template #description>
              <div class="notification-content">{{ item.content }}</div>
              <div class="notification-time">{{ formatTime(item.createdAt) }}</div>
            </template>
          </a-list-item-meta>
          <template #actions>
            <a-button v-if="!item.read" type="link" @click="handleMarkRead(item)">
              标为已读
            </a-button>
            <a-button v-if="item.link" type="link" @click="handleNavigate(item)">
              查看详情
            </a-button>
          </template>
        </a-list-item>
      </template>
    </a-list>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  InfoCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  SettingOutlined,
} from '@ant-design/icons-vue'
import { useNotificationStore } from '@/stores/notification'
import type { Notification } from '@/types'

const router = useRouter()
const notificationStore = useNotificationStore()
const { notifications, unreadCount, loading } = storeToRefs(notificationStore)

const filterType = ref<'all' | 'unread'>('all')

const filteredNotifications = computed(() => {
  if (filterType.value === 'unread') {
    return notifications.value.filter(n => !n.read)
  }
  return notifications.value
})

onMounted(() => {
  notificationStore.fetchNotifications()
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
  return date.toLocaleString()
}

function handleMarkRead(item: Notification) {
  notificationStore.markAsRead(item.id)
}

function handleMarkAllRead() {
  notificationStore.markAllAsRead()
}

function handleNavigate(item: Notification) {
  if (item.link) {
    router.push(item.link)
  }
}
</script>

<style scoped>
.notification-page {
  padding: 0;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}

.table-toolbar {
  margin-bottom: 16px;
}

.notification-item {
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 8px;
  background: #fff;
  transition: background 0.3s;
}

.notification-item.unread {
  background: #f6ffed;
}

.notification-title {
  font-weight: 500;
  margin-right: 8px;
}

.notification-content {
  color: rgba(0, 0, 0, 0.65);
  margin-top: 8px;
}

.notification-time {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  margin-top: 8px;
}
</style>
