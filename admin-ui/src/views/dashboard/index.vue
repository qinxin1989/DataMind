<template>
  <div class="dashboard">
    <div class="page-header">
      <h1>工作台</h1>
    </div>

    <!-- 快捷操作 -->
    <a-card class="quick-actions">
      <template #title>
        <div class="card-title-row">
          <span>快捷操作</span>
          <a-button type="link" size="small" @click="openEditModal">
            <template #icon><EditOutlined /></template>
            编辑
          </a-button>
        </div>
      </template>
      <a-row :gutter="[16, 16]">
        <a-col :xs="12" :sm="8" :md="6" :lg="4" v-for="shortcut in shortcuts" :key="shortcut.id">
          <router-link :to="shortcut.path">
            <a-button type="dashed" block class="shortcut-btn">
              <template #icon><component :is="getIcon(shortcut.icon)" /></template>
              {{ shortcut.name }}
            </a-button>
          </router-link>
        </a-col>
        <a-col :xs="12" :sm="8" :md="6" :lg="4" v-if="shortcuts.length === 0">
          <a-button type="dashed" block @click="openEditModal">
            <template #icon><PlusOutlined /></template>
            添加快捷操作
          </a-button>
        </a-col>
      </a-row>
    </a-card>

    <!-- 最近活动 -->
    <a-card title="最近活动" class="recent-activity">
      <a-list :data-source="recentActivities" :loading="loading">
        <template #renderItem="{ item }">
          <a-list-item>
            <a-list-item-meta>
              <template #avatar>
                <a-avatar :style="{ backgroundColor: '#1677ff' }">
                  {{ item.username.charAt(0).toUpperCase() }}
                </a-avatar>
              </template>
              <template #title>{{ item.username }}</template>
              <template #description>
                {{ item.action }} - {{ formatTime(item.timestamp) }}
              </template>
            </a-list-item-meta>
          </a-list-item>
        </template>
      </a-list>
    </a-card>

    <!-- 编辑快捷操作弹窗 -->
    <a-modal
      v-model:open="editModalVisible"
      title="编辑快捷操作"
      width="600px"
      @ok="saveShortcuts"
    >
      <div class="shortcut-editor">
        <div class="available-menus">
          <p class="section-title">选择要添加的菜单（最多8个）</p>
          <a-checkbox-group v-model:value="selectedMenuIds" class="menu-checkbox-group">
            <template v-for="menu in flatMenus" :key="menu.id">
              <a-checkbox :value="menu.id" :disabled="!selectedMenuIds.includes(menu.id) && selectedMenuIds.length >= 8">
                <component :is="getIcon(menu.icon)" style="margin-right: 4px;" />
                {{ menu.title }}
              </a-checkbox>
            </template>
          </a-checkbox-group>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, h } from 'vue'
import {
  EditOutlined,
  PlusOutlined,
  UserOutlined,
  DatabaseOutlined,
  SettingOutlined,
  FileSearchOutlined,
  AppstoreOutlined,
  TeamOutlined,
  SafetyOutlined,
  BellOutlined,
  RobotOutlined,
  MenuOutlined,
  HistoryOutlined,
  BookOutlined,
} from '@ant-design/icons-vue'
import { usePermissionStore } from '@/stores/permission'
import type { MenuItem } from '@/types'

interface Shortcut {
  id: string
  name: string
  path: string
  icon: string
}

const loading = ref(false)
const editModalVisible = ref(false)
const shortcuts = ref<Shortcut[]>([])
const selectedMenuIds = ref<string[]>([])

const permissionStore = usePermissionStore()

// 图标映射
const iconMap: Record<string, any> = {
  UserOutlined,
  DatabaseOutlined,
  SettingOutlined,
  FileSearchOutlined,
  AppstoreOutlined,
  TeamOutlined,
  SafetyOutlined,
  BellOutlined,
  RobotOutlined,
  MenuOutlined,
  HistoryOutlined,
  BookOutlined,
  PlusOutlined,
  EditOutlined,
}

function getIcon(iconName: string | undefined) {
  if (!iconName) return AppstoreOutlined
  return iconMap[iconName] || AppstoreOutlined
}

// 扁平化菜单（只取叶子节点，即可跳转的菜单）- 使用用户有权限的菜单
const flatMenus = computed(() => {
  const result: MenuItem[] = []
  function flatten(menus: MenuItem[]) {
    for (const menu of menus) {
      if (menu.children && menu.children.length > 0) {
        flatten(menu.children)
      } else if (menu.path) {
        result.push(menu)
      }
    }
  }
  flatten(permissionStore.menuTree)
  return result
})

const recentActivities = ref([
  { username: 'admin', action: '登录系统', timestamp: Date.now() - 300000 },
  { username: 'user1', action: '执行SQL查询', timestamp: Date.now() - 600000 },
  { username: 'admin', action: '更新系统配置', timestamp: Date.now() - 900000 },
  { username: 'user2', action: '添加数据源', timestamp: Date.now() - 1200000 },
])

function formatTime(timestamp: number) {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return date.toLocaleDateString()
}

function openEditModal() {
  selectedMenuIds.value = shortcuts.value.map(s => s.id)
  editModalVisible.value = true
}

function saveShortcuts() {
  const newShortcuts: Shortcut[] = []
  for (const menuId of selectedMenuIds.value) {
    const menu = flatMenus.value.find(m => m.id === menuId)
    if (menu) {
      newShortcuts.push({
        id: menu.id,
        name: menu.title,
        path: menu.path || '/',
        icon: menu.icon || 'AppstoreOutlined',
      })
    }
  }
  shortcuts.value = newShortcuts
  localStorage.setItem('dashboard_shortcuts', JSON.stringify(newShortcuts))
  editModalVisible.value = false
}

function loadShortcuts() {
  const saved = localStorage.getItem('dashboard_shortcuts')
  if (saved) {
    try {
      shortcuts.value = JSON.parse(saved)
    } catch {
      shortcuts.value = []
    }
  }
}

onMounted(() => {
  loadShortcuts()
})
</script>

<style scoped>
.dashboard {
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

.quick-actions {
  margin-bottom: 24px;
}

.card-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.shortcut-btn {
  height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.shortcut-btn :deep(.anticon) {
  font-size: 20px;
  margin: 0 !important;
}

.recent-activity {
  margin-bottom: 24px;
}

.shortcut-editor {
  max-height: 400px;
  overflow-y: auto;
}

.section-title {
  margin-bottom: 12px;
  color: #666;
}

.menu-checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.menu-checkbox-group :deep(.ant-checkbox-wrapper) {
  margin-left: 0;
}
</style>
