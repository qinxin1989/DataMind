<template>
  <div class="notification-container">
    <a-card title="通知中心" :bordered="false">
      <!-- 操作栏 -->
      <div class="action-bar">
        <a-space>
          <a-button type="primary" @click="handleMarkAllAsRead" :loading="loading">
            全部标记为已读
          </a-button>
          <a-button @click="handleDeleteAllRead" :loading="loading">
            删除已读通知
          </a-button>
          <a-select
            v-model:value="filterType"
            style="width: 120px"
            @change="loadNotifications"
            placeholder="通知类型"
          >
            <a-select-option value="">全部</a-select-option>
            <a-select-option value="system">系统</a-select-option>
            <a-select-option value="warning">警告</a-select-option>
            <a-select-option value="info">信息</a-select-option>
            <a-select-option value="success">成功</a-select-option>
          </a-select>
          <a-select
            v-model:value="filterRead"
            style="width: 120px"
            @click="loadNotifications"
            placeholder="已读状态"
          >
            <a-select-option value="">全部</a-select-option>
            <a-select-option value="false">未读</a-select-option>
            <a-select-option value="true">已读</a-select-option>
          </a-select>
        </a-space>
        <div class="unread-badge">
          未读: <a-badge :count="unreadCount" :number-style="{ backgroundColor: '#52c41a' }" />
        </div>
      </div>

      <!-- 通知列表 -->
      <a-list
        :loading="loading"
        :data-source="notifications"
        :pagination="pagination"
        @change="handlePageChange"
      >
        <template #renderItem="{ item }">
          <a-list-item>
            <a-list-item-meta>
              <template #avatar>
                <a-badge :dot="!item.read">
                  <a-avatar :style="{ backgroundColor: getTypeColor(item.type) }">
                    <template #icon>
                      <BellOutlined v-if="item.type === 'system'" />
                      <WarningOutlined v-else-if="item.type === 'warning'" />
                      <InfoCircleOutlined v-else-if="item.type === 'info'" />
                      <CheckCircleOutlined v-else />
                    </template>
                  </a-avatar>
                </a-badge>
              </template>
              <template #title>
                <span :class="{ 'unread-title': !item.read }">{{ item.title }}</span>
                <a-tag :color="getTypeColor(item.type)" style="margin-left: 8px">
                  {{ getTypeLabel(item.type) }}
                </a-tag>
              </template>
              <template #description>
                <div>{{ item.content }}</div>
                <div class="notification-time">
                  {{ formatTime(item.createdAt) }}
                </div>
              </template>
            </a-list-item-meta>
            <template #actions>
              <a v-if="!item.read" @click="handleMarkAsRead(item.id)">标记已读</a>
              <a @click="handleDelete(item.id)" style="color: #ff4d4f">删除</a>
            </template>
          </a-list-item>
        </template>
      </a-list>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { message } from 'ant-design-vue';
import {
  BellOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons-vue';
import { notificationApi } from '../api';
import type { Notification, NotificationType } from '../../backend/types';

const loading = ref(false);
const notifications = ref<Notification[]>([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(10);
const unreadCount = ref(0);
const filterType = ref<NotificationType | ''>('');
const filterRead = ref<string>('');

const pagination = computed(() => ({
  current: currentPage.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
}));

const loadNotifications = async () => {
  loading.value = true;
  try {
    const params: any = {
      page: currentPage.value,
      pageSize: pageSize.value,
    };
    if (filterType.value) params.type = filterType.value;
    if (filterRead.value) params.read = filterRead.value === 'true';

    const result = await notificationApi.getNotifications(params);
    notifications.value = result.list;
    total.value = result.total;

    // 加载未读数量
    const { count } = await notificationApi.getUnreadCount();
    unreadCount.value = count;
  } catch (error: any) {
    message.error('加载通知失败: ' + error.message);
  } finally {
    loading.value = false;
  }
};

const handlePageChange = (page: number, size: number) => {
  currentPage.value = page;
  pageSize.value = size;
  loadNotifications();
};

const handleMarkAsRead = async (id: string) => {
  try {
    await notificationApi.markAsRead(id);
    message.success('已标记为已读');
    loadNotifications();
  } catch (error: any) {
    message.error('操作失败: ' + error.message);
  }
};

const handleMarkAllAsRead = async () => {
  try {
    const { count } = await notificationApi.markAllAsRead();
    message.success(`已标记 ${count} 条通知为已读`);
    loadNotifications();
  } catch (error: any) {
    message.error('操作失败: ' + error.message);
  }
};

const handleDelete = async (id: string) => {
  try {
    await notificationApi.deleteNotification(id);
    message.success('删除成功');
    loadNotifications();
  } catch (error: any) {
    message.error('删除失败: ' + error.message);
  }
};

const handleDeleteAllRead = async () => {
  try {
    const { count } = await notificationApi.deleteAllRead();
    message.success(`已删除 ${count} 条已读通知`);
    loadNotifications();
  } catch (error: any) {
    message.error('操作失败: ' + error.message);
  }
};

const getTypeColor = (type: NotificationType): string => {
  const colors = {
    system: '#1890ff',
    warning: '#faad14',
    info: '#13c2c2',
    success: '#52c41a',
  };
  return colors[type] || '#1890ff';
};

const getTypeLabel = (type: NotificationType): string => {
  const labels = {
    system: '系统',
    warning: '警告',
    info: '信息',
    success: '成功',
  };
  return labels[type] || '未知';
};

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
  
  return date.toLocaleString('zh-CN');
};

onMounted(() => {
  loadNotifications();
});
</script>

<style scoped>
.notification-container {
  padding: 24px;
}

.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.unread-badge {
  font-size: 14px;
  color: #666;
}

.unread-title {
  font-weight: 600;
  color: #1890ff;
}

.notification-time {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}
</style>
